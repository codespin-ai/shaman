import type { Request, Response } from 'express';
import { createLogger } from '@codespin/shaman-logger';
import type { A2ATransport, A2AMethodContext, A2AMethodRegistry } from './types.js';
import { JsonRpcHandler } from '@codespin/shaman-jsonrpc';
import type { JsonRpcErrorClass } from '@codespin/shaman-jsonrpc';
import type { JsonRpcRequest } from '@codespin/shaman-jsonrpc';

const logger = createLogger('RestTransport');

interface RestRoute {
  method: string;
  path: RegExp;
  jsonRpcMethod: keyof A2AMethodRegistry;
  extractParams?: (req: Request, matches: RegExpMatchArray) => unknown;
}

/**
 * REST transport for A2A protocol
 * Maps RESTful endpoints to JSON-RPC methods
 */
export class RestTransport implements A2ATransport {
  private readonly handler: JsonRpcHandler;
  private readonly routes: RestRoute[] = [];
  private readonly extractContext: (req: Request) => Partial<A2AMethodContext>;

  constructor(options: {
    extractContext?: (req: Request) => Partial<A2AMethodContext>;
  } = {}) {
    this.handler = new JsonRpcHandler();
    this.extractContext = options.extractContext || (() => ({}));
    
    // Define REST routes mapping
    this.routes = [
      {
        method: 'POST',
        path: /^\/a2a\/v1\/message\/send$/,
        jsonRpcMethod: 'message/send',
        extractParams: (req) => req.body as unknown
      },
      {
        method: 'GET',
        path: /^\/a2a\/v1\/tasks\/([^/]+)$/,
        jsonRpcMethod: 'tasks/get',
        extractParams: (req, matches) => ({ taskId: matches[1] })
      },
      {
        method: 'POST',
        path: /^\/a2a\/v1\/tasks\/([^/]+)\/cancel$/,
        jsonRpcMethod: 'tasks/cancel',
        extractParams: (req, matches) => ({ taskId: matches[1] })
      },
      {
        method: 'GET',
        path: /^\/a2a\/v1\/tasks\/([^/]+)\/stream$/,
        jsonRpcMethod: 'tasks/resubscribe',
        extractParams: (req, matches) => ({ taskId: matches[1] })
      }
    ];
  }

  /**
   * Register a method handler
   */
  method<K extends keyof A2AMethodRegistry>(
    name: K,
    handler: A2AMethodRegistry[K]
  ): this {
    // Wrap the handler to convert context types
    this.handler.method(name, async (params: unknown, jsonRpcContext: unknown) => {
      const a2aContext = jsonRpcContext as A2AMethodContext;
      return handler(params, a2aContext);
    });
    return this;
  }

  /**
   * Handle an incoming HTTP request
   */
  async handle(req: Request, res: Response): Promise<void> {
    // Find matching route
    const route = this.routes.find(r => {
      if (r.method !== req.method) return false;
      return r.path.test(req.path);
    });

    if (!route) {
      res.status(404).json({
        error: 'Not found'
      });
      return;
    }

    // Extract parameters
    const matches = req.path.match(route.path);
    const params = route.extractParams ? route.extractParams(req, matches!) : {};

    // Create JSON-RPC request
    const jsonRpcRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: req.headers['x-request-id'] as string || `rest-${Date.now()}`,
      method: route.jsonRpcMethod,
      params
    };

    // Create context
    const context: A2AMethodContext = {
      request: req,
      response: res,
      headers: req.headers as Record<string, string | string[]>,
      isInternal: false,
      ...this.extractContext(req)
    };

    try {
      // Handle through JSON-RPC handler with full context
      const result = await this.handler.handle(jsonRpcRequest, context as unknown as Parameters<typeof this.handler.handle>[1]);

      // Check if handler returned a generator (streaming response)
      if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        // Handler will manage SSE response directly
        return;
      }

      // Extract result from JSON-RPC response
      if ('result' in result) {
        res.json(result.result);
      } else if ('error' in result) {
        const error = result.error as JsonRpcErrorClass;
        res.status(400).json({
          error: {
            code: error.code,
            message: error.message,
            data: error.data
          }
        });
      }
    } catch (error) {
      logger.error('Error handling REST request:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  getType(): string {
    return 'rest';
  }
}