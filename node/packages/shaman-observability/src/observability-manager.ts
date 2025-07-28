/**
 * Main observability manager implementation
 */

// OpenTelemetry imports
import type { Span } from '@opentelemetry/api';
import { createLogger } from '@codespin/shaman-logger';
import { loadConfig } from '@codespin/shaman-config';
import type { ObservabilityConfig, ObservabilityManager, CreateSpanOptions, AgentMetrics } from './types.js';
import { 
  initializeTracing, 
  shutdownTracing, 
  createSpan as createTracingSpan,
  getActiveSpan as getActiveTracingSpan 
} from './tracing.js';
import { 
  initializeMetrics, 
  shutdownMetrics, 
  getMetrics as getMetricsInstance 
} from './metrics.js';

const logger = createLogger('ObservabilityManager');

/**
 * Default observability manager implementation
 */
class ObservabilityManagerImpl implements ObservabilityManager {
  private initialized = false;
  private config: ObservabilityConfig | undefined;

  async initialize(config: ObservabilityConfig): Promise<void> {
    if (this.initialized) {
      logger.warn('Observability already initialized');
      return;
    }

    try {
      this.config = config;
      
      // Initialize tracing
      initializeTracing(config);
      
      // Initialize metrics
      await initializeMetrics(config);
      
      this.initialized = true;
      logger.info('Observability initialized successfully', {
        serviceName: config.serviceName,
        serviceVersion: config.serviceVersion,
        environment: config.environment,
      });
    } catch (error) {
      logger.error('Failed to initialize observability', { error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await shutdownTracing();
      await shutdownMetrics();
      
      this.initialized = false;
      logger.info('Observability shut down successfully');
    } catch (error) {
      logger.error('Error during observability shutdown', { error });
      throw error;
    }
  }

  createSpan(name: string, options?: CreateSpanOptions): Span {
    if (!this.initialized) {
      logger.warn('Creating span before observability initialization');
    }
    return createTracingSpan(name, options);
  }

  getActiveSpan(): Span | undefined {
    return getActiveTracingSpan();
  }

  getMetrics(): AgentMetrics {
    if (!this.initialized) {
      throw new Error('Observability not initialized');
    }
    return getMetricsInstance();
  }

  logGenAIEvent(
    eventName: 'gen_ai.system.message' | 'gen_ai.user.message' | 'gen_ai.assistant.message' | 'gen_ai.tool.message' | 'gen_ai.choice',
    attributes: Record<string, unknown>,
    content?: string
  ): void {
    const span = this.getActiveSpan();
    if (!span) {
      logger.warn('No active span for GenAI event', { eventName });
      return;
    }

    // Log event on the span
    const eventAttributes: Record<string, unknown> = {
      'event.name': eventName,
      ...attributes,
    };

    // Only include content if capture is enabled
    if (this.config?.captureContent && content) {
      eventAttributes['gen_ai.content'] = content;
    }

    // Convert unknown values to proper AttributeValue types
    const safeAttributes: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(eventAttributes)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safeAttributes[key] = value;
      } else if (value !== null && value !== undefined) {
        safeAttributes[key] = JSON.stringify(value);
      }
    }

    span.addEvent(eventName, safeAttributes);
  }
}

// Singleton instance
let observabilityManager: ObservabilityManager | undefined;

/**
 * Get the observability manager instance
 */
export function getObservabilityManager(): ObservabilityManager {
  if (!observabilityManager) {
    observabilityManager = new ObservabilityManagerImpl();
  }
  return observabilityManager;
}

/**
 * Initialize observability from configuration
 */
export async function initializeFromConfig(configPath?: string): Promise<ObservabilityManager> {
  const configResult = loadConfig({ configPath });
  
  if (!configResult.success) {
    throw configResult.error;
  }

  const _config = configResult.data;
  
  // Build observability config from main config
  const observabilityConfig: ObservabilityConfig = {
    serviceName: 'shaman',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    tracing: {
      enabled: true,
      endpoint: process.env.OTLP_TRACES_ENDPOINT,
      consoleExporter: process.env.NODE_ENV === 'development',
      exportInterval: 5000,
    },
    metrics: {
      enabled: true,
      endpoint: process.env.OTLP_METRICS_ENDPOINT,
      consoleExporter: process.env.NODE_ENV === 'development',
      exportInterval: 60000,
    },
    captureContent: process.env.CAPTURE_AI_CONTENT === 'true',
  };

  const manager = getObservabilityManager();
  await manager.initialize(observabilityConfig);
  
  return manager;
}