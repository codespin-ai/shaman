/**
 * packages/shaman-a2a-server/src/message-handler.ts
 * 
 * Handles A2A message/send requests and creates workflows
 */

import type { Logger } from '@codespin/shaman-logger';
import type { Result } from '@codespin/shaman-core';
import type { AgentsConfig } from '@codespin/shaman-agents';
import type { Database } from '@codespin/shaman-db';
import type { WorkflowEngine } from '@codespin/shaman-workflow';
import { generateRunId, generateStepId } from '@codespin/shaman-agent-executor';

import type {
  A2ASendMessageRequest,
  A2ASendMessageResponse,
  A2AProviderConfig,
  A2ATask,
  A2AMessage
} from './types.js';

export type MessageHandlerDependencies = {
  config: A2AProviderConfig;
  agentsConfig: AgentsConfig;
  db: Database;
  workflowEngine: WorkflowEngine;
};

/**
 * Extract agent name from message text
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
 * Extract task from message (remove @agent mention)
 */
function extractTask(message: A2AMessage, agentName: string): string {
  const text = message.parts.find(p => p.kind === 'text')?.text || '';
  return text.replace(new RegExp(`@${agentName}\\s*`), '').trim();
}

/**
 * Handle message/send request - creates workflow
 */
export async function handleMessageSend(
  request: A2ASendMessageRequest,
  dependencies: MessageHandlerDependencies,
  logger: Logger
): Promise<Result<A2ASendMessageResponse>> {
  try {
    const { message, configuration, metadata } = request;
    const { db, workflowEngine } = dependencies;
    
    // Extract target agent from message
    const agentName = extractAgentName(message);
    if (!agentName) {
      return {
        success: false,
        error: 'Could not determine target agent from message'
      };
    }
    
    const task = extractTask(message, agentName);
    const runId = generateRunId();
    const contextId = message.contextId || `ctx-${runId}`;
    
    // Create Run in PostgreSQL
    await db.none(`
      INSERT INTO run (
        id, organization_id, status, initial_input, 
        created_by, created_by_type, metadata, created_at
      ) VALUES (
        $(id), $(organizationId), 'pending', $(initialInput),
        $(createdBy), $(createdByType), $(metadata), NOW()
      )
    `, {
      id: runId,
      organizationId: metadata?.['shaman:organizationId'] || 'default',
      initialInput: message.parts[0]?.text || '',
      createdBy: metadata?.['shaman:createdBy'] || 'external',
      createdByType: 'api_key',
      metadata: { contextId, ...metadata }
    });

    // Create initial call_agent tool step
    const callAgentStepId = generateStepId();
    await db.none(`
      INSERT INTO step (
        id, run_id, parent_step_id, step_type, name,
        status, input, created_at
      ) VALUES (
        $(id), $(runId), NULL, 'tool', 'call_agent',
        'queued', $(input), NOW()
      )
    `, {
      id: callAgentStepId,
      runId,
      input: {
        agent: agentName,
        task: task,
        mode: configuration?.blocking ? 'sync' : 'async'
      }
    });

    // Queue the step for execution
    const jobId = await workflowEngine.queueStep({
      stepId: callAgentStepId,
      stepType: 'tool',
      name: 'call_agent',
      input: {
        agent: agentName,
        task: task,
        mode: configuration?.blocking ? 'sync' : 'async'
      },
      context: {
        runId,
        organizationId: metadata?.['shaman:organizationId'] || 'default',
        depth: 0
      }
    });

    // Update step with job ID
    await db.none(`
      UPDATE step SET job_id = $(jobId) WHERE id = $(stepId)
    `, { jobId, stepId: callAgentStepId });

    logger.info('Created workflow', {
      runId,
      agentName,
      stepId: callAgentStepId,
      jobId
    });

    // Return task response
    const task: A2ATask = {
      id: runId,
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