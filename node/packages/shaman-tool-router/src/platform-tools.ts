/**
 * Platform tool exports and utilities
 */

import type { ForemanConfig } from '@codespin/foreman-client';
import type { Tool, ToolExecutionContext } from './types.js';
import { createPlatformTools as createTools } from './platform-tools/index.js';

export { 
  createRunDataTools,
  createCallAgentTool 
} from './platform-tools/index.js';

// Re-export createPlatformTools
export const createPlatformTools = createTools;

/**
 * Platform tool names
 */
export const PLATFORM_TOOL_NAMES = [
  'run_data_write',
  'run_data_read',
  'run_data_query',
  'run_data_list',
  'run_data_delete',
  'call_agent'
] as const;

export type PlatformToolName = typeof PLATFORM_TOOL_NAMES[number];

/**
 * Check if a tool name is a platform tool
 */
export function isPlatformTool(name: string): name is PlatformToolName {
  return PLATFORM_TOOL_NAMES.includes(name as PlatformToolName);
}

/**
 * Get platform tool by name
 */
export function getPlatformTool(
  name: string,
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext,
  options: {
    internalA2AUrl?: string;
    jwtToken?: string;
  } = {}
): Tool | undefined {
  if (!isPlatformTool(name)) {
    return undefined;
  }
  
  const tools = createTools(foremanConfig, context, options);
  return tools.find((tool: Tool) => tool.name === name);
}