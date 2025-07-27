/**
 * Vercel AI SDK LLM provider implementation
 */

import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import type { LLMProvider, LLMCompletionRequest, LLMCompletionResponse, LLMStreamChunk, LLMMessage } from '@codespin/shaman-llm-core';
import type { Result } from '@codespin/shaman-core';
import type { VercelLLMConfig, ModelConfig } from './types.js';

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
  function createModel(modelName: string) {
    const modelConfig = getModelConfig(modelName);
    if (!modelConfig) {
      throw new Error(`Model '${modelName}' not found in configuration`);
    }

    switch (modelConfig.provider) {
      case 'openai': {
        const apiKey = modelConfig.apiKey || config.apiKeys?.openai;
        if (!apiKey) {
          throw new Error('OpenAI API key not provided');
        }
        // Direct model creation with API key in environment
        process.env.OPENAI_API_KEY = apiKey;
        return openai(modelConfig.modelId);
      }
      
      case 'anthropic': {
        const apiKey = modelConfig.apiKey || config.apiKeys?.anthropic;
        if (!apiKey) {
          throw new Error('Anthropic API key not provided');
        }
        // Direct model creation with API key in environment
        process.env.ANTHROPIC_API_KEY = apiKey;
        return anthropic(modelConfig.modelId);
      }
      
      case 'custom': {
        throw new Error('Custom providers not yet implemented');
      }
      
      default:
        throw new Error(`Unknown provider type: ${modelConfig.provider}`);
    }
  }

  /**
   * Convert LLM messages to Vercel AI SDK format
   */
  function convertMessages(messages: LLMMessage[]): Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
    toolCallId?: string;
  }> {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          toolCallId: msg.tool_call_id,
        };
      }
      
      if (msg.tool_calls) {
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
          toolCalls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            }
          }))
        };
      }
      
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  /**
   * Convert tools to Vercel AI SDK format
   */
  function convertTools(tools?: LLMCompletionRequest['tools']): Record<string, {
    description: string;
    parameters: Record<string, unknown>;
  }> | undefined {
    if (!tools) return undefined;
    
    const toolsMap: Record<string, {
      description: string;
      parameters: Record<string, unknown>;
    }> = {};
    
    for (const tool of tools) {
      toolsMap[tool.function.name] = {
        description: tool.function.description,
        parameters: tool.function.parameters,
      };
    }
    
    return toolsMap;
  }

  return {
    async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
      try {
        // Create model
        const model = createModel(request.model);
        const modelConfig = getModelConfig(request.model)!;
        
        // Handle tool calls
        if (request.tools && request.tools.length > 0) {
          const result = await generateText({
            model: model as Parameters<typeof generateText>[0]['model'],
            messages: convertMessages(request.messages),
            temperature: request.temperature ?? modelConfig.defaultTemperature,
            maxTokens: request.max_tokens ?? modelConfig.defaultMaxTokens,
            tools: convertTools(request.tools),
          });

          return {
            id: `vercel-${Date.now()}`,
            model: request.model,
            content: result.text,
            tool_calls: result.toolCalls?.map(tc => ({
              id: tc.toolCallId,
              type: 'function' as const,
              function: {
                name: tc.toolName,
                arguments: JSON.stringify(tc.args),
              }
            })),
            finish_reason: result.finishReason as 'stop' | 'length' | 'tool_calls',
            usage: result.usage ? {
              prompt_tokens: result.usage.promptTokens,
              completion_tokens: result.usage.completionTokens,
              total_tokens: result.usage.totalTokens,
            } : undefined,
          };
        } else {
          // Regular text generation
          const result = await generateText({
            model: model as Parameters<typeof generateText>[0]['model'],
            messages: convertMessages(request.messages),
            temperature: request.temperature ?? modelConfig.defaultTemperature,
            maxTokens: request.max_tokens ?? modelConfig.defaultMaxTokens,
          });

          return {
            id: `vercel-${Date.now()}`,
            model: request.model,
            content: result.text,
            finish_reason: result.finishReason as 'stop' | 'length' | 'tool_calls',
            usage: result.usage ? {
              prompt_tokens: result.usage.promptTokens,
              completion_tokens: result.usage.completionTokens,
              total_tokens: result.usage.totalTokens,
            } : undefined,
          };
        }
      } catch (error) {
        throw new Error(`LLM completion failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    async *stream(request: LLMCompletionRequest): AsyncIterable<LLMStreamChunk> {
      try {
        // Create model
        const model = createModel(request.model);
        const modelConfig = getModelConfig(request.model)!;
        
        const result = await streamText({
          model: model as Parameters<typeof streamText>[0]['model'],
          messages: convertMessages(request.messages),
          temperature: request.temperature ?? modelConfig.defaultTemperature,
          maxTokens: request.max_tokens ?? modelConfig.defaultMaxTokens,
          tools: request.tools ? convertTools(request.tools) : undefined,
        });

        // Stream text content
        for await (const textPart of result.textStream) {
          yield {
            type: 'content',
            content: textPart,
          };
        }

        // Get final result with tool calls if any
        const finalResult = await result.response;
        
        if (finalResult.messages && finalResult.messages.length > 0) {
          const lastMessage = finalResult.messages[finalResult.messages.length - 1];
          if ('toolCalls' in lastMessage && (lastMessage as { toolCalls?: unknown[] }).toolCalls) {
            let toolCallIndex = 0;
            const toolCalls = (lastMessage as { toolCalls: Array<{
              toolCallId: string;
              toolName: string;
              args: unknown;
            }> }).toolCalls;
            for (const toolCall of toolCalls) {
              yield {
                type: 'tool_call',
                tool_call: {
                  index: toolCallIndex++,
                  id: toolCall.toolCallId,
                  function: {
                    name: toolCall.toolName,
                    arguments: JSON.stringify(toolCall.args),
                  }
                }
              };
            }
          }
        }

        // Yield finish chunk
        yield {
          type: 'finish',
          finish_reason: 'stop',
        };
      } catch (error) {
        throw new Error(`LLM streaming failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    async listModels(): Promise<string[]> {
      return Object.keys(config.models);
    }
  };
}