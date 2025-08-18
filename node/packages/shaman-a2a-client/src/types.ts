import type { Result } from "@codespin/shaman-core";
import type {
  SendMessageRequest,
  SendMessageResponse,
  GetTaskRequest,
  GetTaskResponse,
  CancelTaskRequest,
  CancelTaskResponse,
  AgentCard,
  SendStreamingMessageResponse,
} from "@codespin/shaman-a2a-protocol";

/**
 * A2A client configuration
 */
export interface A2AClientConfig {
  /** Base URL of the A2A server */
  baseUrl: string;

  /** API key for authentication (public servers) */
  apiKey?: string;

  /** JWT token for authentication (internal servers) */
  jwtToken?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

/**
 * A2A client interface
 */
export interface A2AClient {
  /**
   * Discover available agents
   */
  discover(): Promise<Result<AgentCard, Error>>;

  /**
   * Send a message to an agent
   */
  sendMessage(
    request: SendMessageRequest,
  ): Promise<Result<SendMessageResponse, Error>>;

  /**
   * Send a message and stream responses
   */
  streamMessage(
    request: SendMessageRequest,
  ): AsyncGenerator<SendStreamingMessageResponse>;

  /**
   * Get task status
   */
  getTask(request: GetTaskRequest): Promise<Result<GetTaskResponse, Error>>;

  /**
   * Cancel a task
   */
  cancelTask(
    request: CancelTaskRequest,
  ): Promise<Result<CancelTaskResponse, Error>>;

  /**
   * Resubscribe to task updates
   */
  resubscribeTask(
    request: GetTaskRequest,
  ): AsyncGenerator<SendStreamingMessageResponse>;
}

/**
 * JWT payload for internal authentication
 */
export interface InternalJWTPayload {
  organizationId: string;
  userId?: string;
  iat?: number;
  exp?: number;
}
