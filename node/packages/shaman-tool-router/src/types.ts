/**
 * Tool router types
 */

import type { Result } from '@codespin/shaman-workflow-core';
import type { WorkflowData, AgentSource } from '@codespin/shaman-types';

/**
 * Tool execution context
 */
export type ToolExecutionContext = {
  readonly runId: string;
  readonly stepId: string;
  readonly agentName: string;
  readonly agentSource: AgentSource;
};

/**
 * Platform tool types
 */
export type PlatformToolName = 
  | 'workflow_data_write'
  | 'workflow_data_read'
  | 'workflow_data_query'
  | 'workflow_data_list';

/**
 * Platform tool schemas
 */
export type PlatformToolSchemas = {
  workflow_data_write: {
    key: string;
    value: unknown;
    metadata?: {
      description?: string;
      schema?: string;
      ttl?: number;
    };
  };
  workflow_data_read: {
    key: string;
    includeMetadata?: boolean;
  };
  workflow_data_query: {
    pattern: string;
    limit?: number;
  };
  workflow_data_list: {
    filterByAgent?: string;
    prefix?: string;
    limit?: number;
  };
};

/**
 * Platform tool results
 */
export type PlatformToolResults = {
  workflow_data_write: void;
  workflow_data_read: WorkflowData[];
  workflow_data_query: WorkflowData[];
  workflow_data_list: Array<{
    key: string;
    count: number;
    agents: string[];
  }>;
};

/**
 * Tool handler function
 */
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolExecutionContext
) => Promise<Result<TOutput>>;

/**
 * Tool definition
 */
export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
  readonly isPlatformTool: boolean;
};

/**
 * MCP server connection info
 */
export type McpServerConnection = {
  readonly name: string;
  readonly type: 'HTTP' | 'STDIO';
  readonly endpoint: string;
  readonly apiKey?: string;
};

/**
 * Tool router dependencies
 */
export type ToolRouterDependencies = {
  readonly persistenceLayer: {
    createWorkflowData: (data: Omit<WorkflowData, 'id' | 'createdAt'>) => Promise<WorkflowData>;
    getWorkflowData: (runId: string, key: string) => Promise<WorkflowData[]>;
    queryWorkflowData: (runId: string, pattern: string, limit?: number) => Promise<WorkflowData[]>;
    listWorkflowDataKeys: (runId: string, filters?: { agentName?: string; prefix?: string }) => Promise<Array<{ key: string; count: number; agents: string[] }>>;
  };
  readonly mcpClient?: {
    callTool: (server: McpServerConnection, toolName: string, args: unknown) => Promise<Result<unknown>>;
    listTools: (server: McpServerConnection) => Promise<Result<ToolDefinition[]>>;
  };
};