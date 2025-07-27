/**
 * Core agent execution logic
 */

import type { 
  AgentExecutionRequest, 
  AgentExecutionResult,
  Result
} from '@codespin/shaman-workflow-core';
import type {
  Message,
  ToolCall,
  ExecutionState,
  WorkflowContext
} from '@codespin/shaman-types';
import type {
  AgentDefinition,
  AgentExecutorDependencies,
  ConversationState,
  LLMCompletionResult,
  ToolExecutionResult
} from './types.js';
import type { LLMProvider, LLMMessage } from '@codespin/shaman-llm-core';
import { canAgentCall } from './agent-resolver.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Execute an agent
 */
export async function executeAgent(
  request: AgentExecutionRequest,
  dependencies: AgentExecutorDependencies
): Promise<Result<AgentExecutionResult>> {
  try {
    // 1. Resolve the agent definition
    const agentResult = await dependencies.agentResolver(request.agentName);
    if (!agentResult.success) {
      return agentResult;
    }
    const agent = agentResult.data;

    // 2. Create initial conversation state
    const state: ConversationState = {
      messages: [],
      toolCalls: new Map(),
      iterations: 0,
      totalTokens: 0,
      totalCost: 0
    };

    // 3. Add system prompt if defined
    if (agent.systemPrompt) {
      state.messages.push({
        id: uuidv4(),
        role: 'SYSTEM',
        content: agent.systemPrompt,
        sequenceNumber: 0,
        createdAt: new Date()
      });
    }

    // 4. Add context from previous agents if requested
    if (request.contextScope === 'FULL' && request.context.memory.size > 0) {
      const contextMessage = buildContextMessage(request.context);
      if (contextMessage) {
        state.messages.push(contextMessage);
      }
    }

    // 5. Add user input
    state.messages.push({
      id: uuidv4(),
      role: 'USER',
      content: request.input,
      sequenceNumber: state.messages.length,
      createdAt: new Date()
    });

    // 6. Main execution loop
    const maxIterations = agent.maxIterations || 10;
    let finalResult: string | null = null;
    let status: ExecutionState = 'WORKING';

    while (state.iterations < maxIterations) {
      state.iterations++;

      // Get LLM completion
      const completion = await getLLMCompletion(
        state.messages,
        agent,
        dependencies.llmProvider
      );

      if (!completion.success) {
        status = 'FAILED';
        break;
      }

      // Update token counts
      state.totalTokens += completion.data.promptTokens + completion.data.completionTokens;
      state.totalCost += completion.data.cost;

      // Add assistant message
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'ASSISTANT',
        content: completion.data.content,
        sequenceNumber: state.messages.length,
        createdAt: new Date(),
        toolCalls: completion.data.toolCalls
      };
      state.messages.push(assistantMessage);

      // If no tool calls, we're done
      if (!completion.data.toolCalls || completion.data.toolCalls.length === 0) {
        finalResult = completion.data.content;
        status = 'COMPLETED';
        break;
      }

      // Execute tool calls
      const toolResults = await executeToolCalls(
        completion.data.toolCalls,
        agent,
        request,
        dependencies
      );

      // Add tool responses to conversation
      for (const result of toolResults) {
        state.messages.push({
          id: uuidv4(),
          role: 'TOOL',
          content: JSON.stringify(result.result),
          sequenceNumber: state.messages.length,
          createdAt: new Date(),
          toolCallId: result.toolCallId
        });

        // Check if this was an agent call that needs handling
        if (result.isAgentCall && !result.success) {
          status = 'FAILED';
          finalResult = `Agent call failed: ${result.error}`;
          break;
        }
      }

      if (status === 'FAILED') break;
    }

    // 7. Check if we hit iteration limit
    if (state.iterations >= maxIterations && !finalResult) {
      status = 'FAILED';
      finalResult = 'Maximum iterations reached without completion';
    }

    // 8. Store result in context if successful
    if (status === 'COMPLETED' && finalResult) {
      request.context.memory.set(`${request.agentName}_result`, finalResult);
    }

    // 9. Return execution result
    return {
      success: true,
      data: {
        stepId: request.parentStepId || uuidv4(),
        output: finalResult || 'No output generated',
        status,
        childStepIds: [], // Will be populated if there were agent calls
        metadata: {
          iterations: state.iterations,
          totalTokens: state.totalTokens,
          totalCost: state.totalCost,
          model: agent.model
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Agent execution failed')
    };
  }
}

/**
 * Get LLM completion
 */
async function getLLMCompletion(
  messages: Message[],
  agent: AgentDefinition,
  llmProvider: LLMProvider
): Promise<Result<LLMCompletionResult>> {
  try {
    // Convert messages to LLM format
    const llmMessages: LLMMessage[] = messages.map(msg => ({
      role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant' | 'tool',
      content: msg.content,
      tool_calls: msg.toolCalls?.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.toolName,
          arguments: JSON.stringify(tc.input)
        }
      })),
      tool_call_id: msg.toolCallId
    }));

    // Call LLM
    const response = await llmProvider.complete({
      messages: llmMessages,
      model: agent.model || 'gpt-4',
      temperature: agent.temperature,
      tools: [] // TODO: Add tool definitions
    });

    return {
      success: true,
      data: {
        content: response.content || '',
        toolCalls: response.tool_calls?.map(tc => ({
          id: tc.id,
          toolName: tc.function.name,
          input: JSON.parse(tc.function.arguments) as unknown,
          isSystemTool: false,
          isAgentCall: tc.function.name.startsWith('agent:')
        })),
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        cost: calculateCost(
          response.usage?.prompt_tokens || 0,
          response.usage?.completion_tokens || 0,
          agent.model || 'gpt-4'
        ),
        finishReason: response.finish_reason
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('LLM completion failed')
    };
  }
}

