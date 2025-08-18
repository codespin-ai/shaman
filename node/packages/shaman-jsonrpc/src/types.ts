/**
 * JSON-RPC 2.0 types
 */

export interface JsonRpcRequest<T = unknown> {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: T;
  readonly id?: string | number | null;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  readonly jsonrpc: "2.0";
  readonly result: T;
  readonly id: string | number | null;
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: "2.0";
  readonly error: JsonRpcError;
  readonly id: string | number | null;
}

export type JsonRpcResponse<T = unknown> =
  | JsonRpcSuccessResponse<T>
  | JsonRpcErrorResponse;

export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

// Standard JSON-RPC 2.0 error codes
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// A2A-specific error codes
export const A2A_ERROR_CODES = {
  TASK_NOT_FOUND: -32001,
  TASK_NOT_CANCELABLE: -32002,
  PUSH_NOTIFICATIONS_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
  INVALID_AGENT_RESPONSE: -32006,
  AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED: -32007,
} as const;

export type JsonRpcBatchRequest = JsonRpcRequest[];
export type JsonRpcBatchResponse = JsonRpcResponse[];

export type JsonRpcMethodHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: JsonRpcContext,
) => Promise<TResult> | TResult;

export interface JsonRpcContext {
  readonly request: JsonRpcRequest;
  readonly headers?: Record<string, string | string[]>;
  readonly [key: string]: unknown;
}

export interface JsonRpcMiddleware {
  (
    request: JsonRpcRequest,
    context: JsonRpcContext,
    next: () => Promise<JsonRpcResponse>,
  ): Promise<JsonRpcResponse>;
}
