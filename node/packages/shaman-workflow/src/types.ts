/**
 * Types for workflow engine
 */

import type { WorkflowContext } from '@codespin/shaman-types';

export type WorkflowConfig = {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  queues: {
    default: string;
    priority: string;
  };
  workers: {
    concurrency: number;
    maxJobsPerWorker: number;
  };
};

export type JobData = {
  agentName: string;
  input: string;
  context: WorkflowContext;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  };
};

export type JobResult = {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
  };
};