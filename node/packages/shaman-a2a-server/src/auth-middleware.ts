import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createLogger } from "@codespin/shaman-logger";
import type { A2AServerConfig, AuthResult } from "./types.js";

const logger = createLogger("A2AAuthMiddleware");

// Extend Request interface to include auth
export interface AuthenticatedRequest extends Request {
  auth?: AuthResult;
}

/**
 * Create authentication middleware for A2A server
 */
export function createAuthMiddleware(config: A2AServerConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // Internal server with JWT auth
      if (config.role === "internal") {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.status(401).json({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32001,
              message: "Unauthorized: Missing bearer token",
            },
          });
          return;
        }

        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, config.jwtSecret!) as {
            organizationId?: string;
            userId?: string;
          };

          authReq.auth = {
            organizationId: decoded.organizationId || config.organizationId!,
            userId: decoded.userId,
            isInternal: true,
          };

          next();
        } catch (error) {
          logger.error("JWT verification failed", error);
          res.status(401).json({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32001,
              message: "Unauthorized: Invalid token",
            },
          });
        }
      }
      // Public server with API key auth
      else {
        const apiKey = req.headers["x-api-key"] as string;

        if (!apiKey) {
          res.status(401).json({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32001,
              message: "Unauthorized: Missing API key",
            },
          });
          return;
        }

        if (!config.validateApiKey) {
          logger.error("No API key validator configured for public server");
          res.status(500).json({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message: "Internal error: Authentication not configured",
            },
          });
          return;
        }

        const result = await config.validateApiKey(apiKey);

        if (!result.success) {
          res.status(401).json({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32001,
              message: "Unauthorized: Invalid API key",
            },
          });
          return;
        }

        authReq.auth = {
          organizationId: result.data.organizationId,
          isInternal: false,
        };

        next();
      }
    } catch (error) {
      logger.error("Authentication error", error);
      res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error during authentication",
        },
      });
    }
  };
}
