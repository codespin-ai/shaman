#!/usr/bin/env node

/**
 * Start the Shaman worker process
 */

import { createLogger } from '@codespin/shaman-logger';
import { createAgentWorker } from './agent-worker.js';
import type { WorkerConfig } from './types.js';

const logger = createLogger('WorkerStart');

/**
 * Start the worker with configuration from environment
 */
export async function startWorker(config?: Partial<WorkerConfig>): Promise<void> {
  try {
    const workerConfig: WorkerConfig = {
      foremanEndpoint: config?.foremanEndpoint || process.env.FOREMAN_ENDPOINT || 'http://localhost:3000',
      foremanApiKey: config?.foremanApiKey || process.env.FOREMAN_API_KEY || '',
      internalA2AUrl: config?.internalA2AUrl || process.env.INTERNAL_A2A_URL || 'http://localhost:5001',
      jwtSecret: config?.jwtSecret || process.env.JWT_SECRET || 'dev-secret',
      concurrency: config?.concurrency || parseInt(process.env.WORKER_CONCURRENCY || '5'),
      queues: config?.queues || {
        taskQueue: process.env.SHAMAN_TASK_QUEUE || 'shaman:tasks',
        resultQueue: process.env.SHAMAN_RESULT_QUEUE || 'shaman:results'
      }
    };

    if (!workerConfig.foremanApiKey) {
      throw new Error('FOREMAN_API_KEY environment variable is required');
    }

    logger.info('Starting Shaman worker', {
      foremanEndpoint: workerConfig.foremanEndpoint,
      internalA2AUrl: workerConfig.internalA2AUrl,
      concurrency: workerConfig.concurrency,
      queues: workerConfig.queues
    });

    const worker = await createAgentWorker(workerConfig);
    
    await worker.start();
    logger.info('Worker started successfully');

    // Handle shutdown gracefully
    const shutdown = async (): Promise<void> => {
      logger.info('Shutting down worker...');
      await worker.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());

  } catch (error) {
    logger.error('Failed to start worker', error);
    process.exit(1);
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void startWorker();
}