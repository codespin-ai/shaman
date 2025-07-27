/**
 * Temporal activities for agent execution
 */

import type { AgentExecutionRequest, AgentExecutionResult } from '@codespin/shaman-workflow-core';
import type { Step, ExecutionState } from '@codespin/shaman-types';

// These will be injected by the worker
let agentExecutor: ((request: AgentExecutionRequest) => Promise<AgentExecutionResult>) | undefined;
let stepRepository: {
  create: (step: Partial<Step>) => Promise<Step>;
  update: (stepId: string, updates: Partial<Step>) => Promise<Step>;
} | undefined;

/**
 * Initialize activities with dependencies
 */
export function initializeActivities(deps: {
  agentExecutor: (request: AgentExecutionRequest) => Promise<AgentExecutionResult>;
  stepRepository: {
    create: (step: Partial<Step>) => Promise<Step>;
    update: (stepId: string, updates: Partial<Step>) => Promise<Step>;
  };
}): void {
  agentExecutor = deps.agentExecutor;
  stepRepository = deps.stepRepository;
}

/**
 * Execute an agent
 */
export async function executeAgentActivity(
  request: AgentExecutionRequest
): Promise<AgentExecutionResult> {
  if (!agentExecutor) {
    throw new Error('Agent executor not initialized');
  }
  
  // This is where the actual agent execution happens
  // It will use the agent resolver, LLM provider, tool router, etc.
  return agentExecutor(request);
}

/**
 * Create a step record
 */
export async function createStep(step: {
  stepId: string;
  runId: string;
  parentStepId?: string;
  agentName: string;
  agentSource: string;
  input: string;
  status: ExecutionState;
  type: string;
  depth: number;
}): Promise<void> {
  if (!stepRepository) {
    throw new Error('Step repository not initialized');
  }
  
  await stepRepository.create({
    id: step.stepId,
    runId: step.runId,
    parentStepId: step.parentStepId,
    agentName: step.agentName,
    agentSource: step.agentSource as any,
    input: step.input,
    status: step.status,
    type: step.type as any,
    startTime: new Date()
  });
}

/**
 * Update a step record
 */
export async function updateStep(update: {
  stepId: string;
  status?: ExecutionState;
  output?: string;
  error?: string;
  endTime?: Date;
}): Promise<void> {
  if (!stepRepository) {
    throw new Error('Step repository not initialized');
  }
  
  await stepRepository.update(update.stepId, {
    status: update.status,
    output: update.output,
    error: update.error,
    endTime: update.endTime,
    duration: update.endTime ? undefined : undefined // Will be calculated
  });
}

/**
 * Log an event (tool calls, LLM calls, etc.)
 */
export async function logEvent(event: {
  stepId: string;
  type: 'TOOL_CALL' | 'LLM_CALL' | 'LOG';
  data: Record<string, unknown>;
  timestamp: Date;
}): Promise<void> {
  // For now, we'll just log to console
  // Later this will write to a proper event store
  console.log('Workflow event:', event);
}