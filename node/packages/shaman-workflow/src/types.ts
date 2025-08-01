/**
 * Types for workflow engine
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

// Step execution request
export type StepRequest = {
  stepId: string;
  stepType: 'agent' | 'tool';
  name: string; // Agent name or tool name
  input: any;
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

// Step execution result
export type StepResult = {
  success: boolean;
  output?: any;
  error?: string;
  duration?: number;
  shouldRetry?: boolean;
};