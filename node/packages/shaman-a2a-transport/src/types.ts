import type { Request, Response } from 'express';
import type { JsonRpcRequest, JsonRpcResponse } from '@codespin/shaman-jsonrpc';
import type { 
  SendMessageResponse,
  SendStreamingMessageResponse,
  GetTaskResponse,
  CancelTaskResponse,
  AgentCard 
} from '@codespin/shaman-a2a-protocol';

/**
 * Transport interface for handling A2A requests
 */
export interface A2ATransport {
  /**
   * Handle an incoming HTTP request
   */
  handle(req: Request, res: Response): Promise<void>;
  
  /**
   * Get the transport type identifier
   */
  getType(): string;
}

/**
 * Context passed to method handlers
 */
export interface A2AMethodContext {
  readonly request: Request;
  readonly response: Response;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly isInternal: boolean;
  readonly headers: Record<string, string | string[]>;
}

/**
 * Method handler signature
 */
export type A2AMethodHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: A2AMethodContext
) => Promise<TResult> | TResult;

/**
 * SSE event types
 */
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * SSE writer interface
 */
export interface SSEWriter {
  writeEvent(event: SSEEvent): void;
  close(): void;
}

/**
 * Method registry for A2A handlers
 */
export interface A2AMethodRegistry {
  'message/send': A2AMethodHandler<any, import('@codespin/shaman-a2a-protocol').Task | import('@codespin/shaman-a2a-protocol').Message>;
  'message/stream': A2AMethodHandler<any, AsyncGenerator<import('@codespin/shaman-a2a-protocol').Task | import('@codespin/shaman-a2a-protocol').Message>>;
  'tasks/get': A2AMethodHandler<any, import('@codespin/shaman-a2a-protocol').Task>;
  'tasks/cancel': A2AMethodHandler<any, import('@codespin/shaman-a2a-protocol').Task>;
  'tasks/resubscribe': A2AMethodHandler<any, AsyncGenerator<import('@codespin/shaman-a2a-protocol').Task | import('@codespin/shaman-a2a-protocol').Message>>;
  'tasks/pushNotificationConfig/set': A2AMethodHandler<any, { success: boolean }>;
  'tasks/pushNotificationConfig/get': A2AMethodHandler<any, any>;
  'agent/authenticatedExtendedCard': A2AMethodHandler<any, AgentCard>;
}