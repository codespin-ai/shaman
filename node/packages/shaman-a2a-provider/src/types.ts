/**
 * packages/shaman-a2a-provider/src/types.ts
 * 
 * A2A protocol type definitions for exposing agents
 */

import type { GitAgent } from '@codespin/shaman-types';

/**
 * A2A Agent Card - Public metadata about an agent
 */
export type A2AAgentCard = {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
  readonly capabilities?: string[];
  readonly tags?: string[];
  readonly endpoint: string;
};

/**
 * A2A Agent Discovery Response
 */
export type A2ADiscoveryResponse = {
  readonly agents: A2AAgentCard[];
  readonly totalCount: number;
  readonly nextPage?: string;
};

/**
 * A2A Agent Execution Request
 */
export type A2AExecutionRequest = {
  readonly agentName: string;
  readonly prompt: string;
  readonly context?: {
    readonly sessionId?: string;
    readonly userId?: string;
    readonly metadata?: Record<string, unknown>;
  };
  readonly stream?: boolean;
};

/**
 * A2A Agent Execution Response
 */
export type A2AExecutionResponse = {
  readonly status: 'success' | 'error' | 'pending';
  readonly executionId: string;
  readonly result?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
  readonly metadata?: {
    readonly startTime: string;
    readonly endTime?: string;
    readonly model?: string;
  };
};

/**
 * A2A Health Check Response
 */
export type A2AHealthResponse = {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly version: string;
  readonly uptime: number;
  readonly checks: {
    readonly database: boolean;
    readonly agents: boolean;
    readonly workflow?: boolean;
  };
};

/**
 * Configuration for A2A provider
 */
export type A2AProviderConfig = {
  readonly port?: number;
  readonly basePath?: string;
  readonly authentication?: {
    readonly type: 'none' | 'bearer' | 'api-key';
    readonly validateToken?: (token: string) => Promise<boolean>;
  };
  readonly rateLimiting?: {
    readonly enabled: boolean;
    readonly maxRequests: number;
    readonly windowMs: number;
  };
  readonly allowedAgents?: string[]; // Whitelist specific agents
  readonly excludedAgents?: string[]; // Blacklist specific agents
  readonly metadata?: {
    readonly organizationName?: string;
    readonly contactEmail?: string;
    readonly documentation?: string;
  };
};

/**
 * Internal type for converting GitAgent to A2A format
 */
export type AgentAdapter = {
  toA2ACard: (agent: GitAgent, baseUrl: string) => A2AAgentCard;
  canExposeAgent: (agent: GitAgent, config: A2AProviderConfig) => boolean;
};