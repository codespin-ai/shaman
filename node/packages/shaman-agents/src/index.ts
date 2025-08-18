/**
 * packages/shaman-agents/src/index.ts
 *
 * Public API for the shaman-agents package
 */

// Export all types
export * from "./types.js";

// Export agent management functions
export {
  getAllAgents,
  getAgent,
  resolveAgent,
  searchAgents,
  syncGitRepositories,
} from "./agent-manager.js";

// Re-export useful types from dependencies
export type { GitAgent } from "@codespin/shaman-types";
export type { ExternalAgent } from "@codespin/shaman-core/dist/types/agent.js";
export type { Result } from "@codespin/shaman-core/dist/types/result.js";
