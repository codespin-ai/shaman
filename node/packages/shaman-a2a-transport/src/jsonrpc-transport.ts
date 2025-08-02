import type { Request, Response } from 'express';
import { JsonRpcHandler, JsonRpcErrorClass, parseError } from '@codespin/shaman-jsonrpc';
import type { JsonRpcRequest, JsonRpcContext } from '@codespin/shaman-jsonrpc';
import { createLogger } from '@codespin/shaman-logger';
import type { A2ATransport, A2AMethodContext, A2AMethodRegistry } from './types.js';

const logger = createLogger('JsonRpcTransport');

/**
 * JSON-RPC transport for A2A protocol
 * Handles all requests through a single POST / endpoint
 */
export class JsonRpcTransport implements A2ATransport {
  private readonly handler: JsonRpcHandler;
  private readonly extractContext: (req: Request) => Partial<A2AMethodContext>;

  constructor(options: {
    extractContext?: (req: Request) => Partial<A2AMethodContext>;
  } = {}) {
    this.handler = new JsonRpcHandler();
    this.extractContext = options.extractContext || (() => ({}));
  }

  /**
   * Register a method handler
   */
  method<K extends keyof A2AMethodRegistry>(
    name: K,
    handler: A2AMethodRegistry[K]
  ): this {
    // Wrap the handler to convert context types
    this.handler.method(name, async (params: unknown, jsonRpcContext: JsonRpcContext) => {
      const a2aContext: A2AMethodContext = {
        ...jsonRpcContext,
        request: jsonRpcContext.request as Request,
        response: jsonRpcContext.response as Response,
        headers: (jsonRpcContext.request as Request).headers as Record<string, string | string[]>,
        isInternal: false
      };
      return handler(params, a2aContext);
    });
    return this;
  }

  /**
   * Handle an incoming HTTP request
   */
  async handle(req: Request, res: Response): Promise<void> {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).json({
        error: 'Method not allowed'
      });
      return;
    }

    // Create context for method handlers
    const _context: A2AMethodContext = {
      request: req,
      response: res,
      headers: req.headers as Record<string, string | string[]>,
      isInternal: false,
      ...this.extractContext(req)
    };

    try {
      // Parse JSON-RPC request
      const jsonRpcRequest = req.body as unknown as JsonRpcRequest;
      
      if (!jsonRpcRequest || typeof jsonRpcRequest !== 'object') {
        throw parseError('Request body must be a JSON object');
      }

      // Handle the request with full context
      const result = await this.handler.handle(jsonRpcRequest, {
        request: req,
        response: res
      } as JsonRpcContext);

      // Check if handler returned a generator (streaming response)
      if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        // Handler will manage SSE response directly
        return;
      }

      // Send JSON-RPC response
      res.json(result);
    } catch (error) {
      logger.error('Error handling JSON-RPC request:', error);
      
      // Send error response
      if (error instanceof JsonRpcErrorClass) {
        res.status(400).json({
          jsonrpc: '2.0',
          id: (req.body as unknown as JsonRpcRequest | undefined)?.id || null,
          error: {
            code: error.code,
            message: error.message,
            data: error.data
          }
        });
      } else {
        res.status(500).json({
          jsonrpc: '2.0',
          id: (req.body as unknown as JsonRpcRequest | undefined)?.id || null,
          error: {
            code: -32603,
            message: 'Internal server error'
          }
        });
      }
    }
  }

  getType(): string {
    return 'jsonrpc';
  }
}