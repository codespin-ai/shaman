/**
 * Types for A2A client
 */

import type { WorkflowContext } from '@codespin/shaman-types';

/**
 * Configuration for A2A client
 */
export type A2AClientConfig = {
  /** Base URL of the internal A2A server */
  baseUrl: string;
  
  /** JWT secret for signing internal tokens */
  jwtSecret: string;
  
  /** Optional timeout in milliseconds */
  timeout?: number;
  
  /** Optional retry configuration */
  retry?: {
    maxRetries: number;
    retryDelay: number;
  };
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
 * A2A agent discovery response
 */
export type A2ADiscoveryResponse = {
  agents: A2AAgentCard[];
  totalCount: number;
};

/**
 * A2A agent card
 */
export type A2AAgentCard = {
  name: string;
  description: string;
  version: string;
  category?: string;
  capabilities?: string[];
  constraints?: string[];
  inputSchema?: unknown;
  outputSchema?: unknown;
  metadata?: Record<string, unknown>;
  endpoints: {
    execute: string;
  };
};

/**
 * Internal JWT payload for agent-to-agent calls
 */
export type InternalJWTPayload = {
  /** Issuer (public server) */
  iss: string;
  
  /** Audience (internal server) */
  aud: string;
  
  /** Expiration time */
  exp: number;
  
  /** Issued at */
  iat: number;
  
  /** Workflow context */
  context: {
    tenantId: string;
    runId: string;
    parentTaskId?: string;
    depth: number;
  };
};