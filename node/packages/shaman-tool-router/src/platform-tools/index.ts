/**
 * Platform tools index
 */

export {
  createRunDataTools,
  createRunDataWriteTool,
  createRunDataReadTool,
  createRunDataQueryTool,
  createRunDataListTool,
  createRunDataDeleteTool,
} from "./run-data-tools.js";

export { createCallAgentTool } from "./call-agent-tool.js";

import type { ForemanConfig } from "@codespin/foreman-client";
import type { Tool, ToolExecutionContext } from "../types.js";
import { createRunDataTools } from "./run-data-tools.js";
import { createCallAgentTool } from "./call-agent-tool.js";

/**
 * Create all platform tools
 */
export function createPlatformTools(
  foremanConfig: ForemanConfig,
  context: ToolExecutionContext,
  options: {
    internalA2AUrl?: string;
    jwtToken?: string;
  } = {},
): Tool[] {
  return [
    ...createRunDataTools(foremanConfig, context),
    createCallAgentTool(context, options),
  ];
}
