/**
 * Worker process that executes run steps
 */

import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { createLogger } from '@codespin/shaman-logger';
import { createRlsDb } from '@codespin/shaman-db';
import { createA2AClient } from '@codespin/shaman-a2a-client';
import { generateStepId } from '@codespin/shaman-agent-executor';
import type { TaskRequest, WorkflowConfig } from '@codespin/shaman-workflow';
import type { Message } from '@codespin/shaman-a2a-protocol';

const logger = createLogger('Worker');

// Tool handlers registry
const toolHandlers: Record<string, ToolHandler> = {
  'call_agent': handleCallAgentTool,
  'run_data_write': handleRunDataWrite,
  'run_data_read': handleRunDataRead,
  // Add more tool handlers here
};

type ToolHandler = (
  stepId: string,
  input: unknown,
  context: TaskRequest['context']
) => Promise<unknown>;

/**
 * Main worker for executing steps
 */
export function createStepWorker(config: WorkflowConfig): Worker<TaskRequest> {
  const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db
  };

  const worker = new Worker<TaskRequest>(
    config.queues.stepExecution,
    async (job: Job<TaskRequest>) => {
      const { stepId, stepType, name, context, input } = job.data;
      const db = createRlsDb(context.organizationId);

      logger.info('Processing step', { stepId, stepType, name });

      try {
        // Update step status to running
        await db.none(`
          UPDATE step SET 
            status = 'running',
            start_time = NOW()
          WHERE id = $(stepId)
        `, { stepId });

        // Update run status if this is the first step
        await db.none(`
          UPDATE run SET 
            status = 'running',
            start_time = COALESCE(start_time, NOW())
          WHERE id = $(runId) AND status = 'pending'
        `, { runId: context.runId });

        let result: unknown;

        if (stepType === 'agent') {
          result = await executeAgent(stepId, name, input, context);
        } else if (stepType === 'tool') {
          result = await executeTool(stepId, name, input, context);
        } else {
          throw new Error(`Unknown step type: ${stepType as string}`);
        }

        // Update step as completed
        await db.none(`
          UPDATE step SET 
            status = 'completed',
            output = $(output),
            end_time = NOW(),
            duration = EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000
          WHERE id = $(stepId)
        `, { 
          stepId,
          output: result as Record<string, unknown>
        });

        // Check if all steps are complete
        await checkRunCompletion(context.runId, context.organizationId);

        return { success: true, output: result as Record<string, unknown> };

      } catch (error) {
        logger.error('Step execution failed', { stepId, error });

        // Update step as failed
        await db.none(`
          UPDATE step SET 
            status = 'failed',
            error = $(error),
            end_time = NOW(),
            duration = EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000
          WHERE id = $(stepId)
        `, { 
          stepId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Mark run as failed
        await db.none(`
          UPDATE run SET 
            status = 'failed',
            end_time = NOW()
          WHERE id = $(runId)
        `, { runId: context.runId });

        throw error;
      }
    },
    {
      connection,
      concurrency: config.workers?.concurrency || 5
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, error: err });
  });

  return worker;
}

/**
 * Execute an agent step
 */
async function executeAgent(
  stepId: string,
  agentName: string,
  input: unknown,
  context: TaskRequest['context']
): Promise<unknown> {
  // Generate JWT for internal A2A call
  const jwt = generateInternalJWT({
    runId: context.runId,
    stepId,
    organizationId: context.organizationId,
    depth: context.depth
  });

  // Create A2A client
  const a2aClient = createA2AClient({
    baseUrl: process.env.INTERNAL_A2A_URL || 'http://localhost:4000',
    jwtToken: jwt
  });

  // Create message
  const message: Message = {
    kind: 'message',
    messageId: stepId,
    role: 'user',
    parts: [{
      kind: 'text',
      text: typeof input === 'string' ? input : JSON.stringify(input)
    }],
    metadata: {
      agent: agentName,
      'shaman:runId': context.runId,
      'shaman:stepId': stepId,
      'shaman:parentStepId': context.parentStepId,
      'shaman:organizationId': context.organizationId,
      'shaman:depth': context.depth
    }
  };

  // Send message to agent
  const response = await a2aClient.sendMessage({
    id: stepId,
    jsonrpc: '2.0',
    method: 'message/send',
    params: {
      message
    }
  });

  // Handle response
  if (!response.success) {
    throw response.error;
  }

  // Check response type
  const result = response.data;
  if ('result' in result && result.result) {
    const resultData = result.result;
    if (resultData.kind === 'message') {
      return { type: 'message', content: resultData };
    } else if (resultData.kind === 'task') {
      // Agent returned a task - need to poll
      const db = createRlsDb(context.organizationId);
      await db.none(`
        UPDATE step SET 
          status = 'waiting',
          async_id = $(taskId)
        WHERE id = $(stepId)
      `, { stepId, taskId: resultData.id });

      // Queue polling job
      // TODO: Queue async polling job

      return { type: 'task', taskId: resultData.id };
    }
  }
  throw new Error('Unexpected response type');
}

