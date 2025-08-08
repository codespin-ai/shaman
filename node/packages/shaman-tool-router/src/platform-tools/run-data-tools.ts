/**
 * Platform tools for managing run data via Foreman
 */

import { z } from 'zod';
import { 
  createRunData, 
  queryRunData, 
  deleteRunData,
  type ForemanConfig 
} from '@codespin/foreman-client';
import { createLogger } from '@codespin/shaman-logger';
import type { Tool, ToolExecutionContext } from '../types.js';

const logger = createLogger('RunDataTools');

/**
 * Create run_data_write tool
 */
export function createRunDataWriteTool(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext
): Tool {
  return {
    name: 'run_data_write',
    description: 'Store data for agent collaboration within the current workflow run',
    inputSchema: z.object({
      key: z.string().describe('Unique key for the data within this run'),
      value: z.unknown().describe('Data to store (can be any JSON-serializable value)'),
      tags: z.array(z.string()).optional().describe('Optional tags for categorizing and querying data')
    }),
    async execute(input) {
      const { key, value, tags = [] } = input as {
        key: string;
        value: unknown;
        tags?: string[];
      };

      if (!context.runId) {
        throw new Error('No run context available for run_data_write');
      }

      logger.info('Writing run data', { 
        runId: context.runId, 
        key,
        tags 
      });

      // Add context tags
      const allTags = [
        ...tags,
        `agent:${context.agentName || 'unknown'}`,
        `step:${context.stepId || 'unknown'}`
      ];

      const result = await createRunData(foremanConfig, context.runId, {
        taskId: context.taskId || '',
        key,
        value,
        tags: allTags
      });

      if (!result.success) {
        throw new Error(`Failed to write run data: ${result.error.message}`);
      }

      return {
        success: true,
        key,
        id: result.data.id
      };
    }
  };
}

/**
 * Create run_data_read tool
 */
export function createRunDataReadTool(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext
): Tool {
  return {
    name: 'run_data_read',
    description: 'Read specific data by key from the current workflow run',
    inputSchema: z.object({
      key: z.string().describe('Key of the data to retrieve')
    }),
    async execute(input) {
      const { key } = input as { key: string };

      if (!context.runId) {
        throw new Error('No run context available for run_data_read');
      }

      logger.info('Reading run data', { 
        runId: context.runId, 
        key 
      });

      const result = await queryRunData(foremanConfig, context.runId, {
        key,
        limit: 1
      });

      if (!result.success) {
        throw new Error(`Failed to read run data: ${result.error.message}`);
      }

      if (result.data.data.length === 0) {
        return {
          success: false,
          error: `No data found for key: ${key}`
        };
      }

      return {
        success: true,
        key,
        value: result.data.data[0].value,
        metadata: {
          createdAt: result.data.data[0].createdAt,
          taskId: result.data.data[0].taskId,
          tags: result.data.data[0].tags
        }
      };
    }
  };
}

/**
 * Create run_data_query tool
 */
export function createRunDataQueryTool(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext
): Tool {
  return {
    name: 'run_data_query',
    description: 'Query run data by patterns, tags, or other criteria',
    inputSchema: z.object({
      keyStartsWith: z.string().optional().describe('Filter by key prefix'),
      tags: z.array(z.string()).optional().describe('Filter by tags (AND condition)'),
      anyTags: z.array(z.string()).optional().describe('Filter by tags (OR condition)'),
      limit: z.number().optional().default(10).describe('Maximum number of results'),
      sortBy: z.enum(['created_at', 'updated_at']).optional().default('created_at'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
    }),
    async execute(input) {
      const params = input as {
        keyStartsWith?: string;
        tags?: string[];
        anyTags?: string[];
        limit?: number;
        sortBy?: 'created_at' | 'updated_at';
        sortOrder?: 'asc' | 'desc';
      };

      if (!context.runId) {
        throw new Error('No run context available for run_data_query');
      }

      logger.info('Querying run data', { 
        runId: context.runId, 
        params 
      });

      const result = await queryRunData(foremanConfig, context.runId, {
        keyStartsWith: params.keyStartsWith ? [params.keyStartsWith] : undefined,
        tags: params.tags,
        limit: params.limit
      });

      if (!result.success) {
        throw new Error(`Failed to query run data: ${result.error.message}`);
      }

      return {
        success: true,
        count: result.data.data.length,
        data: result.data.data.map(item => ({
          key: item.key,
          value: item.value,
          tags: item.tags,
          createdAt: item.createdAt,
          taskId: item.taskId
        })),
        pagination: result.data.pagination
      };
    }
  };
}

/**
 * Create run_data_list tool
 */
export function createRunDataListTool(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext
): Tool {
  return {
    name: 'run_data_list',
    description: 'List all data stored in the current workflow run',
    inputSchema: z.object({
      limit: z.number().optional().default(100).describe('Maximum number of results'),
      offset: z.number().optional().default(0).describe('Number of results to skip')
    }),
    async execute(input) {
      const { limit = 100, offset = 0 } = input as {
        limit?: number;
        offset?: number;
      };

      if (!context.runId) {
        throw new Error('No run context available for run_data_list');
      }

      logger.info('Listing all run data', { 
        runId: context.runId,
        limit,
        offset
      });

      const result = await queryRunData(foremanConfig, context.runId, {
        limit,
        offset,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });

      if (!result.success) {
        throw new Error(`Failed to list run data: ${result.error.message}`);
      }

      return {
        success: true,
        count: result.data.data.length,
        totalCount: result.data.pagination?.total,
        data: result.data.data.map(item => ({
          key: item.key,
          value: item.value,
          tags: item.tags,
          createdAt: item.createdAt,
          taskId: item.taskId
        }))
      };
    }
  };
}

/**
 * Create run_data_delete tool
 */
export function createRunDataDeleteTool(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext
): Tool {
  return {
    name: 'run_data_delete',
    description: 'Delete specific data by key from the current workflow run',
    inputSchema: z.object({
      key: z.string().describe('Key of the data to delete')
    }),
    async execute(input) {
      const { key } = input as { key: string };

      if (!context.runId) {
        throw new Error('No run context available for run_data_delete');
      }

      logger.info('Deleting run data', { 
        runId: context.runId, 
        key 
      });

      const result = await deleteRunData(foremanConfig, context.runId, { key });

      if (!result.success) {
        throw new Error(`Failed to delete run data: ${result.error.message}`);
      }

      return {
        success: true,
        deleted: result.data.deleted
      };
    }
  };
}

/**
 * Create all run data tools
 */
export function createRunDataTools(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext
): Tool[] {
  return [
    createRunDataWriteTool(foremanConfig, context),
    createRunDataReadTool(foremanConfig, context),
    createRunDataQueryTool(foremanConfig, context),
    createRunDataListTool(foremanConfig, context),
    createRunDataDeleteTool(foremanConfig, context)
  ];
}