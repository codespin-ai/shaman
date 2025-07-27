/**
 * packages/shaman-agents/src/types.ts
 * 
 * Type definitions for unified agent operations
 */

import type { GitAgent } from '@codespin/shaman-types';
import type { ExternalAgent } from '@codespin/shaman-core/dist/types/agent.js';


/**
 * Unified agent type that can be either Git or External
 */
export type UnifiedAgent = 
  | {
      readonly source: 'git';
      readonly agent: GitAgent;
    }
  | {
      readonly source: 'external';
      readonly agent: ExternalAgent;
    };

/**
 * Options for searching agents
 */
export type AgentSearchOptions = {
  readonly tags?: string[];
  readonly source?: 'git' | 'external' | 'all';
  readonly repository?: string;
  readonly includeInactive?: boolean;
};

/**
 * Options for resolving a specific agent
 */
export type AgentResolveOptions = {
  readonly preferredSource?: 'git' | 'external';
  readonly branch?: string;
};

/**
 * Configuration for the agents module
 */
export type AgentsConfig = {
  readonly externalRegistries?: Array<{
    readonly url: string;
    readonly timeout?: number;
  }>;
  readonly gitRepositories?: Array<{
    readonly url: string;
    readonly branch?: string;
  }>;
};

/**
 * Agent resolution result with metadata
 */
export type AgentResolution = {
  readonly agent: UnifiedAgent;
  readonly resolvedFrom: 'git' | 'external';
  readonly repository?: string;
  readonly registryUrl?: string;
};