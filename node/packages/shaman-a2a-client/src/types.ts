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
 * A2A execution request
 */
export type A2AExecutionRequest = {
  /** The prompt/input for the agent */
  prompt: string;
  
  /** Optional context to pass */
  context?: Record<string, unknown>;
  
  /** Optional session ID for conversation continuity */
  sessionId?: string;
  
  /** Optional parameters */
  parameters?: Record<string, unknown>;
};

/**
 * A2A execution response
 */
export type A2AExecutionResponse = {
  /** Task ID for tracking */
  taskId: string;
  
  /** Status of the execution */
  status: 'completed' | 'failed' | 'cancelled' | 'input-required' | 'auth-required';
  
  /** Output from the agent */
  output?: string;
  
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  
  /** Metadata about the execution */
  metadata?: {
    model?: string;
    tokensUsed?: number;
    executionTime?: number;
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