/**
 * packages/shaman-workflow-core/src/step-types.ts
 *
 * Step & Run data structures shared by adapters.
 */

import type { Step, Run, ExecutionState, WorkflowContext } from '@codespin/shaman-types';

/**
 * Step execution context passed to activities
 */
export type StepExecutionContext = {
  readonly runId: string;
  readonly stepId: string;
  readonly parentStepId?: string;
  readonly agentName: string;
  readonly depth: number;
  readonly workflowContext: WorkflowContext;
};

/**
 * Step update event for tracking
 */
export type StepUpdateEvent = {
  readonly stepId: string;
  readonly status: ExecutionState;
  readonly timestamp: Date;
  readonly error?: string;
  readonly metadata?: Record<string, unknown>;
};

/**
 * DAG status for workflow visualization
 */
export type DAGStatus = {
  readonly interactableSteps: readonly Step[];
  readonly blockedSteps: readonly Step[];
  readonly activeSteps: readonly Step[];
  readonly cancellableSubgraphs: readonly Step[][];
  readonly agentCallGraph: readonly Step[][];
};