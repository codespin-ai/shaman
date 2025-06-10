// TODO: Implement Anthropic Provider Functions
// Exported functions:
// - createAnthropicProvider(config: AnthropicConfig): AnthropicProvider
// - callClaude(provider: AnthropicProvider, request: LLMRequest): Promise<LLMResponse>
// - streamClaude(provider: AnthropicProvider, request: LLMRequest): AsyncIterable<LLMStreamChunk>
// - formatAnthropicMessages(messages: Message[]): AnthropicMessage[]
// - formatAnthropicTools(tools: Tool[]): AnthropicTool[]
// - parseAnthropicResponse(response: AnthropicAPIResponse): LLMResponse
// - handleAnthropicError(error: AnthropicError): LLMError
// - calculateAnthropicCost(usage: TokenUsage, model: string): number
//
// Types:
// - type AnthropicProvider = { config: AnthropicConfig; client: AnthropicClient; ... }
// - type AnthropicConfig = { apiKey: string; baseUrl?: string; timeout: number; ... }
// - type AnthropicMessage = { role: 'user' | 'assistant'; content: string; ... }
// - type AnthropicTool = { name: string; description: string; input_schema: JSONSchema; ... }
//
// Claude API integration with streaming and tool use support
