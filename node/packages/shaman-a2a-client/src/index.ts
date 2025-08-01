/**
 * @codespin/shaman-a2a-client
 * 
 * A2A protocol HTTP client for agent-to-agent communication
 */

// Export types
export type {
  A2AClientConfig,
  A2AMessage,
  A2AMessagePart,
  A2ATask,
  A2ATaskStatus,
  A2AArtifact,
  A2ASendMessageRequest,
  A2ASendMessageResponse,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2ADiscoveryResponse,
  A2AAgentCard,
  InternalJWTPayload
} from './types.js';

// Export client
export { A2AClient } from './client.js';

// Export JWT utilities
export { generateInternalJWT, verifyInternalJWT } from './jwt.js';

// Export factory function
export { createA2AClient } from './factory.js';