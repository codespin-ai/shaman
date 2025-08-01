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
import { startWorkflow, getWorkflowStatus, cancelWorkflow } from '@codespin/shaman-workflow';
import { v4 as uuidv4 } from 'uuid';
import type { A2AServerConfig, TaskExecutionRequest } from './types.js';
import { taskNotFound, taskNotCancelable, internalError } from '@codespin/shaman-jsonrpc';

const logger = createLogger('A2ARequestHandler');

/**
 * Request handler for A2A protocol methods
 */
export class A2ARequestHandler {
  constructor(private readonly config: A2AServerConfig) {}

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

      // Start workflow
      const result = await startWorkflow({
        id: taskId,
        name: 'agent-execution',
        data: taskRequest,
        organizationId: context.organizationId!
      });

      if (!result.success) {
        logger.error('Failed to start workflow', result.error);
        throw internalError('Failed to start task');
      }

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
    // Real implementation would stream workflow updates
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

    // TODO: Subscribe to workflow events and stream them
    
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
      const status = await getWorkflowStatus(params.id, context.organizationId!);
      
      if (!status.success) {
        throw taskNotFound(params.id);
      }

      const workflow = status.data;
      
      // Map workflow status to task state
      let taskState: TaskState;
      switch (workflow.status) {
        case 'waiting':
        case 'active':
          taskState = TaskState.Working;
          break;
        case 'completed':
          taskState = TaskState.Completed;
          break;
        case 'failed':
          taskState = TaskState.Failed;
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
      const status = await getWorkflowStatus(params.id, context.organizationId!);
      
      if (!status.success) {
        throw taskNotFound(params.id);
      }

      const workflow = status.data;
      
      // Check if task can be canceled
      if (workflow.status === 'completed' || workflow.status === 'failed') {
        throw taskNotCancelable(params.id, workflow.status);
      }

      // Cancel the workflow
      const result = await cancelWorkflow(params.id, context.organizationId!);
      
      if (!result.success) {
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

    // TODO: Subscribe to workflow events and stream them
  }
}