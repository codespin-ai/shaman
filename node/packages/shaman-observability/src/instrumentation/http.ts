/**
 * HTTP instrumentation utilities and middleware
 */

import type { Request, Response, NextFunction } from 'express';
import type { Span } from '@opentelemetry/api';
import { createSpan, getActiveSpan } from '../tracing.js';
import { createTimer, getMetrics } from '../metrics.js';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from '@codespin/shaman-logger';

const logger = createLogger('HTTPInstrumentation');

/**
 * Express middleware for automatic request tracing
 */
interface RequestWithSpan extends Request {
  __span?: Span;
}

export function tracingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const routeInfo = req.route as { path?: string } | undefined;
    const spanName = `${req.method} ${routeInfo?.path || req.path}`;
    
    const span = createSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.get('user-agent'),
        'net.peer.ip': req.ip,
      },
    });

    // Store span in request for later use
    (req as RequestWithSpan).__span = span;

    // Track response
    const originalSend = res.send;
    res.send = function(data: unknown): Response {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response.size': Buffer.byteLength(data as string | Buffer),
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Express middleware for request metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = createTimer();
    const routeInfo = req.route as { path?: string } | undefined;
    const route = routeInfo?.path || req.path;

    // Track response metrics
    const originalSend = res.send;
    res.send = function(data: unknown): Response {
      const duration = timer.stop();
      
      try {
        const _metrics = getMetrics();
        
        // Record HTTP request metrics
        const labels = {
          method: req.method,
          route: route,
          status_code: res.statusCode.toString(),
        };

        // You could add specific HTTP metrics here if needed
        // For now, we'll log the request
        logger.debug('HTTP request completed', {
          ...labels,
          duration,
        });
      } catch (error) {
        logger.error('Failed to record HTTP metrics', { error });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Combined middleware for both tracing and metrics
 */
export function observabilityMiddleware() {
  const tracing = tracingMiddleware();
  const metrics = metricsMiddleware();

  return (req: Request, res: Response, next: NextFunction): void => {
    tracing(req, res, () => {
      metrics(req, res, next);
    });
  };
}

/**
 * Get the span from the current request
 */
export function getRequestSpan(req: Request): Span | undefined {
  return (req as RequestWithSpan).__span || getActiveSpan();
}

/**
 * Add custom attributes to the current request span
 */
export function addRequestSpanAttributes(req: Request, attributes: Record<string, unknown>): void {
  const span = getRequestSpan(req);
  if (span) {
    // Convert unknown values to proper AttributeValue types
    const safeAttributes: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safeAttributes[key] = value;
      } else if (value !== null && value !== undefined) {
        safeAttributes[key] = String(value);
      }
    }
    span.setAttributes(safeAttributes);
  }
}
