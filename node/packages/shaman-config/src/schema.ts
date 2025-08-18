/**
 * Configuration schema and validation
 */

import type {
  ShamanConfig,
  ValidationResult,
  DatabaseConfig,
  A2AConfig,
} from "./types.js";

/**
 * Validate a configuration object
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return {
      valid: false,
      errors: ["Configuration must be an object"],
    };
  }

  const cfg = config as Record<string, unknown>;

  // Validate database config
  if (!cfg.database || typeof cfg.database !== "object") {
    errors.push("database configuration is required");
  } else {
    const db = cfg.database as Record<string, unknown>;
    if (!db.host || typeof db.host !== "string") {
      errors.push("database.host is required and must be a string");
    }
    if (db.port !== undefined && typeof db.port !== "number") {
      errors.push("database.port must be a number");
    }
    if (!db.name || typeof db.name !== "string") {
      errors.push("database.name is required and must be a string");
    }
    if (!db.user || typeof db.user !== "string") {
      errors.push("database.user is required and must be a string");
    }
    if (!db.password || typeof db.password !== "string") {
      errors.push("database.password is required and must be a string");
    }
  }

  // Validate LLM config if present
  if (cfg.llm && typeof cfg.llm === "object") {
    const llm = cfg.llm as Record<string, unknown>;
    if (llm.openai && typeof llm.openai === "object") {
      const openai = llm.openai as Record<string, unknown>;
      if (openai.apiKey !== undefined && typeof openai.apiKey !== "string") {
        errors.push("llm.openai.apiKey must be a string");
      }
    }
    if (llm.anthropic && typeof llm.anthropic === "object") {
      const anthropic = llm.anthropic as Record<string, unknown>;
      if (
        anthropic.apiKey !== undefined &&
        typeof anthropic.apiKey !== "string"
      ) {
        errors.push("llm.anthropic.apiKey must be a string");
      }
    }
  }

  // Validate A2A config if present
  if (cfg.a2a && typeof cfg.a2a === "object") {
    const a2a = cfg.a2a as Record<string, unknown>;
    if (a2a.port !== undefined && typeof a2a.port !== "number") {
      errors.push("a2a.port must be a number");
    }
    if (a2a.basePath !== undefined && typeof a2a.basePath !== "string") {
      errors.push("a2a.basePath must be a string");
    }
    if (a2a.authentication && typeof a2a.authentication === "object") {
      const auth = a2a.authentication as Record<string, unknown>;
      if (
        !auth.type ||
        !["none", "bearer", "basic"].includes(auth.type as string)
      ) {
        errors.push(
          "a2a.authentication.type must be one of: none, bearer, basic",
        );
      }
    }
  }

  // Validate agents config if present
  if (cfg.agents && typeof cfg.agents === "object") {
    const agents = cfg.agents as Record<string, unknown>;
    if (
      agents.syncInterval !== undefined &&
      typeof agents.syncInterval !== "number"
    ) {
      errors.push("agents.syncInterval must be a number");
    }
    if (agents.gitRepos !== undefined && !Array.isArray(agents.gitRepos)) {
      errors.push("agents.gitRepos must be an array");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge configurations with proper precedence
 */
export function mergeConfigs(
  base: Partial<ShamanConfig>,
  override: Partial<ShamanConfig>,
): ShamanConfig {
  // Build database config
  const database: DatabaseConfig = {
    ...base.database!,
    ...override.database,
    pool: {
      ...base.database?.pool,
      ...override.database?.pool,
    },
  } as DatabaseConfig;

  // Create mutable result object
  const result = {
    database,
    llm: undefined as ShamanConfig["llm"],
    a2a: undefined as ShamanConfig["a2a"],
    agents: undefined as ShamanConfig["agents"],
  };

  // Merge LLM config
  if (override.llm || base.llm) {
    result.llm = {
      openai: {
        ...base.llm?.openai,
        ...override.llm?.openai,
      },
      anthropic: {
        ...base.llm?.anthropic,
        ...override.llm?.anthropic,
      },
    };
  }

  // Merge A2A config
  if (override.a2a || base.a2a) {
    const a2aConfig = {
      ...base.a2a,
      ...override.a2a,
      authentication: undefined as A2AConfig["authentication"],
      rateLimiting: undefined as A2AConfig["rateLimiting"],
      metadata: undefined as A2AConfig["metadata"],
    };

    if (override.a2a?.authentication || base.a2a?.authentication) {
      const authType =
        override.a2a?.authentication?.type || base.a2a?.authentication?.type;
      if (authType) {
        a2aConfig.authentication = {
          type: authType,
          ...base.a2a?.authentication,
          ...override.a2a?.authentication,
        };
      }
    }

    if (override.a2a?.rateLimiting || base.a2a?.rateLimiting) {
      const enabled =
        override.a2a?.rateLimiting?.enabled ?? base.a2a?.rateLimiting?.enabled;
      if (enabled !== undefined) {
        a2aConfig.rateLimiting = {
          enabled,
          ...base.a2a?.rateLimiting,
          ...override.a2a?.rateLimiting,
        };
      }
    }

    if (override.a2a?.metadata || base.a2a?.metadata) {
      a2aConfig.metadata = {
        ...base.a2a?.metadata,
        ...override.a2a?.metadata,
      };
    }

    result.a2a = a2aConfig as A2AConfig;
  }

  // Merge agents config
  if (override.agents || base.agents) {
    result.agents = {
      ...base.agents,
      ...override.agents,
      gitRepos: override.agents?.gitRepos || base.agents?.gitRepos,
    };
  }

  return result as ShamanConfig;
}
