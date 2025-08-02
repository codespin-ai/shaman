/**
 * Worker factory for processing jobs
 */

import type { WorkflowConfig } from './types.js';

export function createWorker(_config: WorkflowConfig): never {
  // TODO: Implement BullMQ worker
  throw new Error('Worker not implemented yet');
}