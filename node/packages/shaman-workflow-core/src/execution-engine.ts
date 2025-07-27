/**
 * packages/shaman-workflow-core/src/execution-engine.ts
 *
 * ExecutionEngine interface - abstracts workflow engine implementations.
 */

import type { ExecutionState, Run, Step, InputRequest, WorkflowContext } from '@codespin/shaman-types';
import type { Result } from './result.js';

/**
 * Workflow metadata for UI visibility
 */
export type WorkflowMetadata = {
  readonly runId: string;
  readonly agentName: string;
  readonly status: ExecutionState;
  readonly currentActivity?: {
    readonly agentName: string;
    readonly depth: number;
  };
  readonly pendingInput?: {
    readonly prompt: string;
    readonly requestId: string;
  };
};

/**
 * Agent execution request
 */
export type AgentExecutionRequest = {
  readonly agentName: string;
  readonly agentSource: 'GIT' | 'A2A_EXTERNAL';
  readonly input: string;
  readonly context: WorkflowContext;
  readonly contextScope: 'FULL' | 'NONE' | 'SPECIFIC';
  readonly parentStepId?: string;
  readonly depth: number;
};

/**
 * Agent execution result
 */
export type AgentExecutionResult = {
  readonly stepId: string;
  readonly output: string;
  readonly status: ExecutionState;
  readonly childStepIds: readonly string[];
  readonly metadata?: Record<string, unknown>;
};

/**
 * Workflow engine abstraction
 */
export interface ExecutionEngine {
  /**
   * Start a new workflow run
   */
  startRun(
    request: {
      readonly agentName: string;
      readonly input: string;
      readonly userId: string;
      readonly metadata?: Record<string, unknown>;
    }
  ): Promise<Result<Run>>;

  /**
   * Execute an agent as an activity/child workflow
   */
  executeAgent(
    request: AgentExecutionRequest
  ): Promise<Result<AgentExecutionResult>>;

  /**
   * Send a signal to a workflow (e.g., user input)
   */
  sendSignal(
    runId: string,
    signal: {
      readonly type: 'USER_INPUT';
      readonly inputRequestId: string;
      readonly response: string;
    }
  ): Promise<Result<void>>;

  /**
   * Get workflow metadata for UI
   */
  getWorkflowMetadata(
    runId: string
  ): Promise<Result<WorkflowMetadata>>;

  /**
   * Cancel a workflow or specific step
   */
  cancel(
    target: { readonly runId: string } | { readonly stepId: string },
    reason?: string
  ): Promise<Result<void>>;

  /**
   * Wait for a condition (used for input requests)
   */
  waitForCondition(
    condition: {
      readonly type: 'INPUT_RESPONSE';
      readonly inputRequestId: string;
      readonly timeoutMs?: number;
    }
  ): Promise<Result<string>>;

  /**
   * Log an event (tool calls, LLM calls, etc.)
   */
  logEvent(
    stepId: string,
    event: {
      readonly type: 'TOOL_CALL' | 'LLM_CALL' | 'LOG';
      readonly data: Record<string, unknown>;
      readonly timestamp: Date;
    }
  ): Promise<Result<void>>;
}

/**
 * Factory function type for creating engine instances
 */
export type CreateExecutionEngine = (
  config: Record<string, unknown>
) => Promise<Result<ExecutionEngine>>;