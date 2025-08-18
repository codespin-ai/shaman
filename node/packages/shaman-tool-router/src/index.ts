/**
 * packages/shaman-tool-router/src/index.ts
 *
 * Tool router for platform tools, MCP servers, and agent calls.
 */

export * from "./types.js";
export * from "./tool-router.js";
export {
  createPlatformTools,
  getPlatformTool,
  isPlatformTool,
  PLATFORM_TOOL_NAMES,
  type PlatformToolName,
} from "./platform-tools.js";
export { createRunDataTools } from "./platform-tools/run-data-tools.js";
export { createCallAgentTool } from "./platform-tools/call-agent-tool.js";
export { PLATFORM_TOOL_DEFINITIONS } from "./tool-router.js";
