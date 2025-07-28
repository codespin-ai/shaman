# @codespin/shaman-llm-vercel

Vercel AI SDK implementation of the Shaman LLM provider interface. This package enables integration with OpenAI and Anthropic models through a unified interface.

## Overview

This package provides:
- Unified interface for multiple LLM providers
- Support for OpenAI models (GPT-4, GPT-3.5-turbo)
- Support for Anthropic models (Claude-3)
- Streaming and non-streaming completions
- Tool/function calling support
- Configurable model routing

## Installation

```bash
npm install @codespin/shaman-llm-vercel
```

## Usage

### Basic Setup

```typescript
import { createVercelLLMProvider } from '@codespin/shaman-llm-vercel';

const provider = createVercelLLMProvider({
  models: {
    'gpt-4': { 
      provider: 'openai', 
      modelId: 'gpt-4' 
    },
    'gpt-3.5-turbo': { 
      provider: 'openai', 
      modelId: 'gpt-3.5-turbo' 
    },
    'claude-3': { 
      provider: 'anthropic', 
      modelId: 'claude-3-opus-20240229' 
    }
  },
  defaultModel: 'gpt-4',
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY
  }
});
```

### Making Completions

```typescript
// Simple completion
const response = await provider.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  model: 'gpt-4',
  temperature: 0.7
});

// Output: "The capital of France is Paris."
```

### Tool Calling

```typescript
// Define tools
const tools = [{
  type: 'function' as const,
  function: {
    name: 'get_weather',
    description: 'Get weather information',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      },
      required: ['location']
    }
  }
}];

// Completion with tools
const response = await provider.complete({
  messages: [
    { role: 'user', content: 'What\'s the weather in London?' }
  ],
  model: 'gpt-4',
  tools
});

// Handle tool calls
if (response.tool_calls) {
  for (const toolCall of response.tool_calls) {
    // Tool: get_weather
    // Args: {"location":"London"}
  }
}
```

### Streaming Completions

```typescript
const stream = await provider.streamComplete({
  messages: [
    { role: 'user', content: 'Write a short story' }
  ],
  model: 'gpt-4',
  stream: true
});

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

## Configuration

### Provider Configuration

```typescript
type VercelLLMProviderConfig = {
  // Model routing configuration
  models: {
    [modelName: string]: {
      provider: 'openai' | 'anthropic';
      modelId: string;
    };
  };
  
  // Default model if none specified
  defaultModel?: string;
  
  // API keys for providers
  apiKeys: {
    openai?: string;
    anthropic?: string;
  };
  
  // Optional base URLs for custom endpoints
  baseUrls?: {
    openai?: string;
    anthropic?: string;
  };
};
```

### Supported Models

#### OpenAI Models
- `gpt-4`: Latest GPT-4 model
- `gpt-4-turbo-preview`: GPT-4 Turbo
- `gpt-3.5-turbo`: GPT-3.5 Turbo
- `gpt-3.5-turbo-16k`: Extended context window

#### Anthropic Models
- `claude-3-opus-20240229`: Most capable Claude model
- `claude-3-sonnet-20240229`: Balanced performance
- `claude-3-haiku-20240307`: Fast and efficient

## API Reference

### createVercelLLMProvider

Creates a new LLM provider instance.

```typescript
function createVercelLLMProvider(
  config: VercelLLMProviderConfig
): LLMProvider
```

### LLMProvider Interface

```typescript
interface LLMProvider {
  // Non-streaming completion
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  
  // Streaming completion
  streamComplete(request: LLMStreamingRequest): Promise<AsyncIterable<LLMStreamChunk>>;
  
  // List available models
  listModels(): Promise<LLMModel[]>;
  
  // Check if a model is available
  hasModel(modelId: string): Promise<boolean>;
}
```

### Types

```typescript
// Completion request
type LLMCompletionRequest = {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: LLMTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'json_object' | 'text' };
  stop?: string | string[];
  stream?: false;
};

// Message format
type LLMMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
};

// Tool call
type LLMToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

// Completion response
type LLMCompletionResponse = {
  content: string | null;
  tool_calls?: LLMToolCall[];
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};
```

## Error Handling

The provider handles common errors gracefully:

```typescript
try {
  const response = await provider.complete({
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'gpt-4'
  });
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // Handle rate limiting
  } else if (error.code === 'invalid_api_key') {
    // Handle authentication error
  } else {
    // Handle other errors
  }
}
```

## Best Practices

1. **Model Selection**: Choose appropriate models for your use case
   - GPT-4: Complex reasoning, creative tasks
   - GPT-3.5-turbo: Fast, cost-effective for simple tasks
   - Claude-3-opus: Long context, nuanced understanding

2. **Temperature Settings**: 
   - 0.0-0.3: Deterministic, factual responses
   - 0.4-0.7: Balanced creativity and consistency
   - 0.8-1.0: Creative, varied responses

3. **Token Management**: Monitor token usage to control costs
   ```typescript
   const response = await provider.complete({ ... });
   // Tokens used: 150
   ```

4. **Error Handling**: Always handle API errors gracefully
5. **API Key Security**: Never commit API keys to version control

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional custom endpoints
OPENAI_BASE_URL=https://custom-openai-endpoint.com
ANTHROPIC_BASE_URL=https://custom-anthropic-endpoint.com
```

## License

MIT