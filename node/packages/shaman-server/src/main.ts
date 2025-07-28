/**
 * Express server setup with middleware
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json } from 'body-parser';
import { createLogger } from '@codespin/shaman-logger';
import { 
  tracingMiddleware, 
  metricsMiddleware, 
  getObservabilityManager 
} from '@codespin/shaman-observability';
import { v4 as uuidv4 } from 'uuid';
import type { ServerConfig, AuthenticatedRequest } from './types.js';
import { createApolloServer } from './api/graphql/server.js';
import { expressMiddleware } from '@apollo/server/express4';
import { createHealthCheckRouter } from './api/health.js';

const logger = createLogger('Server');

/**
 * Create the Express application with all middleware
 */
export async function createExpressApp(config: ServerConfig): Promise<express.Application> {
  const app = express();

  // Trust proxy for proper IP resolution
  app.set('trust proxy', true);

  // Security middleware
  if (config.security.helmet) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Allow GraphQL playground in development
          scriptSrc: config.graphql.playground 
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"]
            : ["'self'"],
          styleSrc: config.graphql.playground
            ? ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"]
            : ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }));
  }

  // CORS configuration
  if (config.cors.enabled) {
    app.use(cors({
      origin: config.cors.origin || true,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));
  }

  // Compression
  app.use(compression());

  // Body parsing
  app.use(json({ limit: '10mb' }));

  // Request ID middleware
  app.use((req: AuthenticatedRequest, _res, next) => {
    req.requestId = req.headers['x-request-id'] as string || uuidv4();
    next();
  });

  // Observability middleware
  const observabilityManager = getObservabilityManager();
  if (observabilityManager) {
    app.use(tracingMiddleware() as unknown as express.RequestHandler);
    app.use(metricsMiddleware() as unknown as express.RequestHandler);
  }

  // Request logging
  app.use((req: AuthenticatedRequest, _res, next) => {
    logger.info('Request received', {
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });

  // Health check routes
  app.use('/health', createHealthCheckRouter());

  // GraphQL server will be mounted separately
  logger.info('Express app created with middleware');
  
  return app;
}

/**
 * Start the server
 */
export async function startServer(config: ServerConfig): Promise<void> {
  try {
    logger.info('Starting Shaman server...', { config });

    // Create Express app
    const app = await createExpressApp(config);

    // Create and start Apollo Server
    const apolloServer = await createApolloServer(config);
    await apolloServer.start();
    
    // Apply Apollo Server middleware
    app.use(
      config.graphql.path,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
      expressMiddleware(apolloServer as any, {
        context: async ({ req }: { req: unknown }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return await (apolloServer as any).createContext({ req });
        },
      }) as unknown as express.RequestHandler
    );

    // Error handling middleware
    app.use((err: Error, req: AuthenticatedRequest, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error', {
        error: err,
        requestId: req.requestId,
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId,
      });
    });

    // 404 handler
    app.use((req: AuthenticatedRequest, res: express.Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
        requestId: req.requestId,
      });
    });

    // Start HTTP server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`Server ready at http://${config.host}:${config.port}${config.graphql.path}`, {
        port: config.port,
        host: config.host,
        graphqlPath: config.graphql.path,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Stop Apollo server
        apolloServer.stop()
          .then(() => {
            logger.info('Apollo server stopped');
            
            const observabilityManager = getObservabilityManager();
            if (observabilityManager) {
              return observabilityManager.shutdown()
                .then(() => {
                  logger.info('Observability shutdown complete');
                })
                .catch((error: unknown) => {
                  logger.error('Error during observability shutdown', { error });
                });
            }
          })
          .then(() => {
            process.exit(0);
          })
          .catch((error: unknown) => {
            logger.error('Error during shutdown', { error });
            process.exit(1);
          });
      });
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}