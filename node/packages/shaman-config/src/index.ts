/**
 * Shaman configuration management
 */

export {
  // Main loader functions
  loadConfig,
  loadConfigSync,

  // Schema functions
  validateConfig,
  mergeConfigs,
} from "./loader.js";

export {
  // Types
  type ShamanConfig,
  type DatabaseConfig,
  type LLMConfig,
  type A2AConfig,
  type AgentsConfig,
  type GitRepoConfig,
  type ConfigLoaderOptions,
  type ValidationResult,
} from "./types.js";

// Re-export Result type for convenience
export type { Result } from "@codespin/shaman-core";