/**
 * Execute a tool step
 */
async function executeTool(
  stepId: string,
  toolName: string,
  input: unknown,
  context: TaskRequest['context']
): Promise<unknown> {
  const handler = toolHandlers[toolName];
  
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return await handler(stepId, input, context);
}

/**
 * Handle call_agent tool - creates a new agent step
 */
async function handleCallAgentTool(
  stepId: string,
  input: unknown,
  context: TaskRequest['context']
): Promise<unknown> {
  const { agent, task, mode = 'sync' } = input as { agent: string; task: string; mode?: string };
  const db = createRlsDb(context.organizationId);

  // Create new agent step
  const agentStepId = generateStepId();
  await db.none(`
    INSERT INTO step (
      id, run_id, parent_step_id, step_type, name,
      status, input, created_at
    ) VALUES (
      $(id), $(runId), $(parentStepId), 'agent', $(name),
      'queued', $(input), NOW()
    )
  `, {
    id: agentStepId,
    runId: context.runId,
    parentStepId: context.parentStepId, // Link to original agent, not the tool
    name: agent,
    input: { message: task } as Record<string, unknown>
  });

  // Queue the agent step
  // TODO: Get workflow engine instance
  // await workflowEngine.queueStep({
  //   stepId: agentStepId,
  //   stepType: 'agent',
  //   name: agent,
  //   input: { message: task },
  //   context: {
  //     ...context,
  //     parentStepId: context.parentStepId,
  //     depth: context.depth + 1
  //   }
  // });

  return {
    created_step_id: agentStepId,
    mode
  };
}

/**
 * Handle run_data_write tool
 */
async function handleRunDataWrite(
  stepId: string,
  input: unknown,
  context: TaskRequest['context']
): Promise<unknown> {
  const { key, value } = input as { key: string; value: unknown };
  const db = createRlsDb(context.organizationId);

  // Get agent name from step
  const step = await db.one<{ name: string, parent_step_id: string }>(
    'SELECT name, parent_step_id FROM step WHERE id = $(stepId)',
    { stepId }
  );

  // Get parent agent name
  const parentStep = await db.one<{ name: string }>(
    'SELECT name FROM step WHERE id = $(parentStepId)',
    { parentStepId: step.parent_step_id }
  );

  await db.none(`
    INSERT INTO run_data (
      run_id, key, value, created_by_agent_name, created_by_step_id
    ) VALUES (
      $(runId), $(key), $(value), $(agentName), $(stepId)
    )
    ON CONFLICT (run_id, key) DO UPDATE
    SET value = $(value), created_by_step_id = $(stepId)
  `, {
    runId: context.runId,
    key,
    value: value as Record<string, unknown>,
    agentName: parentStep.name,
    stepId: context.parentStepId
  });

  return { success: true, key };
}

/**
 * Handle run_data_read tool
 */
async function handleRunDataRead(
  stepId: string,
  input: unknown,
  context: TaskRequest['context']
): Promise<unknown> {
  const { key } = input as { key: string };
  const db = createRlsDb(context.organizationId);

  const data = await db.oneOrNone<{ value: unknown }>(
    'SELECT value FROM run_data WHERE run_id = $(runId) AND key = $(key)',
    { runId: context.runId, key }
  );

  return data?.value || null;
}

/**
 * Check if run is complete and update status
 */
async function checkRunCompletion(runId: string, organizationId: string): Promise<void> {
  const db = createRlsDb(organizationId);

  const incompleteCount = await db.one<{ count: string }>(
    `SELECT COUNT(*) as count FROM step 
     WHERE run_id = $(runId) AND status IN ('queued', 'running', 'waiting')`,
    { runId }
  );

  if (parseInt(incompleteCount.count) === 0) {
    // All steps complete - check if any failed
    const failedCount = await db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM step 
       WHERE run_id = $(runId) AND status = 'failed'`,
      { runId }
    );

    const finalStatus = parseInt(failedCount.count) > 0 ? 'failed' : 'completed';

    await db.none(`
      UPDATE run SET 
        status = $(status),
        end_time = NOW(),
        duration = EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
        total_steps = (SELECT COUNT(*) FROM step WHERE run_id = $(runId))
      WHERE id = $(runId)
    `, { runId, status: finalStatus });

    logger.info('Run completed', { runId, status: finalStatus });
  }
}

/**
 * Generate internal JWT token
 * TODO: Move to shaman-security package
 */
function generateInternalJWT(context: Record<string, unknown>): string {
  // Placeholder - should use proper JWT library
  return 'jwt_' + Buffer.from(JSON.stringify(context)).toString('base64');
}