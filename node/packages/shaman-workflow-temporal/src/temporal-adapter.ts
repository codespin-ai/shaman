/**
 * packages/shaman-workflow-temporal/src/temporal-adapter.ts
 *
 * ExecutionEngine implementation backed by Temporal.
 */


import { Connection, WorkflowClient } from '@temporalio/client';
import type {
  ExecutionEngine,
  WorkflowMetadata,
  AgentExecutionRequest,
  AgentExecutionResult,
  Result
} from '@codespin/shaman-workflow-core';
import type { Run, ExecutionState } from '@codespin/shaman-types';
import { agentWorkflow, executeAgentWorkflow, userInputSignal } from './workflows/agent-workflow.js';
import { v4 as uuidv4 } from 'uuid';

export type TemporalConfig = {
  connection: {
    address: string;
    namespace?: string;
  };
  taskQueue: string;
};

/**
 * Temporal implementation of ExecutionEngine
 */
export function createTemporalEngine(config: TemporalConfig): ExecutionEngine {
  let client: WorkflowClient;
  let initialized = false;

  // Lazy initialization
  async function ensureClient(): Promise<WorkflowClient> {
    if (!initialized) {
      const connection = await Connection.connect(config.connection);
      client = new WorkflowClient({
        connection,
        namespace: config.connection.namespace || 'default',
      });
      initialized = true;
    }
    return client;
  }

  return {
    async startRun(request): Promise<Result<Run>> {
      try {
        const client = await ensureClient();
        const runId = `run-${uuidv4()}`;
        
        // Start the workflow
        await client.start(agentWorkflow, {
          taskQueue: config.taskQueue,
          workflowId: runId,
          args: [request],
        });

        const run: Run = {
          id: runId,
          status: 'WORKING',
          initialInput: request.input,
          totalCost: 0,
          startTime: new Date(),
          createdBy: request.userId,
          metadata: request.metadata
        };

        return { success: true, data: run };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to start workflow')
        };
      }
    },

    async executeAgent(request: AgentExecutionRequest): Promise<Result<AgentExecutionResult>> {
      try {
        const client = await ensureClient();
        const stepId = `step-${uuidv4()}`;
        
        // Start child workflow for agent execution
        const handle = await client.start(executeAgentWorkflow, {
          taskQueue: config.taskQueue,
          workflowId: stepId,
          args: [request]
        });

        // Wait for completion
        const result = await handle.result();
        
        return { success: true, data: result };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to execute agent')
        };
      }
    },

    async sendSignal(runId: string, signal): Promise<Result<void>> {
      try {
        const client = await ensureClient();
        const handle = client.getHandle(runId);
        
        if (signal.type === 'USER_INPUT') {
          await handle.signal(userInputSignal, {
            inputRequestId: signal.inputRequestId,
            response: signal.response
          });
        }
        
        return { success: true, data: undefined };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to send signal')
        };
      }
    },

    async getWorkflowMetadata(runId: string): Promise<Result<WorkflowMetadata>> {
      try {
        const client = await ensureClient();
        const handle = client.getHandle(runId);
        const description = await handle.describe();
        
        const metadata: WorkflowMetadata = {
          runId,
          agentName: '', // Would need to be stored in workflow state
          status: mapTemporalStatus(description.status.code),
          // Additional fields would come from workflow query
        };
        
        return { success: true, data: metadata };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to get workflow metadata')
        };
      }
    },

    async cancel(target, _reason): Promise<Result<void>> {
      try {
        const client = await ensureClient();
        
        if ('runId' in target) {
          const handle = client.getHandle(target.runId);
          await handle.cancel();
        } else {
          // For step cancellation, we'd need to implement a different mechanism
          // Temporal doesn't directly support canceling individual activities
          return { 
            success: false, 
            error: new Error('Step-level cancellation not implemented')
          };
        }
        
        return { success: true, data: undefined };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error('Failed to cancel')
        };
      }
    },

    waitForCondition(_condition): Promise<Result<string>> {
      // This is implemented within the workflow using signals
      // The workflow handles the waiting logic
      return Promise.resolve({ 
        success: false, 
        error: new Error('waitForCondition should be called from within workflow')
      });
    },

    logEvent(stepId: string, event): Promise<Result<void>> {
      // For now, just log to console
      // In production, this would write to an event store
      console.error(`Event for step ${stepId}:`, event);
      return Promise.resolve({ success: true, data: undefined });
    }
  };
}

/**
 * Map Temporal workflow status to our ExecutionState
 */
function mapTemporalStatus(code: number): ExecutionState {
  // Temporal WorkflowExecutionStatus codes
  switch (code) {
    case 1: return 'WORKING'; // RUNNING
    case 2: return 'COMPLETED'; // COMPLETED
    case 3: return 'FAILED'; // FAILED
    case 4: return 'CANCELED'; // CANCELED
    case 5: return 'REJECTED'; // TERMINATED
    case 6: return 'WORKING'; // CONTINUED_AS_NEW
    case 7: return 'FAILED'; // TIMED_OUT
    default: return 'WORKING';
  }
}

// Export factory function
export const createExecutionEngine: (config: TemporalConfig) => Promise<Result<ExecutionEngine>> = 
  (config) => {
    try {
      const engine = createTemporalEngine(config);
      return Promise.resolve({ success: true, data: engine });
    } catch (error) {
      return Promise.resolve({ 
        success: false, 
        error: error instanceof Error ? error : new Error('Failed to create Temporal engine')
      });
    }
  };