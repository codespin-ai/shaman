/**
 * Main tool router implementation
 */

import type { Result } from "@codespin/shaman-core";
import type { ForemanConfig } from "@codespin/foreman-client";
import type {
  ToolExecutionContext,
  ToolDefinition,
  ToolRouterDependencies,
  McpServerConnection,
} from "./types.js";
import {
  createPlatformTools,
  getPlatformTool,
  isPlatformTool,
  type PlatformToolName,
} from "./platform-tools.js";

/**
 * Tool router configuration
 */
export type ToolRouterConfig = {
  readonly mcpServers?: McpServerConnection[];
  readonly enablePlatformTools?: boolean;
  readonly foremanConfig?: ForemanConfig;
  readonly internalA2AUrl?: string;
  readonly jwtToken?: string;
};

/**
 * Tool execution result
 */
export type ToolExecutionResult = {
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly toolType: "platform" | "mcp" | "agent";
};

/**
 * Tool router interface
 */
export interface ToolRouter {
  executeTool(
    toolName: string,
    args: unknown,
    context: ToolExecutionContext,
  ): Promise<Result<ToolExecutionResult>>;
  listTools(): Promise<Result<ToolDefinition[]>>;
  getTool(toolName: string): Promise<Result<ToolDefinition | null>>;
  hasTool(toolName: string): Promise<boolean>;
}

/**
 * Create a tool router instance
 */
export function createToolRouter(
  config: ToolRouterConfig,
  dependencies: ToolRouterDependencies,
): ToolRouter {
  async function getTool(
    toolName: string,
    _context?: ToolExecutionContext,
  ): Promise<Result<ToolDefinition | null>> {
    // Check platform tools
    if (isPlatformTool(toolName)) {
      const definition = PLATFORM_TOOL_DEFINITIONS[toolName];
      return { success: true, data: definition || null };
    }

    // Check MCP tools
    if (dependencies.mcpClient && config.mcpServers) {
      for (const server of config.mcpServers) {
        const tools = await dependencies.mcpClient.listTools(server);
        if (!tools.success) continue;

        const tool = tools.data.find(
          (t: ToolDefinition) => t.name === toolName,
        );
        if (tool) {
          return { success: true, data: tool };
        }
      }
    }

    return { success: true, data: null };
  }

  const router: ToolRouter = {
    /**
     * Execute a tool by name
     */
    async executeTool(
      toolName: string,
      args: unknown,
      context: ToolExecutionContext,
    ): Promise<Result<ToolExecutionResult>> {
      // 1. Check if it's a platform tool
      if (isPlatformTool(toolName) && config.foremanConfig) {
        const tool = getPlatformTool(toolName, config.foremanConfig, context, {
          internalA2AUrl: config.internalA2AUrl,
          jwtToken: config.jwtToken,
        });

        if (!tool) {
          return {
            success: false,
            error: new Error(`Platform tool ${toolName} not found`),
          };
        }

        try {
          const result = await tool.execute(args);
          return {
            success: true,
            data: {
              success: true,
              output: result,
              toolType: "platform",
            },
          };
        } catch (error) {
          return {
            success: true,
            data: {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              toolType: "platform",
            },
          };
        }
      }

      // 2. Check if it's an agent call (tools starting with 'agent:')
      if (toolName.startsWith("agent:")) {
        return {
          success: true,
          data: {
            success: false,
            error: `Agent calls should be handled by workflow engine, not tool router`,
            toolType: "agent",
          },
        };
      }

      // 3. Try MCP servers
      if (dependencies.mcpClient && config.mcpServers) {
        for (const server of config.mcpServers) {
          const tools = await dependencies.mcpClient.listTools(server);
          if (!tools.success) continue;

          const tool = tools.data.find(
            (t: ToolDefinition) => t.name === toolName,
          );
          if (tool) {
            const result = await dependencies.mcpClient.callTool(
              server,
              toolName,
              args,
            );
            return {
              success: true,
              data: {
                success: result.success,
                output: result.success ? result.data : undefined,
                error: result.success ? undefined : result.error.message,
                toolType: "mcp",
              },
            };
          }
        }
      }

      // Tool not found
      return {
        success: false,
        error: new Error(
          `Tool ${toolName} not found in platform tools or MCP servers`,
        ),
      };
    },

    /**
     * List all available tools
     */
    async listTools(
      context?: ToolExecutionContext,
    ): Promise<Result<ToolDefinition[]>> {
      const tools: ToolDefinition[] = [];

      // Add platform tools
      if (
        config.enablePlatformTools !== false &&
        config.foremanConfig &&
        context
      ) {
        const platformTools = createPlatformTools(
          config.foremanConfig,
          context,
          {
            internalA2AUrl: config.internalA2AUrl,
            jwtToken: config.jwtToken,
          },
        );

        // Convert Tool to ToolDefinition format
        tools.push(
          ...platformTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            schema: {}, // Would need to convert Zod schema to JSON schema here
            isPlatformTool: true,
          })),
        );
      }

      // Add MCP tools
      if (dependencies.mcpClient && config.mcpServers) {
        for (const server of config.mcpServers) {
          const serverTools = await dependencies.mcpClient.listTools(server);
          if (serverTools.success) {
            tools.push(...serverTools.data);
          }
        }
      }

      return { success: true, data: tools };
    },

    /**
     * Get tool by name
     */
    getTool: (toolName: string) => getTool(toolName),

    /**
     * Check if a tool exists
     */
    async hasTool(toolName: string): Promise<boolean> {
      const result = await getTool(toolName);
      return result.success && result.data !== null;
    },
  };

  return router;
}

/**
 * Get platform tool definitions (static metadata without implementation)
 */
export const PLATFORM_TOOL_DEFINITIONS: Record<
  PlatformToolName,
  ToolDefinition
> = {
  run_data_write: {
    name: "run_data_write",
    description:
      "Store data for agent collaboration within the current workflow run",
    schema: {},
    isPlatformTool: true,
  },
  run_data_read: {
    name: "run_data_read",
    description: "Read specific data by key from the current workflow run",
    schema: {},
    isPlatformTool: true,
  },
  run_data_query: {
    name: "run_data_query",
    description: "Query run data by patterns, tags, or other criteria",
    schema: {},
    isPlatformTool: true,
  },
  run_data_list: {
    name: "run_data_list",
    description: "List all data stored in the current workflow run",
    schema: {},
    isPlatformTool: true,
  },
  run_data_delete: {
    name: "run_data_delete",
    description: "Delete specific data by key from the current workflow run",
    schema: {},
    isPlatformTool: true,
  },
  call_agent: {
    name: "call_agent",
    description: "Call another agent via A2A protocol",
    schema: {},
    isPlatformTool: true,
  },
};
