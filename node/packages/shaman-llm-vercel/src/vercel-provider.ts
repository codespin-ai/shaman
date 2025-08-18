/**
 * Vercel AI SDK LLM provider implementation
 */

import {
  generateText,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type SystemModelMessage,
  type UserModelMessage,
  type AssistantModelMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type {
  LLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMMessage,
} from "@codespin/shaman-llm-core";
import type { VercelLLMConfig, ModelConfig } from "./types.js";

/**
 * Create a Vercel AI SDK LLM provider
 */
export function createVercelLLMProvider(config: VercelLLMConfig): LLMProvider {
  /**
   * Get model configuration
   */
  function getModelConfig(modelName: string): ModelConfig | null {
    if (config.models[modelName]) {
      return config.models[modelName];
    }

    if (config.defaultModel && config.models[config.defaultModel]) {
      return config.models[config.defaultModel];
    }

    return null;
  }

  /**
   * Create model instance
   */
  function createModel(modelName: string): LanguageModel {
    const modelConfig = getModelConfig(modelName);
    if (!modelConfig) {
      throw new Error(`Model '${modelName}' not found in configuration`);
    }

    switch (modelConfig.provider) {
      case "openai": {
        const apiKey = modelConfig.apiKey || config.apiKeys?.openai;
        if (!apiKey) {
          throw new Error("OpenAI API key not provided");
        }
        // Create OpenAI provider with API key
        const openaiProvider = createOpenAI({
          apiKey,
          baseURL: modelConfig.baseURL,
        });
        return openaiProvider(modelConfig.modelId) as unknown as LanguageModel;
      }

      case "anthropic": {
        const apiKey = modelConfig.apiKey || config.apiKeys?.anthropic;
        if (!apiKey) {
          throw new Error("Anthropic API key not provided");
        }
        // Create Anthropic provider with API key
        const anthropicProvider = createAnthropic({
          apiKey,
          baseURL: modelConfig.baseURL,
        });
        return anthropicProvider(
          modelConfig.modelId,
        ) as unknown as LanguageModel;
      }

      case "custom": {
        throw new Error("Custom providers not yet implemented");
      }

      default: {
        // This should never happen due to TypeScript exhaustiveness checking
        const _exhaustiveCheck: never = modelConfig.provider;
        throw new Error(`Unknown provider type: ${_exhaustiveCheck as string}`);
      }
    }
  }

  /**
   * Convert LLM messages to Vercel AI SDK format
   * Note: We skip tool messages as the AI SDK handles tool execution internally
   */
  function convertMessages(messages: LLMMessage[]): ModelMessage[] {
    return messages
      .filter((msg) => msg.role !== "tool") // Skip tool messages
      .map((msg) => {
        if (msg.role === "system") {
          return {
            role: "system" as const,
            content: msg.content,
          } satisfies SystemModelMessage;
        }

        if (msg.role === "user") {
          return {
            role: "user" as const,
            content: msg.content,
          } satisfies UserModelMessage;
        }

        // Assistant messages
        return {
          role: "assistant" as const,
          content: msg.content,
        } satisfies AssistantModelMessage;
      });
  }

  /**
   * Convert tools to Vercel AI SDK format
   */
  function convertTools(tools?: LLMCompletionRequest["tools"]):
    | Record<
        string,
        {
          description: string;
          parameters: Record<string, unknown>;
        }
      >
    | undefined {
    if (!tools) return undefined;

    const toolsMap: Record<
      string,
      {
        description: string;
        parameters: Record<string, unknown>;
      }
    > = {};

    for (const tool of tools) {
      toolsMap[tool.function.name] = {
        description: tool.function.description,
        parameters: tool.function.parameters,
      };
    }

    return toolsMap;
  }

  return {
    async complete(
      request: LLMCompletionRequest,
    ): Promise<LLMCompletionResponse> {
      try {
        // Create model
        const model = createModel(request.model);
        const modelConfig = getModelConfig(request.model)!;

        // Handle tool calls
        if (request.tools && request.tools.length > 0) {
          const result = await generateText({
            model,
            messages: convertMessages(request.messages),
            temperature: request.temperature ?? modelConfig.defaultTemperature,
            maxOutputTokens: request.max_tokens ?? modelConfig.defaultMaxTokens,
            tools: convertTools(request.tools),
          });

          return {
            id: `vercel-${Date.now()}`,
            model: request.model,
            content: result.text,
            tool_calls: result.toolCalls?.map((tc) => ({
              id: tc.toolCallId,
              type: "function" as const,
              function: {
                name: tc.toolName,
                arguments: JSON.stringify(tc.input),
              },
            })),
            finish_reason: result.finishReason as
              | "stop"
              | "length"
              | "tool_calls",
            usage: result.usage
              ? {
                  prompt_tokens: result.usage.inputTokens ?? 0,
                  completion_tokens: result.usage.outputTokens ?? 0,
                  total_tokens: result.usage.totalTokens ?? 0,
                }
              : undefined,
          };
        } else {
          // Regular text generation
          const result = await generateText({
            model,
            messages: convertMessages(request.messages),
            temperature: request.temperature ?? modelConfig.defaultTemperature,
            maxOutputTokens: request.max_tokens ?? modelConfig.defaultMaxTokens,
          });

          return {
            id: `vercel-${Date.now()}`,
            model: request.model,
            content: result.text,
            finish_reason: result.finishReason as
              | "stop"
              | "length"
              | "tool_calls",
            usage: result.usage
              ? {
                  prompt_tokens: result.usage.inputTokens ?? 0,
                  completion_tokens: result.usage.outputTokens ?? 0,
                  total_tokens: result.usage.totalTokens ?? 0,
                }
              : undefined,
          };
        }
      } catch (error) {
        throw new Error(
          `LLM completion failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    async *stream(
      request: LLMCompletionRequest,
    ): AsyncIterable<LLMStreamChunk> {
      try {
        // Create model
        const model = createModel(request.model);
        const modelConfig = getModelConfig(request.model)!;

        const result = streamText({
          model,
          messages: convertMessages(request.messages),
          temperature: request.temperature ?? modelConfig.defaultTemperature,
          maxOutputTokens: request.max_tokens ?? modelConfig.defaultMaxTokens,
          tools: request.tools ? convertTools(request.tools) : undefined,
        });

        // Stream text content
        for await (const textPart of result.textStream) {
          yield {
            type: "content",
            content: textPart,
          };
        }

        // Get final result with tool calls if any
        const finalResult = await result.response;

        if (finalResult.messages && finalResult.messages.length > 0) {
          const lastMessage =
            finalResult.messages[finalResult.messages.length - 1];
          if (
            "toolCalls" in lastMessage &&
            (lastMessage as { toolCalls?: unknown[] }).toolCalls
          ) {
            let toolCallIndex = 0;
            const toolCalls =
              (
                lastMessage as {
                  toolCalls?: Array<{
                    toolCallId: string;
                    toolName: string;
                    input: unknown;
                  }>;
                }
              ).toolCalls || [];
            for (const toolCall of toolCalls) {
              yield {
                type: "tool_call",
                tool_call: {
                  index: toolCallIndex++,
                  id: toolCall.toolCallId,
                  function: {
                    name: toolCall.toolName,
                    arguments: JSON.stringify(toolCall.input),
                  },
                },
              };
            }
          }
        }

        // Yield finish chunk
        yield {
          type: "finish",
          finish_reason: "stop",
        };
      } catch (error) {
        throw new Error(
          `LLM streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    listModels(): Promise<string[]> {
      return Promise.resolve(Object.keys(config.models));
    },
  };
}
