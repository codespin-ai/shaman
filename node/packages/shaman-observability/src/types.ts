/**
 * Observability types and interfaces
 */

import type { Span, SpanOptions, Attributes } from '@opentelemetry/api';
import type { Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

/**
 * Observability configuration
 */
export type ObservabilityConfig = {
  readonly serviceName: string;
  readonly serviceVersion?: string;
  readonly environment?: string;
  readonly tracing?: {
    readonly enabled: boolean;
    readonly endpoint?: string;
    readonly exportInterval?: number;
    readonly consoleExporter?: boolean;
  };
  readonly metrics?: {
    readonly enabled: boolean;
    readonly endpoint?: string;
    readonly exportInterval?: number;
    readonly consoleExporter?: boolean;
  };
  readonly captureContent?: boolean; // Whether to capture AI content (privacy consideration)
};

/**
 * GenAI semantic convention attributes
 */
export type GenAIAttributes = {
  readonly 'gen_ai.system': string; // e.g., "openai", "anthropic"
  readonly 'gen_ai.request.model': string;
  readonly 'gen_ai.request.temperature'?: number;
  readonly 'gen_ai.request.max_tokens'?: number;
  readonly 'gen_ai.request.top_p'?: number;
  readonly 'gen_ai.response.model'?: string;
  readonly 'gen_ai.response.id'?: string;
  readonly 'gen_ai.response.finish_reasons'?: string[];
  readonly 'gen_ai.usage.input_tokens'?: number;
  readonly 'gen_ai.usage.output_tokens'?: number;
  readonly 'gen_ai.operation.name'?: string;
};

/**
 * Agent-specific attributes
 */
export type AgentAttributes = {
  readonly 'agent.name': string;
  readonly 'agent.source': 'git' | 'external' | 'a2a';
  readonly 'agent.version'?: string;
  readonly 'agent.namespace'?: string;
  readonly 'workflow.run_id'?: string;
  readonly 'workflow.step_id'?: string;
};

/**
 * Tool execution attributes
 */
export type ToolAttributes = {
  readonly 'tool.name': string;
  readonly 'tool.type': 'sync' | 'async' | 'agent_call' | 'mcp';
  readonly 'tool.call_id'?: string;
  readonly 'tool.duration_ms'?: number;
};

/**
 * Combined attributes for Shaman
 */
export type ShamanSpanAttributes = Partial<GenAIAttributes & AgentAttributes & ToolAttributes> & Attributes;

/**
 * Span creation options
 */
export type CreateSpanOptions = SpanOptions & {
  readonly attributes?: ShamanSpanAttributes;
};

/**
 * Agent metrics
 */
export type AgentMetrics = {
  readonly agentExecutions: Counter;
  readonly agentExecutionDuration: Histogram;
  readonly agentExecutionErrors: Counter;
  readonly toolCalls: Counter;
  readonly toolCallDuration: Histogram;
  readonly llmTokensUsed: Counter;
  readonly activeAgents: UpDownCounter;
};

/**
 * Observability manager interface
 */
export interface ObservabilityManager {
  /**
   * Initialize observability with configuration
   */
  initialize(config: ObservabilityConfig): Promise<void>;

  /**
   * Shutdown observability gracefully
   */
  shutdown(): Promise<void>;

  /**
   * Create a new span
   */
  createSpan(name: string, options?: CreateSpanOptions): Span;

  /**
   * Get current active span
   */
  getActiveSpan(): Span | undefined;

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics;

  /**
   * Log a GenAI event
   */
  logGenAIEvent(
    eventName: 'gen_ai.system.message' | 'gen_ai.user.message' | 'gen_ai.assistant.message' | 'gen_ai.tool.message' | 'gen_ai.choice',
    attributes: Record<string, unknown>,
    content?: string
  ): void;
}

/**
 * Trace context for propagation
 */
export type TraceContext = {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags?: number;
};