/**
 * Execute tool calls
 */
async function executeToolCalls(
  toolCalls: ToolCall[],
  agent: AgentDefinition,
  request: AgentExecutionRequest,
  dependencies: AgentExecutorDependencies
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const toolCall of toolCalls) {
    // Check if this is an agent call
    if (toolCall.toolName.startsWith('agent:')) {
      const targetAgent = toolCall.toolName.substring(6);
      
      // Validate agent can make this call
      if (!canAgentCall(agent, targetAgent)) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.toolName,
          result: null,
          success: false,
          error: `Agent ${agent.name} is not allowed to call ${targetAgent}`,
          isAgentCall: true
        });
        continue;
      }

      // Execute child agent if workflow engine available
      if (dependencies.workflowEngine) {
        const childResult = await dependencies.workflowEngine.executeAgent({
          ...request,
          agentName: targetAgent,
          input: toolCall.input as string,
          parentStepId: request.parentStepId,
          depth: request.depth + 1
        });

        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.toolName,
          result: childResult.success ? childResult.data.output : null,
          success: childResult.success,
          error: childResult.success ? undefined : childResult.error.message,
          isAgentCall: true
        });
      } else {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.toolName,
          result: null,
          success: false,
          error: 'Workflow engine not available for agent calls',
          isAgentCall: true
        });
      }
    } else {
      // Regular tool call
      const toolResult = await dependencies.toolRouter.executeTool(
        toolCall.toolName,
        toolCall.input,
        {
          runId: request.context.runId,
          stepId: request.parentStepId || '',
          agentName: agent.name,
          agentSource: request.agentSource
        }
      );

      results.push({
        toolCallId: toolCall.id,
        toolName: toolCall.toolName,
        result: toolResult.success ? toolResult.data.output : null,
        success: toolResult.success,
        error: toolResult.success ? undefined : toolResult.error.message,
        isAgentCall: false
      });
    }
  }

  return results;
}

/**
 * Build context message from workflow memory
 */
function buildContextMessage(context: WorkflowContext): Message | null {
  if (context.memory.size === 0) {
    return null;
  }

  const contextParts: string[] = ['Previous context from other agents:'];
  
  for (const [key, value] of context.memory.entries()) {
    contextParts.push(`${key}: ${JSON.stringify(value)}`);
  }

  return {
    id: uuidv4(),
    role: 'SYSTEM',
    content: contextParts.join('\n'),
    sequenceNumber: 1,
    createdAt: new Date()
  };
}

/**
 * Calculate cost based on token usage
 */
function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  // Simplified cost calculation - should be configurable
  const costs: Record<string, { prompt: number; completion: number }> = {
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
    'claude-3-opus': { prompt: 0.015, completion: 0.075 },
    'claude-3-sonnet': { prompt: 0.003, completion: 0.015 }
  };

  const modelCost = costs[model] || costs['gpt-4'];
  
  return (promptTokens * modelCost.prompt / 1000) + 
         (completionTokens * modelCost.completion / 1000);
}