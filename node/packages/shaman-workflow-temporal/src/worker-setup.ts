/**
 * Helper for setting up Temporal workers
 */

import { Worker } from '@temporalio/worker';
import type { NativeConnection } from '@temporalio/worker';
import * as activities from './activities/index.js';
import { agentWorkflow, executeAgentWorkflow } from './workflows/agent-workflow.js';

export type WorkerConfig = {
  connection: NativeConnection;
  namespace?: string;
  taskQueue: string;
  workflowsPath?: string; // For bundled workflows
};

/**
 * Create a Temporal worker
 */
export async function createWorker(config: WorkerConfig): Promise<Worker> {
  const worker = await Worker.create({
    connection: config.connection,
    namespace: config.namespace || 'default',
    taskQueue: config.taskQueue,
    workflowsPath: config.workflowsPath || require.resolve('./workflows'),
    activities,
  });

  return worker;
}

/**
 * Helper to run a worker
 */
export async function runWorker(config: WorkerConfig): Promise<void> {
  const worker = await createWorker(config);
  
  console.log(`Starting Temporal worker on task queue: ${config.taskQueue}`);
  
  // Handle shutdown gracefully
  process.on('SIGINT', () => worker.shutdown());
  process.on('SIGTERM', () => worker.shutdown());
  
  await worker.run();
}