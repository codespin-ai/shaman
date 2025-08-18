import type { JsonRpcError } from "./types.js";
import { JSON_RPC_ERROR_CODES, A2A_ERROR_CODES } from "./types.js";

export class JsonRpcErrorClass extends Error implements JsonRpcError {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "JsonRpcError";
    this.code = code;
    this.data = data;
  }
}

// Factory functions for common errors
export function parseError(data?: unknown): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    JSON_RPC_ERROR_CODES.PARSE_ERROR,
    "Parse error",
    data,
  );
}

export function invalidRequest(data?: unknown): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    JSON_RPC_ERROR_CODES.INVALID_REQUEST,
    "Invalid Request",
    data,
  );
}

export function methodNotFound(method: string): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
    "Method not found",
    { method },
  );
}

export function invalidParams(data?: unknown): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    JSON_RPC_ERROR_CODES.INVALID_PARAMS,
    "Invalid params",
    data,
  );
}

export function internalError(data?: unknown): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
    "Internal error",
    data,
  );
}

// A2A-specific errors
export function taskNotFound(taskId: string): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.TASK_NOT_FOUND,
    "Task not found",
    { taskId },
  );
}

export function taskNotCancelable(
  taskId: string,
  state: string,
): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.TASK_NOT_CANCELABLE,
    "Task cannot be canceled",
    { taskId, currentState: state },
  );
}

export function pushNotificationsNotSupported(): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.PUSH_NOTIFICATIONS_NOT_SUPPORTED,
    "Push notifications not supported",
  );
}

export function unsupportedOperation(operation: string): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.UNSUPPORTED_OPERATION,
    "Unsupported operation",
    { operation },
  );
}

export function contentTypeNotSupported(
  contentType: string,
): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.CONTENT_TYPE_NOT_SUPPORTED,
    "Content type not supported",
    { contentType },
  );
}

export function invalidAgentResponse(details?: unknown): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.INVALID_AGENT_RESPONSE,
    "Invalid agent response",
    details,
  );
}

export function authenticatedExtendedCardNotConfigured(): JsonRpcErrorClass {
  return new JsonRpcErrorClass(
    A2A_ERROR_CODES.AUTHENTICATED_EXTENDED_CARD_NOT_CONFIGURED,
    "Authenticated extended card not configured",
  );
}
