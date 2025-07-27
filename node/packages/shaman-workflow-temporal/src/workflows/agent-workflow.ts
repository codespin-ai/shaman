/**
 * Temporal workflow definitions for agent execution
 */

import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  sleep,
  workflowInfo,
  ApplicationFailure
} from '@temporalio/workflow';
import type { AgentExecutionRequest, AgentExecutionResult } from '@codespin/shaman-workflow-core';
import type { WorkflowContext, ExecutionState } from '@codespin/shaman-types';
import type * as activities from '../activities/index.js';

// Import activity types
const { executeAgentActivity, createStep, updateStep, logEvent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
});

// Signal definitions
export const userInputSignal = defineSignal<[{ inputRequestId: string; response: string }]>('userInput');

// Workflow state
let pendingInputRequests = new Map<string, { resolve: (value: string) => void }>();

/**
 * Main agent workflow
 */
export async function agentWorkflow(request: {
  agentName: string;
  input: string;
  userId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ runId: string; result: string; status: ExecutionState }> {
  const { workflowId: runId } = workflowInfo();
  
  // Initialize workflow context
  const context: WorkflowContext = {
    runId,
    memory: new Map(),
    results: {
      intermediate: new Map(),
      final: undefined
    }
  };

  // Handle user input signals
  setHandler(userInputSignal, ({ inputRequestId, response }) => {
    const request = pendingInputRequests.get(inputRequestId);
    if (request) {
      request.resolve(response);
      pendingInputRequests.delete(inputRequestId);
    }
  });

  try {
    // Execute the root agent as a child workflow
    const result = await executeAgentWorkflow({
      agentName: request.agentName,
      agentSource: 'GIT', // Will be determined by agent resolver
      input: request.input,
      context,
      contextScope: 'FULL',
      depth: 0
    });

    return {
      runId,
      result: result.output,
      status: result.status
    };
  } catch (error) {
    throw ApplicationFailure.fromError(error);
  }
}

/**
 * Child workflow for agent execution
 */
export async function executeAgentWorkflow(
  request: AgentExecutionRequest
): Promise<AgentExecutionResult> {
  const { workflowId: stepId } = workflowInfo();

  // Create step record
  await createStep({
    stepId,
    runId: request.context.runId,
    parentStepId: request.parentStepId,
    agentName: request.agentName,
    agentSource: request.agentSource,
    input: request.input,
    status: 'WORKING',
    type: 'agent_execution',
    depth: request.depth
  });

  try {
    // Execute agent activity
    const result = await executeAgentActivity(request);

    // Update step with result
    await updateStep({
      stepId,
      status: result.status,
      output: result.output,
      endTime: new Date()
    });

    return result;
  } catch (error) {
    // Update step with error
    await updateStep({
      stepId,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
      endTime: new Date()
    });
    throw error;
  }
}

/**
 * Wait for user input with timeout
 */
export async function waitForUserInput(
  inputRequestId: string,
  timeoutMs: number = 300000 // 5 minutes default
): Promise<string> {
  return Promise.race([
    new Promise<string>((resolve) => {
      pendingInputRequests.set(inputRequestId, { resolve });
    }),
    sleep(timeoutMs).then(() => {
      pendingInputRequests.delete(inputRequestId);
      throw new Error('Input request timed out');
    })
  ]);
}