/**
 * packages/shaman-a2a-provider/src/index.ts
 * 
 * Public API for the A2A provider module
 */

// Export all types
export * from './types.js';

// Export server creation
export { createA2AServer } from './a2a-server.js';

// Export adapter functions
export { convertToA2ACard, canExposeAgent } from './agent-adapter.js';

// Export message handler
export { handleMessageSend } from './message-handler.js';

// Convenience function to start a standalone A2A server
export { startA2AProvider } from './standalone.js';