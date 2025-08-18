/**
 * Agent executor types
 */

import type { Result } from "@codespin/shaman-core";
import type {
  Message,
  ToolCall,
  Step,
  RunContext,
  ExecutionState,
} from "@codespin/shaman-types";
import type { ToolRouter } from "@codespin/shaman-tool-router";
import type { LLMProvider } from "@codespin/shaman-llm-core";

/**
 * Agent definition (from Git or A2A)
 */
export type AgentDefinition = {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
  readonly model?: string;
  readonly systemPrompt?: string;
  readonly mcpServers?: Record<string, string[] | "*" | null>;
  readonly allowedAgents?: string[];
  readonly maxIterations?: number;
  readonly temperature?: number;
  readonly contextScope?: "FULL" | "NONE" | "SPECIFIC";
};

/**
 * Agent execution dependencies
 */
export type AgentExecutorDependencies = {
  readonly agentResolver: (name: string) => Promise<Result<AgentDefinition>>;
  readonly llmProvider: LLMProvider;
  readonly toolRouter: ToolRouter;
  readonly persistence: {
    createStep: (step: Partial<Step>) => Promise<Step>;
    updateStep: (id: string, updates: Partial<Step>) => Promise<Step>;
    getStep: (id: string) => Promise<Step | null>;
  };
  readonly a2aClient?: {
    executeAgent: (
      agentName: string,
      prompt: string,
      context: RunContext,
    ) => Promise<
      Result<{ id: string; status: { state: string }; artifacts: unknown[] }>
    >;
  };
};

/**
 * Agent execution request
 */
export type AgentExecutionRequest = {
  agentName: string;
  prompt?: string;
  input?: string;
  contextId?: string;
  contextScope?: "FULL" | "NONE";
  context: RunContext;
  organizationId: string;
  runId: string;
  stepId: string;
  parentStepId?: string;
  depth: number;
  agentSource?: string;
};

/**
 * Agent execution result
 */
export type AgentExecutionResult = {
  stepId?: string;
  output?: unknown;
  status?: ExecutionState;
  childStepIds?: string[];
  metadata?: Record<string, unknown>;
  messages: Message[];
  finalResult?: unknown;
  state: ExecutionState;
  totalTokens: number;
  totalCost: number;
};

/**
 * Conversation state during execution
 */
export type ConversationState = {
  messages: Message[];
  toolCalls: Map<string, ToolCall>;
  iterations: number;
  totalTokens: number;
  totalCost: number;
};

/**
 * Agent execution options
 */
export type AgentExecutionOptions = {
  readonly maxIterations?: number;
  readonly timeout?: number;
  readonly stream?: boolean;
};

/**
 * Tool execution result
 */
export type ToolExecutionResult = {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly result: unknown;
  readonly success: boolean;
  readonly error?: string;
  readonly isAgentCall: boolean;
};

/**
 * LLM completion result
 */
export type LLMCompletionResult = {
  readonly content: string;
  readonly toolCalls?: ToolCall[];
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cost: number;
  readonly finishReason?: "stop" | "length" | "tool_calls";
};
