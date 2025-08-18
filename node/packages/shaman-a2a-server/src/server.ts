import express from "express";
import type { Express } from "express";
import { createServer } from "http";
import type { Server } from "http";
import {
  JsonRpcTransport,
  createSSEWriter,
  streamAsyncGenerator,
  formatJsonRpcSSEEvent,
} from "@codespin/shaman-a2a-transport";
import { createLogger } from "@codespin/shaman-logger";
import { A2ARequestHandler } from "./request-handler.js";
import { createAuthMiddleware } from "./auth-middleware.js";
import type { AuthenticatedRequest } from "./auth-middleware.js";
import type { A2AServerConfig, A2AServerInstance } from "./types.js";
import type { A2AMethodContext } from "@codespin/shaman-a2a-transport";
import type {
  MessageSendParams,
  TaskQueryParams,
  TaskIdParams,
} from "@codespin/shaman-a2a-protocol";

const logger = createLogger("A2AServer");

/**
 * A2A protocol server
 */
export class A2AServer implements A2AServerInstance {
  private app: Express;
  private server?: Server;
  private transport: JsonRpcTransport;
  private requestHandler: A2ARequestHandler;

  constructor(private readonly config: A2AServerConfig) {
    this.app = express();
    this.requestHandler = new A2ARequestHandler(config);

    // Create transport with context extraction
    this.transport = new JsonRpcTransport({
      extractContext: (req) => {
        const authReq = req as AuthenticatedRequest;
        return {
          organizationId: authReq.auth?.organizationId,
          userId: authReq.auth?.userId,
          isInternal: authReq.auth?.isInternal || false,
        };
      },
    });

    this.setupRoutes();
    this.registerMethods();
  }

  private setupRoutes(): void {
    const router = express.Router();

    // Middleware
    router.use(express.json());

    // Agent discovery endpoint (no auth required)
    router.get("/.well-known/agent.json", (req, res) => {
      void (async () => {
        try {
          const agentCard = await this.requestHandler.getAgentCard();
          res.json(agentCard);
        } catch (error) {
          logger.error("Error fetching agent card:", error);
          res.status(500).json({ error: "Failed to retrieve agent card" });
        }
      })();
    });

    // Auth middleware for all other routes
    router.use((req, res, next) => {
      void Promise.resolve(createAuthMiddleware(this.config)(req, res, next));
    });

    // Main JSON-RPC endpoint
    router.post("/", (req, res) => {
      void this.transport.handle(req, res);
    });

    // Mount router
    this.app.use(this.config.baseUrl || "", router);

    // Health check
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", role: this.config.role });
    });
  }

  private registerMethods(): void {
    // Register all A2A methods
    this.transport.method(
      "message/send",
      async (params: unknown, context: A2AMethodContext) => {
        return this.requestHandler.sendMessage(
          params as MessageSendParams,
          context,
        );
      },
    );

    this.transport.method(
      "message/stream",
      async (params: unknown, context: A2AMethodContext) => {
        const generator = this.requestHandler.streamMessage(
          params as MessageSendParams,
          context,
        );

        // Set up SSE response
        const writer = createSSEWriter(context.response);

        // Stream responses
        await streamAsyncGenerator(generator, writer, (response) =>
          formatJsonRpcSSEEvent({
            jsonrpc: "2.0",
            id: (context.request.body as { id?: string | number })?.id || null,
            result: response,
          }),
        );

        return generator; // Signal that response is handled
      },
    );

    this.transport.method(
      "tasks/get",
      async (params: unknown, context: A2AMethodContext) => {
        return this.requestHandler.getTask(params as TaskQueryParams, context);
      },
    );

    this.transport.method(
      "tasks/cancel",
      async (params: unknown, context: A2AMethodContext) => {
        return this.requestHandler.cancelTask(params as TaskIdParams, context);
      },
    );

    this.transport.method(
      "tasks/resubscribe",
      async (params: unknown, context: A2AMethodContext) => {
        const generator = this.requestHandler.resubscribeTask(
          params as TaskIdParams,
          context,
        );

        // Set up SSE response
        const writer = createSSEWriter(context.response);

        // Stream responses
        await streamAsyncGenerator(generator, writer, (response) =>
          formatJsonRpcSSEEvent({
            jsonrpc: "2.0",
            id: (context.request.body as { id?: string | number })?.id || null,
            result: response,
          }),
        );

        return generator; // Signal that response is handled
      },
    );

    // Push notification methods (not supported in MVP)
    this.transport.method("tasks/pushNotificationConfig/set", async () => {
      throw new Error("Push notifications not supported");
    });

    this.transport.method("tasks/pushNotificationConfig/get", async () => {
      throw new Error("Push notifications not supported");
    });

    // Authenticated extended card (return same as regular card for MVP)
    this.transport.method("agent/authenticatedExtendedCard", async () => {
      return this.requestHandler.getAgentCard();
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        this.server.listen(this.config.port, () => {
          logger.info(
            `A2A server (${this.config.role}) started on port ${this.config.port}`,
          );
          resolve();
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info("A2A server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getUrl(): string {
    return `http://localhost:${this.config.port}${this.config.baseUrl || ""}`;
  }
}

/**
 * Create an A2A server instance
 */
export function createA2AServer(config: A2AServerConfig): A2AServerInstance {
  return new A2AServer(config);
}
