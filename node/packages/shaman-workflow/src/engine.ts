/**
 * BullMQ workflow engine
 */

import { Queue, QueueEvents, JobsOptions } from 'bullmq';
import { createLogger } from '@codespin/shaman-logger';
import type { WorkflowConfig, StepRequest, AsyncPollRequest } from './types.js';

const logger = createLogger('WorkflowEngine');

export type WorkflowEngine = {
  // Queue step execution
  queueStep: (data: StepRequest, options?: JobsOptions) => Promise<string>;
  
  // Queue async polling
  queueAsyncPoll: (data: AsyncPollRequest, options?: JobsOptions) => Promise<string>;
  
  // Get queue instances (for monitoring)
  getQueues: () => {
    stepQueue: Queue;
    pollQueue: Queue;
  };
  
  // Shutdown
  close: () => Promise<void>;
};

export function createWorkflowEngine(config: WorkflowConfig): WorkflowEngine {
  // Redis connection
  const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db
  };

  // Create queues
  const stepQueue = new Queue(config.queues.stepExecution, { connection });
  const pollQueue = new Queue(config.queues.asyncPolling, { connection });

  logger.info('Workflow engine initialized', {
    stepQueue: config.queues.stepExecution,
    pollQueue: config.queues.asyncPolling
  });

  return {
    async queueStep(data: StepRequest, options?: JobsOptions): Promise<string> {
      const job = await stepQueue.add('execute-step', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
        ...options
      });

      logger.debug('Queued step execution', {
        jobId: job.id,
        stepId: data.stepId,
        stepType: data.stepType,
        name: data.name
      });

      return job.id!;
    },

    async queueAsyncPoll(data: AsyncPollRequest, options?: JobsOptions): Promise<string> {
      const job = await pollQueue.add('poll-async', data, {
        attempts: 10, // More retries for polling
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 10,
        removeOnFail: 100,
        ...options
      });

      logger.debug('Queued async poll', {
        jobId: job.id,
        stepId: data.stepId,
        pollType: data.pollType
      });

      return job.id!;
    },

    getQueues() {
      return {
        stepQueue,
        pollQueue
      };
    },

    async close(): Promise<void> {
      await Promise.all([
        stepQueue.close(),
        pollQueue.close()
      ]);
      logger.info('Workflow engine shut down');
    }
  };
}