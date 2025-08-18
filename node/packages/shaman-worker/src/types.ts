/**
 * Worker configuration types
 */

import type { ModelConfig } from "@codespin/shaman-llm-vercel";

export type WorkerConfig = {
  foremanEndpoint: string;
  foremanApiKey: string;
  internalA2AUrl: string;
  jwtSecret: string;
  concurrency?: number;
  queues?: {
    taskQueue?: string;
    resultQueue?: string;
  };
  llmModels?: Record<string, ModelConfig>;
  defaultModel?: string;
  gitRepositories?: Array<{
    url: string;
    branch?: string;
  }>;
  externalRegistries?: Array<{
    url: string;
    timeout?: number;
  }>;
};
