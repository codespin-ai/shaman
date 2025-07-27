/**
 * Main tool router implementation
 */

import type { Result } from '@codespin/shaman-workflow-core';
import type {
  ToolExecutionContext,
  ToolDefinition,
  ToolRouterDependencies,
  McpServerConnection,
  PlatformToolName,
  PlatformToolSchemas,
  ToolHandler
} from './types.js';
import { createPlatformToolHandlers, PLATFORM_TOOL_DEFINITIONS, type PlatformToolHandlers } from './platform-tools.js';

/**
 * Tool router configuration
 */
export type ToolRouterConfig = {
  readonly mcpServers?: McpServerConnection[];
  readonly enablePlatformTools?: boolean;
};

/**
 * Tool execution result
 */
export type ToolExecutionResult = {
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly toolType: 'platform' | 'mcp' | 'agent';
};

/**
 * Create a tool router instance
 */
export function createToolRouter(
  config: ToolRouterConfig,
  dependencies: ToolRouterDependencies
) {
  const platformHandlers = config.enablePlatformTools !== false 
    ? createPlatformToolHandlers(dependencies)
    : {} as PlatformToolHandlers;

  return {
    /**
     * Execute a tool by name
     */
    async executeTool(
      toolName: string,
      args: unknown,
      context: ToolExecutionContext
    ): Promise<Result<ToolExecutionResult>> {
      // 1. Check if it's a platform tool
      if (isPlatformTool(toolName)) {
        const platformToolName = toolName as PlatformToolName;
        const handler = platformHandlers[platformToolName];
        if (!handler) {
          return {
            success: false,
            error: new Error(`Platform tool ${toolName} not found`)
          };
        }

        // Type-safe handler call - TypeScript can't infer the exact handler type
        // from the dynamic key lookup, so we need to help it
        const result = await (handler as ToolHandler<unknown, unknown>)(args, context);
        return {
          success: true,
          data: {
            success: result.success,
            output: result.success ? result.data : undefined,
            error: result.success ? undefined : result.error.message,
            toolType: 'platform'
          }
        };
      }

      // 2. Check if it's an agent call (tools starting with 'agent:')
      if (toolName.startsWith('agent:')) {
        const agentName = toolName.substring(6);
        return {
          success: true,
          data: {
            success: false,
            error: `Agent calls should be handled by workflow engine, not tool router`,
            toolType: 'agent'
          }
        };
      }

      // 3. Try MCP servers
      if (dependencies.mcpClient && config.mcpServers) {
        for (const server of config.mcpServers) {
          const tools = await dependencies.mcpClient.listTools(server);
          if (!tools.success) continue;

          const tool = tools.data.find(t => t.name === toolName);
          if (tool) {
            const result = await dependencies.mcpClient.callTool(server, toolName, args);
            return {
              success: true,
              data: {
                success: result.success,
                output: result.success ? result.data : undefined,
                error: result.success ? undefined : (result.error as Error).message,
                toolType: 'mcp'
              }
            };
          }
        }
      }

      // Tool not found
      return {
        success: false,
        error: new Error(`Tool ${toolName} not found in platform tools or MCP servers`)
      };
    },

    /**
     * List all available tools
     */
    async listTools(): Promise<Result<ToolDefinition[]>> {
      const tools: ToolDefinition[] = [];

      // Add platform tools
      if (config.enablePlatformTools !== false) {
        tools.push(...Object.values(PLATFORM_TOOL_DEFINITIONS));
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
     * Get tool definition by name
     */
    async getTool(toolName: string): Promise<Result<ToolDefinition | null>> {
      // Check platform tools
      if (isPlatformTool(toolName)) {
        const definition = PLATFORM_TOOL_DEFINITIONS[toolName as PlatformToolName];
        return { success: true, data: definition || null };
      }

      // Check MCP tools
      if (dependencies.mcpClient && config.mcpServers) {
        for (const server of config.mcpServers) {
          const tools = await dependencies.mcpClient.listTools(server);
          if (!tools.success) continue;

          const tool = tools.data.find(t => t.name === toolName);
          if (tool) {
            return { success: true, data: tool };
          }
        }
      }

      return { success: true, data: null };
    },

    /**
     * Check if a tool exists
     */
    async hasTool(toolName: string): Promise<boolean> {
      const result = await this.getTool(toolName);
      return result.success && result.data !== null;
    }
  };
}

/**
 * Check if a tool name is a platform tool
 */
function isPlatformTool(toolName: string): toolName is PlatformToolName {
  return toolName in PLATFORM_TOOL_DEFINITIONS;
}

/**
 * Tool router type
 */
export type ToolRouter = ReturnType<typeof createToolRouter>;