/**
 * Vercel AI SDK provider types
 */

// No imports needed from ai SDK

/**
 * Provider types supported
 */
export type ProviderType = 'openai' | 'anthropic' | 'custom';

/**
 * Model configuration
 */
export type ModelConfig = {
  provider: ProviderType;
  modelId: string;
  apiKey?: string;
  baseURL?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
};

/**
 * Vercel LLM provider configuration
 */
export type VercelLLMConfig = {
  models: Record<string, ModelConfig>;
  defaultModel?: string;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
  };
};

// Model cache entry type removed - no longer needed with simplified implementation