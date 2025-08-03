/**
 * Platform tool implementations
 */

import type { RunData } from '@codespin/shaman-types';
import type {
  ToolHandler,
  PlatformToolSchemas,
  PlatformToolResults,
  ToolRouterDependencies
} from './types.js';


/**
 * Create platform tool handlers
 */
export type PlatformToolHandlers = {
  [K in keyof PlatformToolSchemas]: ToolHandler<PlatformToolSchemas[K], PlatformToolResults[K]>
};

export function createPlatformToolHandlers(
  deps: ToolRouterDependencies
): PlatformToolHandlers {
  return {
    run_data_write: createRunDataWriteHandler(deps),
    run_data_read: createRunDataReadHandler(deps),
    run_data_query: createRunDataQueryHandler(deps),
    run_data_list: createRunDataListHandler(deps)
  };
}

/**
 * run_data_write handler
 */
function createRunDataWriteHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['run_data_write'], void> {
  return async (input, context) => {
    try {
      const workflowData: Omit<RunData, 'id' | 'createdAt'> = {
        runId: context.runId,
        key: input.key,
        value: input.value,
        createdByStepId: context.stepId,
        createdByAgentName: context.agentName,
        createdByAgentSource: context.agentSource
      };

      await deps.persistenceLayer.createRunData(workflowData);
      
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to write run data')
      };
    }
  };
}

/**
 * run_data_read handler
 */
function createRunDataReadHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['run_data_read'], PlatformToolResults['run_data_read']> {
  return async (input, context) => {
    try {
      const data = await deps.persistenceLayer.getRunData(
        context.runId,
        input.key
      );
      
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to read run data')
      };
    }
  };
}

/**
 * run_data_query handler
 */
function createRunDataQueryHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['run_data_query'], PlatformToolResults['run_data_query']> {
  return async (input, context) => {
    try {
      const data = await deps.persistenceLayer.queryRunData(
        context.runId,
        input.pattern,
        input.limit
      );
      
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to query run data')
      };
    }
  };
}

/**
 * run_data_list handler
 */
function createRunDataListHandler(
  deps: ToolRouterDependencies
): ToolHandler<PlatformToolSchemas['run_data_list'], PlatformToolResults['run_data_list']> {
  return async (input, context) => {
    try {
      const keys = await deps.persistenceLayer.listRunDataKeys(
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
        error: error instanceof Error ? error : new Error('Failed to list run data')
      };
    }
  };
}

/**
 * Platform tool definitions
 */
export const PLATFORM_TOOL_DEFINITIONS = {
  run_data_write: {
    name: 'run_data_write',
    description: 'Write data to run storage for sharing between agents',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to store the data under' },
        value: { type: 'unknown', description: 'Value to store (JSON-serializable data)' },
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
  run_data_read: {
    name: 'run_data_read',
    description: 'Read data from run storage by key',
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
  run_data_query: {
    name: 'run_data_query',
    description: 'Query run data using pattern matching',
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
  run_data_list: {
    name: 'run_data_list',
    description: 'List all run data keys with optional filtering',
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