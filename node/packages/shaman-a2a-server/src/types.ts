import type { AgentCard } from "@codespin/shaman-a2a-protocol";
import type { Result } from "@codespin/shaman-core";

/**
 * A2A server configuration
 */
export interface A2AServerConfig {
  /** Server role: 'public' for external requests, 'internal' for internal only */
  role: "public" | "internal";

  /** Port to listen on */
  port: number;

  /** Base URL for A2A endpoints (default: empty string) */
  baseUrl?: string;

  /** JWT secret for internal authentication */
  jwtSecret?: string;

  /** API key validation function for public endpoints */
  validateApiKey?: (
    apiKey: string,
  ) => Promise<Result<{ organizationId: string }, Error>>;

  /** Organization ID for internal server */
  organizationId?: string;

  /** Agent card provider */
  getAgentCard: () => Promise<AgentCard>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  organizationId: string;
  userId?: string;
  isInternal: boolean;
}

/**
 * Task execution request
 */
export interface TaskExecutionRequest {
  taskId: string;
  agent: string;
  input: unknown;
  contextId?: string;
  organizationId: string;
  userId?: string;
}

/**
 * Server instance
 */
export interface A2AServerInstance {
  start(): Promise<void>;
  stop(): Promise<void>;
  getUrl(): string;
}
