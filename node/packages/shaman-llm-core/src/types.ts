/**
 * LLM provider interface and types
 */

/**
 * LLM message format
 */
export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
};

/**
 * Tool definition for function calling
 */
export type LLMTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/**
 * LLM completion request
 */
export type LLMCompletionRequest = {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  tools?: LLMTool[];
  tool_choice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
};

/**
 * LLM completion response
 */
export type LLMCompletionResponse = {
  id: string;
  model: string;
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  finish_reason?: "stop" | "length" | "tool_calls";
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

/**
 * LLM provider interface
 */
export interface LLMProvider {
  /**
   * Get a completion from the LLM
   */
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;

  /**
   * Stream a completion from the LLM
   */
  stream?(request: LLMCompletionRequest): AsyncIterable<LLMStreamChunk>;

  /**
   * List available models
   */
  listModels?(): Promise<string[]>;
}

/**
 * Stream chunk for streaming responses
 */
export type LLMStreamChunk = {
  type: "content" | "tool_call" | "finish";
  content?: string;
  tool_call?: {
    index: number;
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  };
  finish_reason?: "stop" | "length" | "tool_calls";
};
