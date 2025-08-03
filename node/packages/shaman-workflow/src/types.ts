/**
 * Types for the workflow engine that orchestrates runs
 */

export type WorkflowConfig = {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queues: {
    stepExecution: string; // Main queue for executing steps
    asyncPolling: string;  // Queue for polling async operations
  };
  workers?: {
    concurrency: number;
    maxJobsPerWorker: number;
  };
};

// Task execution request
export type TaskRequest = {
  stepId: string;
  stepType: 'agent' | 'tool';
  name: string; // Agent name or tool name
  input: unknown;
  context: {
    runId: string;
    parentStepId?: string;
    organizationId: string;
    depth: number;
  };
};

// Async polling request
export type AsyncPollRequest = {
  stepId: string;
  pollType: 'a2a_task' | 'webhook';
  pollUrl?: string;
  taskId?: string;
  nextPollDelay?: number; // MS until next poll
};

// Task execution result
export type TaskResult = {
  success: boolean;
  output?: unknown;
  error?: string;
  duration?: number;
  shouldRetry?: boolean;
};