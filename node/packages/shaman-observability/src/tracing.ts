/**
 * OpenTelemetry tracing setup and utilities
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import type { Span, SpanOptions, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { 
  SEMRESATTRS_SERVICE_NAME, 
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT 
} from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { createLogger } from '@codespin/shaman-logger';
import type { ObservabilityConfig, CreateSpanOptions, ShamanSpanAttributes } from './types.js';

const logger = createLogger('Tracing');

let tracerProvider: NodeTracerProvider | undefined;
let tracer: Tracer | undefined;

/**
 * Initialize tracing with the given configuration
 */
export function initializeTracing(config: ObservabilityConfig): void {
  if (!config.tracing?.enabled) {
    logger.info('Tracing is disabled');
    return;
  }

  try {
    // Create resource with service information
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion || 'unknown',
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment || 'development',
    });

    // Create tracer provider
    tracerProvider = new NodeTracerProvider({
      resource,
    });

    // Add span processors based on configuration
    if (config.tracing.consoleExporter) {
      const consoleExporter = new ConsoleSpanExporter();
      tracerProvider.addSpanProcessor(new BatchSpanProcessor(consoleExporter));
      logger.info('Added console span exporter');
    }

    if (config.tracing.endpoint) {
      const otlpExporter = new OTLPTraceExporter({
        url: config.tracing.endpoint,
      });
      tracerProvider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));
      logger.info('Added OTLP span exporter', { endpoint: config.tracing.endpoint });
    }

    // Register tracer provider
    tracerProvider.register();

    // Get tracer instance
    tracer = trace.getTracer(config.serviceName, config.serviceVersion);

    // Register auto-instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          requestHook: (span, request) => {
            if ('headers' in request && typeof request.headers === 'object' && request.headers !== null && 'content-length' in request.headers) {
              const contentLength = request.headers['content-length'];
              span.setAttributes({
                'http.request.body.size': contentLength || 0,
              });
            }
          },
        }),
        new ExpressInstrumentation(),
      ],
    });

    logger.info('Tracing initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize tracing', { error });
    throw error;
  }
}

/**
 * Shutdown tracing gracefully
 */
export async function shutdownTracing(): Promise<void> {
  if (tracerProvider) {
    try {
      await tracerProvider.shutdown();
      logger.info('Tracing shutdown successfully');
    } catch (error) {
      logger.error('Error shutting down tracing', { error });
    }
  }
}

/**
 * Create a new span with Shaman-specific attributes
 */
export function createSpan(name: string, options?: CreateSpanOptions): Span {
  if (!tracer) {
    // Return a no-op span if tracing is not initialized
    return trace.getTracer('noop').startSpan('noop');
  }

  const spanOptions: SpanOptions = {
    kind: options?.kind || SpanKind.INTERNAL,
    attributes: options?.attributes,
    links: options?.links,
    startTime: options?.startTime,
    root: options?.root,
  };

  return tracer.startSpan(name, spanOptions, options?.root ? undefined : context.active());
}

/**
 * Get the current active span
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Execute a function within a span context
 */
export async function withSpan<T>(
  name: string,
  options: CreateSpanOptions | undefined,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const span = createSpan(name, options);
  
  try {
    // Execute function within span context
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Create a span for GenAI operations
 */
export function createGenAISpan(
  operationName: string,
  model: string,
  attributes?: ShamanSpanAttributes
): Span {
  const spanName = `${operationName} ${model}`;
  
  return createSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes: {
      'gen_ai.operation.name': operationName,
      'gen_ai.request.model': model,
      ...attributes,
    },
  });
}

/**
 * Create a span for agent execution
 */
export function createAgentSpan(
  agentName: string,
  agentSource: 'git' | 'external' | 'a2a',
  attributes?: ShamanSpanAttributes
): Span {
  const spanName = `agent ${agentName}`;
  
  return createSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'agent.name': agentName,
      'agent.source': agentSource,
      ...attributes,
    },
  });
}

/**
 * Create a span for tool execution
 */
export function createToolSpan(
  toolName: string,
  toolType: 'sync' | 'async' | 'agent_call' | 'mcp',
  attributes?: ShamanSpanAttributes
): Span {
  const spanName = `tool ${toolName}`;
  
  return createSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'tool.name': toolName,
      'tool.type': toolType,
      ...attributes,
    },
  });
}

/**
 * Extract trace context for propagation
 */
export function extractTraceContext(span: Span): { traceId: string; spanId: string; traceFlags: number } {
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}
