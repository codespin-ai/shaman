/**
 * Health check endpoints
 */

import { Router } from 'express';
import { createLogger } from '@codespin/shaman-logger';
// import { getDb } from '@codespin/shaman-persistence';
import type { AuthenticatedRequest } from '../types.js';

const logger = createLogger('HealthCheck');

export function createHealthCheckRouter(): Router {
  const router = Router();

  // Basic liveness check
  router.get('/live', (_req: AuthenticatedRequest, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness check with database connectivity
  router.get('/ready', async (req: AuthenticatedRequest, res) => {
    try {
      // TODO: Check database connectivity
      // const db = getDb();
      // await db.one('SELECT 1 as check');

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unknown', // TODO: Check actual connectivity
        },
      });
    } catch (error) {
      logger.error('Health check failed', { 
        error, 
        requestId: req.requestId 
      });

      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'disconnected',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Detailed health check
  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      // TODO: Check database
      // const db = getDb();
      // const dbCheck = await db.one('SELECT version() as version, current_timestamp as timestamp');
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {
          database: {
            status: 'unknown', // TODO: Check actual status
            version: 'unknown',
            timestamp: new Date().toISOString(),
          },
        },
      };

      res.status(200).json(health);
    } catch (error) {
      logger.error('Detailed health check failed', { 
        error, 
        requestId: req.requestId 
      });

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}