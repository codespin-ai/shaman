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
 * A2A Message Part
 */
export type A2AMessagePart = {
  readonly kind: 'text' | 'data' | 'error';
  readonly text?: string;
  readonly data?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
};

/**
 * A2A Message
 */
export type A2AMessage = {
  readonly role: 'user' | 'agent' | 'system';
  readonly parts: A2AMessagePart[];
  readonly messageId?: string;
  readonly contextId?: string;
  readonly taskId?: string;
};

/**
 * A2A Task Status
 */
export type A2ATaskStatus = {
  readonly state: 'submitted' | 'working' | 'input-required' | 'auth-required' | 'completed' | 'failed' | 'cancelled' | 'rejected';
  readonly message?: A2AMessage;
  readonly timestamp: string;
};

/**
 * A2A Artifact
 */
export type A2AArtifact = {
  readonly artifactId: string;
  readonly name: string;
  readonly parts: A2AMessagePart[];
};

/**
 * A2A Task
 */
export type A2ATask = {
  readonly id: string;
  readonly contextId: string;
  readonly status: A2ATaskStatus;
  readonly artifacts: A2AArtifact[];
  readonly history: A2AMessage[];
  readonly metadata?: Record<string, unknown>;
  readonly kind: 'task';
};

/**
 * A2A Send Message Request
 */
export type A2ASendMessageRequest = {
  readonly message: A2AMessage;
  readonly configuration?: {
    readonly blocking?: boolean;
    readonly pushNotificationConfig?: {
      readonly url: string;
      readonly token?: string;
    };
  };
  readonly metadata?: Record<string, unknown>;
};

/**
 * A2A Send Message Response
 */
export type A2ASendMessageResponse = A2ATask | A2AMessage;

/**
 * A2A JSON-RPC Request
 */
export type A2AJsonRpcRequest<T = unknown> = {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: T;
};

/**
 * A2A JSON-RPC Response
 */
export type A2AJsonRpcResponse<T = unknown> = {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: T;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
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
  readonly allowedAgents?: string[]; // Whitelist of agents to expose (required for any agents to be exposed)
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