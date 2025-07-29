import type { User } from './types.js';
import type { ShamanConfig } from '@codespin/shaman-config';
import type { IDatabase } from 'pg-promise';
import type { LLMProvider } from '@codespin/shaman-llm-core';
import type { ToolRouter } from '@codespin/shaman-tool-router';

/**
 * GraphQL context passed to all resolvers
 */
export type GraphQLContext = {
  // Request context
  readonly requestId: string;
  readonly user?: User;
  
  // Core dependencies
  readonly config: ShamanConfig;
  readonly db: IDatabase<unknown>;
  
  // Service dependencies
  readonly llmProvider: LLMProvider;
  readonly toolRouter: ToolRouter;
  
  // Dataloaders (to be added for performance)
  readonly loaders?: Record<string, unknown>;
};