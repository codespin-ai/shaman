/**
 * StreamChunk union type resolver
 */

export const streamChunkResolvers = {
  __resolveType(obj: Record<string, unknown>) {
    // Determine the concrete type based on object properties
    if ('content' in obj && 'timestamp' in obj && !('toolCallId' in obj)) {
      return 'TokenChunk';
    }
    if ('message' in obj && 'level' in obj) {
      return 'LogChunk';
    }
    if ('toolCallId' in obj && 'toolName' in obj) {
      return 'ToolCallStartChunk';
    }
    if ('toolCallId' in obj && 'payload' in obj) {
      return 'ToolStreamChunk';
    }
    if ('toolCallId' in obj && 'output' in obj) {
      return 'ToolResultChunk';
    }
    if ('completion' in obj && 'stepId' in obj) {
      return 'CompletionChunk';
    }
    if ('inputRequest' in obj) {
      return 'InputRequestChunk';
    }
    if ('parentStepId' in obj && 'childStepId' in obj && 'input' in obj) {
      return 'AgentCallStartChunk';
    }
    if ('parentStepId' in obj && 'childStepId' in obj && 'completion' in obj) {
      return 'AgentCallCompleteChunk';
    }
    
    throw new Error('Could not resolve StreamChunk type');
  },
};