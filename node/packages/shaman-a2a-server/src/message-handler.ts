/**
 * packages/shaman-a2a-server/src/message-handler.ts
 * 
 * Handles A2A message/send requests
 */

import type { Logger } from '@codespin/shaman-logger';
import type { Result } from '@codespin/shaman-core';
import type { AgentsConfig } from '@codespin/shaman-agents';
import { getAgent } from '@codespin/shaman-agents';
import type { WorkflowContext } from '@codespin/shaman-types';
import { v4 as uuidv4 } from 'uuid';

import type {
  A2ASendMessageRequest,
  A2ASendMessageResponse,
  A2AProviderConfig,
  A2ATask,
  A2AMessage
} from './types.js';
import { canExposeAgent } from './agent-adapter.js';

export type MessageHandlerDependencies = {
  config: A2AProviderConfig;
  agentsConfig: AgentsConfig;
};

/**
 * Extract agent name from message text
 * This is a simple implementation - in production, you'd use
 * more sophisticated routing based on agent capabilities
 */
function extractAgentName(message: A2AMessage): string | null {
  // Look for @agent mentions
  const text = message.parts.find(p => p.kind === 'text')?.text || '';
  const match = text.match(/@(\w+)/);
  if (match) {
    return match[1];
  }
  
  // Default routing logic could go here
  return null;
}

/**
 * Handle message/send request
 */
export async function handleMessageSend(
  request: A2ASendMessageRequest,
  dependencies: MessageHandlerDependencies,
  logger: Logger
): Promise<Result<A2ASendMessageResponse>> {
  try {
    const { message, configuration, metadata } = request;
    
    // Extract target agent from message
    const agentName = extractAgentName(message);
    if (!agentName) {
      return {
        success: false,
        error: 'Could not determine target agent from message'
      };
    }
    
    // Get the agent
    const agentResult = await getAgent(agentName, dependencies.agentsConfig);
    if (!agentResult.success || !agentResult.data || agentResult.data.source !== 'git') {
      return {
        success: false,
        error: `Agent ${agentName} not found`
      };
    }
    
    const gitAgent = agentResult.data.agent;
    
    // Check if agent can be exposed
    if (!canExposeAgent(gitAgent, dependencies.config)) {
      return {
        success: false,
        error: `Agent ${agentName} is not available via A2A`
      };
    }
    
    // Create task for the message
    const taskId = `task-${uuidv4()}`;
    const contextId = message.contextId || `ctx-${uuidv4()}`;
    
    // For blocking requests, we would execute the agent and wait
    // For now, we'll create a task in submitted state
    const task: A2ATask = {
      id: taskId,
      contextId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString()
      },
      artifacts: [],
      history: [message],
      metadata: {
        ...metadata,
        agentName,
        blocking: configuration?.blocking || false
      },
      kind: 'task'
    };
    
    // TODO: Actually execute the agent via workflow engine
    // For now, we'll simulate by transitioning to working state
    if (configuration?.blocking) {
      // In real implementation, this would:
      // 1. Create a workflow run
      // 2. Execute the agent
      // 3. Wait for completion
      // 4. Return the completed task
      
      logger.info('Would execute agent in blocking mode', {
        agentName,
        taskId,
        contextId
      });
      
      // Simulate completion
      task.status = {
        state: 'completed',
        timestamp: new Date().toISOString(),
        message: {
          role: 'agent',
          parts: [{
            kind: 'text',
            text: `Agent ${agentName} received: "${message.parts[0]?.text}". This is a simulated response - actual agent execution not yet implemented.`
          }],
          messageId: `msg-${uuidv4()}`
        }
      };
    }
    
    return {
      success: true,
      data: task
    };
    
  } catch (error) {
    logger.error('Error handling message/send:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}