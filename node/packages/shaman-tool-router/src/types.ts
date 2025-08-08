/**
 * Tool router types
 */

import type { Result } from '@codespin/shaman-core';
import type { RunData, AgentSource } from '@codespin/shaman-types';

/**
 * Tool execution context
 */
export type ToolExecutionContext = {
  readonly runId?: string;
  readonly stepId?: string;
  readonly taskId?: string;
  readonly agentName?: string;
  readonly agentSource?: AgentSource;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly jwtToken?: string;
};

/**
 * Platform tool types
 */
export type PlatformToolName = 
  | 'run_data_write'
  | 'run_data_read'
  | 'run_data_query'
  | 'run_data_list'
  | 'run_data_delete'
  | 'call_agent';

/**
 * Platform tool schemas
 */
export type PlatformToolSchemas = {
  run_data_write: {
    key: string;
    value: unknown;
    metadata?: {
      description?: string;
      schema?: string;
      ttl?: number;
    };
  };
  run_data_read: {
    key: string;
    includeMetadata?: boolean;
  };
  run_data_query: {
    pattern: string;
    limit?: number;
  };
  run_data_list: {
    filterByAgent?: string;
    prefix?: string;
    limit?: number;
  };
};

/**
 * Platform tool results
 */
export type PlatformToolResults = {
  run_data_write: void;
  run_data_read: RunData[];
  run_data_query: RunData[];
  run_data_list: Array<{
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
 * Tool with executable function
 */
export type Tool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    parse: (input: unknown) => unknown;
    parseAsync: (input: unknown) => Promise<unknown>;
  };
  readonly execute: (input: unknown) => Promise<unknown>;
};

/**
 * Tool definition (for metadata)
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
    createRunData: (data: Omit<RunData, 'id' | 'createdAt'>) => Promise<RunData>;
    getRunData: (runId: string, key: string) => Promise<RunData[]>;
    queryRunData: (runId: string, pattern: string, limit?: number) => Promise<RunData[]>;
    listRunDataKeys: (runId: string, filters?: { agentName?: string; prefix?: string }) => Promise<Array<{ key: string; count: number; agents: string[] }>>;
  };
  readonly mcpClient?: {
    callTool: (server: McpServerConnection, toolName: string, args: unknown) => Promise<Result<unknown>>;
    listTools: (server: McpServerConnection) => Promise<Result<ToolDefinition[]>>;
  };
};