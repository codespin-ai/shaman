/**
 * Configuration loader with JSON/YAML support and environment overrides
 */

import { readFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import * as yaml from "js-yaml";
import type { Result } from "@codespin/shaman-core";
import type { ShamanConfig, ConfigLoaderOptions } from "./types.js";
import { validateConfig, mergeConfigs } from "./schema.js";

/**
 * Load configuration from a file
 */
function loadConfigFile(
  filePath: string,
): Result<Partial<ShamanConfig>, Error> {
  try {
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: new Error(`Configuration file not found: ${filePath}`),
      };
    }

    const ext = extname(filePath).toLowerCase();
    const content = readFileSync(filePath, "utf-8");

    let parsed: unknown;
    if (ext === ".json") {
      parsed = JSON.parse(content);
    } else if (ext === ".yaml" || ext === ".yml") {
      parsed = yaml.load(content);
    } else {
      return {
        success: false,
        error: new Error(
          `Unsupported file format: ${ext}. Use .json, .yaml, or .yml`,
        ),
      };
    }

    return {
      success: true,
      data: parsed as Partial<ShamanConfig>,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(prefix: string = "SHAMAN_"): Partial<ShamanConfig> {
  const configs: Partial<ShamanConfig>[] = [];

  // Database configuration
  const dbHost = process.env[`${prefix}DB_HOST`];
  const dbPort = process.env[`${prefix}DB_PORT`];
  const dbName = process.env[`${prefix}DB_NAME`];
  const dbUser = process.env[`${prefix}DB_USER`];
  const dbPassword = process.env[`${prefix}DB_PASSWORD`];

  if (dbHost && dbName && dbUser && dbPassword) {
    configs.push({
      database: {
        host: dbHost,
        port: dbPort ? parseInt(dbPort, 10) : 5432,
        name: dbName,
        user: dbUser,
        password: dbPassword,
        pool: {
          min: process.env[`${prefix}DB_POOL_MIN`]
            ? parseInt(process.env[`${prefix}DB_POOL_MIN`]!, 10)
            : undefined,
          max: process.env[`${prefix}DB_POOL_MAX`]
            ? parseInt(process.env[`${prefix}DB_POOL_MAX`]!, 10)
            : undefined,
        },
      },
    });
  }

  // LLM configuration
  const openaiKey =
    process.env.OPENAI_API_KEY || process.env[`${prefix}OPENAI_API_KEY`];
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY || process.env[`${prefix}ANTHROPIC_API_KEY`];

  if (openaiKey || anthropicKey) {
    configs.push({
      llm: {
        openai: openaiKey ? { apiKey: openaiKey } : undefined,
        anthropic: anthropicKey ? { apiKey: anthropicKey } : undefined,
      },
    });
  }

  // A2A configuration
  const a2aPort = process.env[`${prefix}A2A_PORT`];
  if (a2aPort) {
    configs.push({
      a2a: {
        port: parseInt(a2aPort, 10),
        basePath: process.env[`${prefix}A2A_BASE_PATH`],
        authentication: process.env[`${prefix}A2A_AUTH_TYPE`]
          ? {
              type: process.env[`${prefix}A2A_AUTH_TYPE`] as
                | "none"
                | "bearer"
                | "basic",
              token: process.env[`${prefix}A2A_AUTH_TOKEN`],
              username: process.env[`${prefix}A2A_AUTH_USERNAME`],
              password: process.env[`${prefix}A2A_AUTH_PASSWORD`],
            }
          : undefined,
        rateLimiting: process.env[`${prefix}A2A_RATE_LIMIT_ENABLED`]
          ? {
              enabled:
                process.env[`${prefix}A2A_RATE_LIMIT_ENABLED`] === "true",
              maxRequests: process.env[`${prefix}A2A_RATE_LIMIT_MAX_REQUESTS`]
                ? parseInt(
                    process.env[`${prefix}A2A_RATE_LIMIT_MAX_REQUESTS`]!,
                    10,
                  )
                : undefined,
              windowMs: process.env[`${prefix}A2A_RATE_LIMIT_WINDOW_MS`]
                ? parseInt(
                    process.env[`${prefix}A2A_RATE_LIMIT_WINDOW_MS`]!,
                    10,
                  )
                : undefined,
            }
          : undefined,
        metadata: {
          organizationName: process.env[`${prefix}A2A_ORG_NAME`],
          documentation: process.env[`${prefix}A2A_DOCS_URL`],
        },
      },
    });
  }

  // Agents configuration
  const syncInterval = process.env[`${prefix}AGENTS_SYNC_INTERVAL`];
  if (syncInterval) {
    configs.push({
      agents: {
        syncInterval: parseInt(syncInterval, 10),
      },
    });
  }

  // Merge all configs
  return configs.reduce((acc, curr) => ({ ...acc, ...curr }), {});
}

/**
 * Load configuration from file and environment
 */
export function loadConfig(
  options: ConfigLoaderOptions = {},
): Result<ShamanConfig, Error> {
  return loadConfigSync(options);
}

/**
 * Load configuration synchronously (for initialization)
 */
export function loadConfigSync(
  options: ConfigLoaderOptions = {},
): Result<ShamanConfig, Error> {
  try {
    let fileConfig: Partial<ShamanConfig> = {};

    // Load from file if specified
    if (options.configPath) {
      const resolvedPath = resolve(process.cwd(), options.configPath);

      const fileResult = loadConfigFile(resolvedPath);
      if (!fileResult.success) {
        if (options.throwOnMissing) {
          return fileResult as Result<ShamanConfig, Error>;
        }
      } else {
        fileConfig = fileResult.data;
      }
    }

    // Load from environment
    const envConfig = loadEnvConfig(options.envPrefix);

    // Merge configurations (env overrides file)
    const mergedConfig = mergeConfigs(fileConfig, envConfig);

    // Validate the final configuration
    const validation = validateConfig(mergedConfig);
    if (!validation.valid) {
      return {
        success: false,
        error: new Error(
          `Configuration validation failed: ${validation.errors.join(", ")}`,
        ),
      };
    }

    return {
      success: true,
      data: mergedConfig,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Re-export from schema for convenience
export { validateConfig, mergeConfigs } from "./schema.js";
