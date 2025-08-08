/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Platform tool for agent-to-agent communication via A2A protocol
 */

import { z } from 'zod';
import { createA2AClient } from '@codespin/shaman-a2a-client';
import { createLogger } from '@codespin/shaman-logger';
import type { Tool, ToolExecutionContext } from '../types.js';
import type { Message } from '@codespin/shaman-a2a-protocol';

const logger = createLogger('CallAgentTool');

/**
 * Create call_agent tool for agent-to-agent communication
 */
export function createCallAgentTool(
  context: ToolExecutionContext,
  options: {
    internalA2AUrl?: string;
    jwtToken?: string;
  } = {}
): Tool {
  return {
    name: 'call_agent',
    description: 'Call another agent and get its response. Enables agent collaboration and delegation.',
    inputSchema: z.object({
      agent: z.string().describe('Name of the agent to call (e.g., "InventoryAgent" or "FraudDetectionAgent@git+https://github.com/org/agents.git#main")'),
      message: z.string().describe('The message or request to send to the agent'),
      contextData: z.record(z.unknown()).optional().describe('Optional context data to pass to the agent'),
      async: z.boolean().optional().default(false).describe('Whether to wait for completion (false) or return immediately with a task ID (true)')
    }),
    async execute(input) {
      const { agent, message, contextData, async = false } = input as {
        agent: string;
        message: string;
        contextData?: Record<string, unknown>;
        async?: boolean;
      };

      logger.info('Calling agent', { 
        callerAgent: context.agentName,
        targetAgent: agent,
        runId: context.runId,
        async
      });

      // Validate context
      if (!context.runId) {
        throw new Error('No run context available for call_agent');
      }

      if (!options.jwtToken && !context.jwtToken) {
        throw new Error('No JWT token available for internal agent communication');
      }

      // Create A2A client for internal communication
      const a2aClient = createA2AClient({
        baseUrl: options.internalA2AUrl || process.env.INTERNAL_A2A_URL || 'http://localhost:5001',
        jwtToken: options.jwtToken || context.jwtToken!
      });

      // Build message parts
      const parts = [
        {
          kind: 'text' as const,
          text: message
        }
      ];

      // Add context data if provided
      if (contextData && Object.keys(contextData).length > 0) {
        parts.push({
          kind: 'text',
          text: `\nContext: ${JSON.stringify(contextData, null, 2)}`
        });
      }

      // Build A2A message
      const a2aMessage: Message = {
        kind: 'message',
        messageId: `msg-${Date.now()}`,
        role: 'user',
        parts,
        contextId: context.runId,
        metadata: {
          'shaman:callerAgent': context.agentName,
          'shaman:runId': context.runId,
          'shaman:stepId': context.stepId,
          'shaman:parentTaskId': context.taskId,
          ...contextData
        }
      };

      try {
        // Send message to agent
        const response = await a2aClient.sendMessage({
          id: `req-${Date.now()}`,
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: a2aMessage,
            metadata: {
              agent
            }
          }
        });

        if (!response.success) {
          logger.error('Failed to call agent', {
            agent,
            error: response.error
          });
          
          return {
            success: false,
            error: `Failed to call agent ${agent}: ${response.error.message}`
          };
        }

        const result = response.data;

        // Handle different response types
        if ('result' in result && result.result) {
          const resultData = result.result;
          
          if (resultData.kind === 'task' && async) {
            // Return task ID for async processing
            return {
              success: true,
              taskId: resultData.id,
              status: resultData.status,
              message: 'Agent execution started asynchronously'
            };
          } else if (resultData.kind === 'task' && !async) {
            // Wait for task completion
            logger.info('Waiting for agent task completion', {
              taskId: resultData.id,
              agent
            });

            // Poll for task completion - simplified version
            // TODO: Implement proper polling with retry logic
            const completedTask = await a2aClient.getTask({
              jsonrpc: '2.0' as const,
              id: 'req-' + Date.now(),
              method: 'tasks/get' as const,
              params: { id: resultData.id }
            });

            if (!completedTask.success) {
              return {
                success: false,
                error: `Agent task failed: ${completedTask.error.message}`
              };
            }

            // Extract response from completed task
            return extractAgentResponse(completedTask.data);
          } else if (resultData.kind === 'message') {
            // Direct message response
            return extractMessageResponse(resultData);
          }
        }

        // Unexpected response format
        logger.warn('Unexpected response format from agent', {
          agent,
          response: result
        });

        return {
          success: false,
          error: 'Unexpected response format from agent'
        };

      } catch (error) {
        logger.error('Error calling agent', {
          agent,
          error
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error calling agent'
        };
      }
    }
  };
}

/**
 * Extract response from completed task
 */
function extractAgentResponse(task: any): any {
  // Check for artifacts in the task
  if (task.artifacts && Array.isArray(task.artifacts)) {
    const jsonArtifact = task.artifacts.find((a: any) => 
      a.mimeType === 'application/json' || a.type === 'application/json'
    );
    
    if (jsonArtifact) {
      return {
        success: true,
        data: jsonArtifact.data,
        message: 'Agent completed successfully'
      };
    }
  }

  // Check for message in status
  if (task.status?.message) {
    return extractMessageResponse(task.status.message);
  }

  // Default response
  return {
    success: true,
    taskId: task.id,
    status: task.status,
    message: 'Agent completed'
  };
}

/**
 * Extract response from message
 */
function extractMessageResponse(message: any): any {
  if (!message.parts || !Array.isArray(message.parts)) {
    return {
      success: true,
      message: 'Agent responded',
      messageId: message.messageId
    };
  }

  // Extract text content
  const textParts = message.parts
    .filter((p: any) => p.kind === 'text')
    .map((p: any) => p.text)
    .join('\n');

  // Look for JSON in the response
  try {
    // Try to parse the entire response as JSON
    const jsonResponse = JSON.parse(textParts);
    return {
      success: true,
      data: jsonResponse,
      message: 'Agent responded with structured data'
    };
  } catch {
    // Not JSON, return as text
    return {
      success: true,
      response: textParts,
      message: 'Agent responded',
      messageId: message.messageId,
      metadata: message.metadata
    };
  }
}