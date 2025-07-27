/**
 * Platform tool implementations
 */

import type { Result } from '@codespin/shaman-workflow-core';
import type { WorkflowData } from '@codespin/shaman-types';
import type {
  ToolHandler,
  ToolExecutionContext,
  PlatformToolSchemas,
  PlatformToolResults,
  ToolRouterDependencies
} from './types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create platform tool handlers
 */
export function createPlatformToolHandlers(
  deps: ToolRouterDependencies
): Record<keyof PlatformToolSchemas, ToolHandler<any, any>> {
  return {
    workflow_data_write: createWorkflowDataWriteHandler(deps),
    workflow_data_read: createWorkflowDataReadHandler(deps),
    workflow_data_query: createWorkflowDataQueryHandler(deps),
    workflow_data_list: createWorkflowDataListHandler(deps)
  };
}

/**
 * workflow_data_write handler
 */
function createWorkflowDataWriteHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['workflow_data_write'], void> {
  return async (input, context) => {
    try {
      const workflowData: Omit<WorkflowData, 'id' | 'createdAt'> = {
        runId: context.runId,
        key: input.key,
        value: input.value,
        createdByStepId: context.stepId,
        createdByAgentName: context.agentName,
        createdByAgentSource: context.agentSource
      };

      await deps.persistenceLayer.createWorkflowData(workflowData);
      
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to write workflow data')
      };
    }
  };
}

/**
 * workflow_data_read handler
 */
function createWorkflowDataReadHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['workflow_data_read'], PlatformToolResults['workflow_data_read']> {
  return async (input, context) => {
    try {
      const data = await deps.persistenceLayer.getWorkflowData(
        context.runId,
        input.key
      );
      
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to read workflow data')
      };
    }
  };
}

/**
 * workflow_data_query handler
 */
function createWorkflowDataQueryHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['workflow_data_query'], PlatformToolResults['workflow_data_query']> {
  return async (input, context) => {
    try {
      const data = await deps.persistenceLayer.queryWorkflowData(
        context.runId,
        input.pattern,
        input.limit
      );
      
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to query workflow data')
      };
    }
  };
}

/**
 * workflow_data_list handler
 */
function createWorkflowDataListHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['workflow_data_list'], PlatformToolResults['workflow_data_list']> {
  return async (input, context) => {
    try {
      const keys = await deps.persistenceLayer.listWorkflowDataKeys(
        context.runId,
        {
          agentName: input.filterByAgent,
          prefix: input.prefix
        }
      );
      
      // Apply limit if specified
      const limitedKeys = input.limit ? keys.slice(0, input.limit) : keys;
      
      return { success: true, data: limitedKeys };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to list workflow data')
      };
    }
  };
}

/**
 * Platform tool definitions
 */
export const PLATFORM_TOOL_DEFINITIONS = {
  workflow_data_write: {
    name: 'workflow_data_write',
    description: 'Write data to workflow storage for sharing between agents',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to store the data under' },
        value: { description: 'Value to store (any JSON-serializable data)' },
        metadata: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            schema: { type: 'string' },
            ttl: { type: 'number', description: 'Time to live in seconds' }
          }
        }
      },
      required: ['key', 'value']
    },
    isPlatformTool: true
  },
  workflow_data_read: {
    name: 'workflow_data_read',
    description: 'Read data from workflow storage by key',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to read data from' },
        includeMetadata: { type: 'boolean', description: 'Include metadata in response' }
      },
      required: ['key']
    },
    isPlatformTool: true
  },
  workflow_data_query: {
    name: 'workflow_data_query',
    description: 'Query workflow data using pattern matching',
    schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Pattern to match keys (supports * and ? wildcards)' },
        limit: { type: 'number', description: 'Maximum number of results' }
      },
      required: ['pattern']
    },
    isPlatformTool: true
  },
  workflow_data_list: {
    name: 'workflow_data_list',
    description: 'List all workflow data keys with optional filtering',
    schema: {
      type: 'object',
      properties: {
        filterByAgent: { type: 'string', description: 'Filter by agent name' },
        prefix: { type: 'string', description: 'Filter by key prefix' },
        limit: { type: 'number', description: 'Maximum number of results' }
      }
    },
    isPlatformTool: true
  }
};