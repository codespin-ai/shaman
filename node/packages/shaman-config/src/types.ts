/**
 * Configuration types for Shaman
 */

/**
 * Helper type to make all properties mutable
 */
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Database configuration
 */
export type DatabaseConfig = {
  readonly host: string;
  readonly port: number;
  readonly name: string;
  readonly user: string;
  readonly password: string;
  readonly pool?: {
    readonly min?: number;
    readonly max?: number;
  };
};

/**
 * LLM provider configuration
 */
export type LLMConfig = {
  readonly openai?: {
    readonly apiKey?: string;
  };
  readonly anthropic?: {
    readonly apiKey?: string;
  };
};

/**
 * A2A provider configuration
 */
export type A2AConfig = {
  readonly port?: number;
  readonly basePath?: string;
  readonly authentication?: {
    readonly type: 'none' | 'bearer' | 'basic';
    readonly token?: string;
    readonly username?: string;
    readonly password?: string;
  };
  readonly rateLimiting?: {
    readonly enabled: boolean;
    readonly maxRequests?: number;
    readonly windowMs?: number;
  };
  readonly metadata?: {
    readonly organizationName?: string;
    readonly documentation?: string;
  };
};

/**
 * Git repository configuration
 */
export type GitRepoConfig = {
  readonly url: string;
  readonly branch?: string;
  readonly path?: string;
  readonly authentication?: {
    readonly type: 'none' | 'token' | 'ssh' | 'basic';
    readonly token?: string;
    readonly privateKeyPath?: string;
    readonly username?: string;
    readonly password?: string;
  };
  readonly namespace?: string;
  readonly webhookSecret?: string;
};

/**
 * Agent configuration
 */
export type AgentsConfig = {
  readonly gitRepos?: readonly GitRepoConfig[];
  readonly syncInterval?: number;
};

/**
 * Complete Shaman configuration
 */
export type ShamanConfig = {
  readonly database: DatabaseConfig;
  readonly llm?: LLMConfig;
  readonly a2a?: A2AConfig;
  readonly agents?: AgentsConfig;
};

/**
 * Configuration loader options
 */
export type ConfigLoaderOptions = {
  readonly configPath?: string;
  readonly envPrefix?: string;
  readonly throwOnMissing?: boolean;
};

/**
 * Configuration validation result
 */
export type ValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
};
