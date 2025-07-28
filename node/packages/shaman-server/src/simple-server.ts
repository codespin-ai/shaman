/**
 * Simple server implementation for basic functionality
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json } from 'body-parser';
import { createLogger } from '@codespin/shaman-logger';
import { tracingMiddleware, metricsMiddleware } from '@codespin/shaman-observability';
import { v4 as uuidv4 } from 'uuid';
import { createHealthCheckRouter } from './api/health.js';
import type { ServerConfig } from './types.js';

const logger = createLogger('SimpleServer');

/**
 * Create and start a simple Express server
 */
export function startSimpleServer(config: ServerConfig): void {
  const app = express();

  // Trust proxy
  app.set('trust proxy', true);

  // Security
  if (config.security.helmet) {
    app.use(helmet());
  }

  // CORS
  if (config.cors.enabled) {
    app.use(cors({
      origin: config.cors.origin || true,
      credentials: config.cors.credentials,
    }));
  }

  // Compression
  app.use(compression());

  // Body parsing
  app.use(json({ limit: '10mb' }));

  // Request ID middleware
  app.use((req: any, _res, next) => {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    next();
  });

  // Observability
  app.use(tracingMiddleware() as unknown as express.RequestHandler);
  app.use(metricsMiddleware() as unknown as express.RequestHandler);

  // Health checks
  app.use('/health', createHealthCheckRouter());

  // Basic GraphQL endpoint placeholder
  app.post('/graphql', (req, res) => {
    res.json({
      data: {
        message: 'GraphQL endpoint coming soon',
      },
    });
  });

  // Error handling
  app.use((err: Error, req: any, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err,
      requestId: req.requestId,
    });

    res.status(500).json({
      error: 'Internal server error',
      requestId: req.requestId,
    });
  });

  // 404 handler
  app.use((req: any, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      requestId: req.requestId,
    });
  });

  // Start server
  const server = app.listen(config.port, config.host, () => {
    logger.info(`Server ready at http://${config.host}:${config.port}`, {
      port: config.port,
      host: config.host,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}