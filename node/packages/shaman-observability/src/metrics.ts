/**
 * OpenTelemetry metrics setup and utilities
 */

import { metrics } from '@opentelemetry/api';
import type { Meter } from '@opentelemetry/api';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { 
  SEMRESATTRS_SERVICE_NAME, 
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT 
} from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { createLogger } from '@codespin/shaman-logger';
import type { ObservabilityConfig, AgentMetrics } from './types.js';

const logger = createLogger('Metrics');

let meterProvider: MeterProvider | undefined;
let meter: Meter | undefined;
let agentMetrics: AgentMetrics | undefined;

/**
 * Initialize metrics with the given configuration
 */
export async function initializeMetrics(config: ObservabilityConfig): Promise<void> {
  if (!config.metrics?.enabled) {
    logger.info('Metrics are disabled');
    return;
  }

  try {
    // Create resource with service information
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion || 'unknown',
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment || 'development',
    });

    // Create metric readers based on configuration
    const readers = [];

    if (config.metrics.consoleExporter) {
      // Console exporter for debugging
      const ConsoleMetricExporter = (await import('@opentelemetry/sdk-metrics')).ConsoleMetricExporter;
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: config.metrics.exportInterval || 60000,
        })
      );
      logger.info('Added console metric exporter');
    }

    if (config.metrics.endpoint) {
      // OTLP exporter for production
      const otlpExporter = new OTLPMetricExporter({
        url: config.metrics.endpoint,
      });
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: otlpExporter,
          exportIntervalMillis: config.metrics.exportInterval || 60000,
        })
      );
      logger.info('Added OTLP metric exporter', { endpoint: config.metrics.endpoint });
    }

    // Create meter provider
    meterProvider = new MeterProvider({
      resource,
      readers,
    });

    // Set global meter provider
    metrics.setGlobalMeterProvider(meterProvider);

    // Get meter instance
    meter = metrics.getMeter(config.serviceName, config.serviceVersion);

    // Initialize agent-specific metrics
    agentMetrics = createAgentMetrics(meter);

    logger.info('Metrics initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize metrics', { error });
    throw error;
  }
}

/**
 * Shutdown metrics gracefully
 */
export async function shutdownMetrics(): Promise<void> {
  if (meterProvider) {
    try {
      await meterProvider.shutdown();
      logger.info('Metrics shutdown successfully');
    } catch (error) {
      logger.error('Error shutting down metrics', { error });
    }
  }
}

/**
 * Create agent-specific metrics
 */
function createAgentMetrics(meter: Meter): AgentMetrics {
  return {
    // Agent execution metrics
    agentExecutions: meter.createCounter('shaman.agent.executions', {
      description: 'Total number of agent executions',
      unit: 'executions',
    }),
    
    agentExecutionDuration: meter.createHistogram('shaman.agent.execution.duration', {
      description: 'Duration of agent executions',
      unit: 'milliseconds',
    }),
    
    agentExecutionErrors: meter.createCounter('shaman.agent.execution.errors', {
      description: 'Total number of agent execution errors',
      unit: 'errors',
    }),
    
    // Tool call metrics
    toolCalls: meter.createCounter('shaman.tool.calls', {
      description: 'Total number of tool calls',
      unit: 'calls',
    }),
    
    toolCallDuration: meter.createHistogram('shaman.tool.call.duration', {
      description: 'Duration of tool calls',
      unit: 'milliseconds',
    }),
    
    // LLM metrics
    llmTokensUsed: meter.createCounter('shaman.llm.tokens.used', {
      description: 'Total number of LLM tokens used',
      unit: 'tokens',
    }),
    
    // Active agents gauge
    activeAgents: meter.createUpDownCounter('shaman.agents.active', {
      description: 'Number of currently active agents',
      unit: 'agents',
    }),
  };
}

/**
 * Get the agent metrics instance
 */
export function getMetrics(): AgentMetrics {
  if (!agentMetrics) {
    throw new Error('Metrics not initialized. Call initializeMetrics first.');
  }
  return agentMetrics;
}

/**
 * Record agent execution metrics
 */
export function recordAgentExecution(
  agentName: string,
  agentSource: string,
  duration: number,
  success: boolean,
  attributes?: Record<string, string | number>
): void {
  if (!agentMetrics) return;

  const baseAttributes = {
    'agent.name': agentName,
    'agent.source': agentSource,
    'execution.success': success,
    ...attributes,
  };

  agentMetrics.agentExecutions.add(1, baseAttributes);
  agentMetrics.agentExecutionDuration.record(duration, baseAttributes);
  
  if (!success) {
    agentMetrics.agentExecutionErrors.add(1, baseAttributes);
  }
}

/**
 * Record tool call metrics
 */
export function recordToolCall(
  toolName: string,
  toolType: string,
  duration: number,
  success: boolean,
  attributes?: Record<string, string | number>
): void {
  if (!agentMetrics) return;

  const baseAttributes = {
    'tool.name': toolName,
    'tool.type': toolType,
    'execution.success': success,
    ...attributes,
  };

  agentMetrics.toolCalls.add(1, baseAttributes);
  agentMetrics.toolCallDuration.record(duration, baseAttributes);
}

/**
 * Record LLM token usage
 */
export function recordLLMTokenUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  attributes?: Record<string, string | number>
): void {
  if (!agentMetrics) return;

  const baseAttributes = {
    'llm.model': model,
    'token.type': 'input',
    ...attributes,
  };

  agentMetrics.llmTokensUsed.add(inputTokens, baseAttributes);
  agentMetrics.llmTokensUsed.add(outputTokens, { ...baseAttributes, 'token.type': 'output' });
}

/**
 * Update active agents count
 */
export function updateActiveAgents(delta: number, attributes?: Record<string, string | number>): void {
  if (!agentMetrics) return;
  
  agentMetrics.activeAgents.add(delta, attributes);
}

/**
 * Create a timer for measuring duration
 */
export function createTimer(): { stop: () => number } {
  const startTime = Date.now();
  return {
    stop: () => Date.now() - startTime,
  };
}
