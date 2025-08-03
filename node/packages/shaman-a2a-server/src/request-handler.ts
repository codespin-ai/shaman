import { TaskState } from '@codespin/shaman-a2a-protocol';
import type { 
  MessageSendParams,
  TaskQueryParams,
  TaskIdParams,
  AgentCard,
  Task,
  Message
} from '@codespin/shaman-a2a-protocol';
import type { A2AMethodContext } from '@codespin/shaman-a2a-transport';
import { createLogger } from '@codespin/shaman-logger';
import { 
  createRun, 
  createTask, 
  getRun, 
  updateRun,
  type ForemanConfig,
  type Run
} from '@codespin/foreman-client';
import { v4 as uuidv4 } from 'uuid';
import type { A2AServerConfig, TaskExecutionRequest } from './types.js';
import { taskNotFound, taskNotCancelable, internalError } from '@codespin/shaman-jsonrpc';

const logger = createLogger('A2ARequestHandler');

/**
 * Request handler for A2A protocol methods
 */
export class A2ARequestHandler {
  private foremanConfig: ForemanConfig;

  constructor(private readonly config: A2AServerConfig) {
    // Get Foreman config from environment
    this.foremanConfig = {
      endpoint: process.env.FOREMAN_ENDPOINT || 'http://localhost:3000',
      apiKey: process.env.FOREMAN_API_KEY || 'fmn_dev_default_key'
    };
  }

  /**
   * Get agent card for discovery
   */
  async getAgentCard(): Promise<AgentCard> {
    return this.config.getAgentCard();
  }

  /**
   * Handle message/send request
   */
  async sendMessage(
    params: MessageSendParams,
    context: A2AMethodContext
  ): Promise<Task | Message> {
    logger.info('Handling message/send request', { 
      message: params.message,
      organizationId: context.organizationId
    });

    try {
      // Generate task ID
      const taskId = uuidv4();

      // Create task execution request
      const taskRequest: TaskExecutionRequest = {
        taskId,
        agent: (params.message.metadata?.agent as string | undefined) || 'default',
        input: params.message,
        contextId: params.message.contextId,
        organizationId: context.organizationId!,
        userId: context.userId
      };

      // Create a run in Foreman
      const runResult = await createRun(this.foremanConfig, {
        inputData: {
          agentName: taskRequest.agent,
          input: taskRequest.input,
          organizationId: context.organizationId!
        },
        metadata: {
          taskId,
          contextId: taskRequest.contextId,
          userId: taskRequest.userId,
          source: 'shaman-a2a',
          organizationId: context.organizationId!
        }
      });

      if (!runResult.success) {
        throw internalError(`Failed to create run: ${runResult.error.message}`);
      }

      const run: Run = runResult.data;

      // Create initial task for agent execution
      const taskResult = await createTask(this.foremanConfig, {
        runId: run.id,
        type: 'agent-execution',
        inputData: {
          agentName: taskRequest.agent,
          input: taskRequest.input
        },
        metadata: {
          organizationId: context.organizationId!
        }
      });

      if (!taskResult.success) {
        logger.error('Failed to create task', taskResult.error);
        throw internalError('Failed to start task');
      }

      // Task created successfully

      const task: Task = {
        kind: 'task',
        id: taskId,
        contextId: taskRequest.contextId || taskId,
        status: {
          state: TaskState.Submitted,
          timestamp: new Date().toISOString()
        }
      };
      
      return task;
    } catch (error) {
      logger.error('Error in sendMessage', error);
      throw error;
    }
  }

  /**
   * Handle message/stream request
   */
  async *streamMessage(
    params: MessageSendParams,
    context: A2AMethodContext
  ): AsyncGenerator<Task | Message> {
    logger.info('Handling message/stream request', { 
      message: params.message,
      organizationId: context.organizationId
    });

    // For MVP, we'll return a simple acknowledgment
    // Real implementation would stream run updates
    const taskId = uuidv4();

    // First yield the task
    const task: Task = {
      kind: 'task',
      id: taskId,
      contextId: taskId,
      status: {
        state: TaskState.Submitted,
        timestamp: new Date().toISOString()
      }
    };
    yield task;

    // TODO: Subscribe to run events and stream them
    
    // For now, yield a completion message
    const message: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [{
        kind: 'text',
        text: 'Task completed successfully'
      }]
    };
    yield message;
  }

  /**
   * Handle tasks/get request
   */
  async getTask(
    params: TaskQueryParams,
    context: A2AMethodContext
  ): Promise<Task> {
    logger.info('Getting task status', { 
      taskId: params.id,
      organizationId: context.organizationId
    });

    try {
      // Look up the run using the task ID (stored in metadata)
      // For MVP, we'll need to implement a lookup mechanism
      // This is a limitation of the current design - we need to map task IDs to run IDs
      const runResult = await getRun(this.foremanConfig, params.id);
      
      if (!runResult.success) {
        throw taskNotFound(params.id);
      }

      const run: Run = runResult.data;
      
      // Map run status to task state
      let taskState: TaskState;
      switch (run.status) {
        case 'pending':
          taskState = TaskState.Submitted;
          break;
        case 'running':
          taskState = TaskState.Working;
          break;
        case 'completed':
          taskState = TaskState.Completed;
          break;
        case 'failed':
          taskState = TaskState.Failed;
          break;
        case 'cancelled':
          taskState = TaskState.Canceled;
          break;
        default:
          taskState = TaskState.Submitted;
      }

      const task: Task = {
        kind: 'task',
        id: params.id,
        contextId: params.id, // Using task ID as context ID for now
        status: {
          state: taskState,
          timestamp: new Date().toISOString()
        }
      };

      return task;
    } catch (error) {
      logger.error('Error getting task', error);
      throw error;
    }
  }

  /**
   * Handle tasks/cancel request
   */
  async cancelTask(
    params: TaskIdParams,
    context: A2AMethodContext
  ): Promise<Task> {
    logger.info('Canceling task', { 
      taskId: params.id,
      organizationId: context.organizationId
    });

    try {
      // Get current status first
      const runResult = await getRun(this.foremanConfig, params.id);
      
      if (!runResult.success) {
        throw taskNotFound(params.id);
      }

      const run: Run = runResult.data;
      
      // Check if task can be canceled
      if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
        throw taskNotCancelable(params.id, run.status);
      }

      // Cancel the run by updating its status
      const updateResult = await updateRun(this.foremanConfig, params.id, {
        status: 'cancelled'
      });
      
      if (!updateResult.success) {
        throw internalError('Failed to cancel task');
      }

      const task: Task = {
        kind: 'task',
        id: params.id,
        contextId: params.id,
        status: {
          state: TaskState.Canceled,
          timestamp: new Date().toISOString()
        }
      };

      return task;
    } catch (error) {
      logger.error('Error canceling task', error);
      throw error;
    }
  }

  /**
   * Handle tasks/resubscribe request
   */
  async *resubscribeTask(
    params: TaskIdParams,
    context: A2AMethodContext
  ): AsyncGenerator<Task | Message> {
    logger.info('Resubscribing to task', { 
      taskId: params.id,
      organizationId: context.organizationId
    });

    // For MVP, return current status
    const task = await this.getTask(params, context);
    
    yield task;

    // TODO: Subscribe to run events and stream them
  }
}