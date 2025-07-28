/**
 * Server startup script
 */

import { createLogger } from '@codespin/shaman-logger';
import { initializeFromConfig } from '@codespin/shaman-observability';
// import { initDb } from '@codespin/shaman-persistence';
import { startServer } from './main.js';
import type { ServerConfig } from './types.js';

const logger = createLogger('ServerStartup');

async function main(): Promise<void> {
  try {
    logger.info('Starting Shaman server...');

    // TODO: Initialize database
    logger.info('Database initialization skipped (TODO)');

    // Initialize observability
    logger.info('Initializing observability...');
    await initializeFromConfig();
    logger.info('Observability initialized');

    // Server configuration
    const config: ServerConfig = {
      port: parseInt(process.env.PORT || '4000'),
      host: process.env.HOST || 'localhost',
      cors: {
        enabled: true,
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
      },
      graphql: {
        path: '/graphql',
        playground: process.env.NODE_ENV !== 'production',
        introspection: process.env.NODE_ENV !== 'production',
        subscriptions: {
          enabled: true,
          path: '/graphql',
        },
      },
      security: {
        helmet: true,
        rateLimit: process.env.NODE_ENV === 'production' ? {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100, // limit each IP to 100 requests per windowMs
        } : undefined,
      },
      logging: {
        level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
        format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
      },
    };

    // Start the server with Apollo GraphQL
    await startServer(config);

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}