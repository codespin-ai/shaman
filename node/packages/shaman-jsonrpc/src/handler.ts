import { createLogger } from "@codespin/shaman-logger";
import type { Result } from "@codespin/shaman-core";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcError,
  JsonRpcBatchRequest,
  JsonRpcBatchResponse,
  JsonRpcMethodHandler,
  JsonRpcContext,
  JsonRpcMiddleware,
} from "./types.js";
import { JSON_RPC_ERROR_CODES } from "./types.js";

const logger = createLogger("JsonRpcHandler");

export class JsonRpcHandler {
  private methods = new Map<string, JsonRpcMethodHandler>();
  private middlewares: JsonRpcMiddleware[] = [];

  /**
   * Register a method handler
   */
  method<TParams = unknown, TResult = unknown>(
    name: string,
    handler: JsonRpcMethodHandler<TParams, TResult>,
  ): this {
    this.methods.set(name, handler as JsonRpcMethodHandler);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: JsonRpcMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Handle a JSON-RPC request
   */
  async handle(
    body: unknown,
    context: Partial<JsonRpcContext> = {},
  ): Promise<JsonRpcResponse | JsonRpcBatchResponse> {
    // Parse and validate request
    const parseResult = this.parseRequest(body);
    if (!parseResult.success) {
      return this.createErrorResponse(
        null,
        JSON_RPC_ERROR_CODES.PARSE_ERROR,
        "Parse error",
        parseResult.error,
      );
    }

    const request = parseResult.data;

    // Handle batch requests
    if (Array.isArray(request)) {
      return this.handleBatch(request, context);
    }

    // Handle single request
    const response = await this.handleSingle(request, context);
    return response!; // For non-batch requests, we always return a response
  }

  private async handleBatch(
    requests: JsonRpcBatchRequest,
    baseContext: Partial<JsonRpcContext>,
  ): Promise<JsonRpcBatchResponse> {
    if (requests.length === 0) {
      return [
        this.createErrorResponse(
          null,
          JSON_RPC_ERROR_CODES.INVALID_REQUEST,
          "Invalid Request",
          "Batch request cannot be empty",
        ),
      ];
    }

    const responses = await Promise.all(
      requests.map((request) => this.handleSingle(request, baseContext)),
    );

    // Filter out responses for notifications (id is undefined)
    return responses.filter(
      (response) => response !== undefined,
    ) as JsonRpcBatchResponse;
  }

  private async handleSingle(
    request: JsonRpcRequest,
    baseContext: Partial<JsonRpcContext>,
  ): Promise<JsonRpcResponse | undefined> {
    // Validate request
    const validationResult = this.validateRequest(request);
    if (!validationResult.success) {
      return this.createErrorResponse(
        request.id ?? null,
        JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        "Invalid Request",
        validationResult.error,
      );
    }

    // Check if method exists
    if (!this.methods.has(request.method)) {
      return this.createErrorResponse(
        request.id ?? null,
        JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
        "Method not found",
        `Method '${request.method}' is not supported`,
      );
    }

    // Create context
    const context: JsonRpcContext = {
      ...baseContext,
      request,
    };

    try {
      // Apply middlewares
      const executeMethod = async (): Promise<JsonRpcResponse> => {
        const handler = this.methods.get(request.method)!;
        const result = await handler(request.params, context);
        return this.createSuccessResponse(request.id ?? null, result);
      };

      // Build middleware chain
      let chain = executeMethod;
      for (let i = this.middlewares.length - 1; i >= 0; i--) {
        const middleware = this.middlewares[i];
        const next = chain;
        chain = () => middleware(request, context, next);
      }

      const response = await chain();

      // Don't return response for notifications (no id)
      if (request.id === undefined) {
        return undefined;
      }

      return response;
    } catch (error) {
      logger.error(`Error in method '${request.method}':`, error);

      // Handle known JSON-RPC errors
      if (this.isJsonRpcError(error)) {
        return this.createErrorResponse(
          request.id ?? null,
          error.code,
          error.message,
          error.data,
        );
      }

      // Internal error
      return this.createErrorResponse(
        request.id ?? null,
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        "Internal error",
        process.env.NODE_ENV === "development" ? String(error) : undefined,
      );
    }
  }

  private parseRequest(
    body: unknown,
  ): Result<JsonRpcRequest | JsonRpcBatchRequest, string> {
    try {
      if (typeof body !== "object" || body === null) {
        return {
          success: false,
          error: "Request body must be an object or array",
        };
      }

      return {
        success: true,
        data: body as JsonRpcRequest | JsonRpcBatchRequest,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private validateRequest(request: JsonRpcRequest): Result<void, string> {
    if (request.jsonrpc !== "2.0") {
      return { success: false, error: "Invalid jsonrpc version" };
    }

    if (typeof request.method !== "string" || request.method.length === 0) {
      return { success: false, error: "Method must be a non-empty string" };
    }

    if (request.method.startsWith("rpc.")) {
      return {
        success: false,
        error: 'Method names should not start with "rpc."',
      };
    }

    if (
      "id" in request &&
      request.id !== null &&
      typeof request.id !== "string" &&
      typeof request.id !== "number"
    ) {
      return { success: false, error: "Invalid id type" };
    }

    return { success: true, data: undefined };
  }

  private createSuccessResponse<T>(
    id: string | number | null,
    result: T,
  ): JsonRpcSuccessResponse<T> {
    return {
      jsonrpc: "2.0",
      result,
      id,
    };
  }

  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcErrorResponse {
    const error: JsonRpcError =
      data !== undefined ? { code, message, data } : { code, message };

    return {
      jsonrpc: "2.0",
      error,
      id,
    };
  }

  private isJsonRpcError(error: unknown): error is JsonRpcError {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "message" in error &&
      typeof (error as { code: unknown }).code === "number" &&
      typeof (error as { message: unknown }).message === "string"
    );
  }
}

export function createJsonRpcHandler(): JsonRpcHandler {
  return new JsonRpcHandler();
}
