/**
 * Shaman observability package - OpenTelemetry integration for AI agents
 */

// Main observability manager
export { 
  getObservabilityManager,
  initializeFromConfig 
} from './observability-manager.js';

// Tracing utilities
export {
  initializeTracing,
  shutdownTracing,
  createSpan,
  getActiveSpan,
  withSpan,
  createGenAISpan,
  createAgentSpan,
  createToolSpan,
  extractTraceContext,
} from './tracing.js';

// Metrics utilities
export {
  initializeMetrics,
  shutdownMetrics,
  getMetrics,
  recordAgentExecution,
  recordToolCall,
  recordLLMTokenUsage,
  updateActiveAgents,
  createTimer,
} from './metrics.js';

// Types
export type {
  ObservabilityConfig,
  ObservabilityManager,
  GenAIAttributes,
  AgentAttributes,
  ToolAttributes,
  ShamanSpanAttributes,
  CreateSpanOptions,
  AgentMetrics,
  TraceContext,
} from './types.js';

// HTTP instrumentation
export {
  tracingMiddleware,
  metricsMiddleware,
  observabilityMiddleware,
  getRequestSpan,
  addRequestSpanAttributes,
} from './instrumentation/http.js';

// Re-export commonly used OpenTelemetry types
export { 
  SpanKind, 
  SpanStatusCode
} from '@opentelemetry/api';
export type { Span, SpanOptions, Attributes } from '@opentelemetry/api';
