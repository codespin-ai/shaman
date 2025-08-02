/**
 * @codespin/shaman-a2a-client
 * 
 * A2A protocol HTTP client for agent-to-agent communication
 */

// Export types
export type {
  A2AClientConfig,
  A2AClient,
  InternalJWTPayload
} from './types.js';

// Export client
export { createA2AClient } from './client.js';

// Export JWT utilities
export { generateInternalJWT, verifyInternalJWT } from './jwt.js';

// Re-export protocol types for convenience
export type {
  SendMessageRequest,
  SendMessageResponse,
  SendStreamingMessageResponse,
  GetTaskRequest,
  GetTaskResponse,
  CancelTaskRequest,
  CancelTaskResponse,
  AgentCard,
  Message,
  Part,
  TextPart,
  FilePart,
  DataPart,
  TaskState
} from '@codespin/shaman-a2a-protocol';