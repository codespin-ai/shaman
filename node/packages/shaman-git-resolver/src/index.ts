/**
 * @fileoverview Entry point for the shaman-git-resolver package.
 */

export { syncRepository } from './git-manager.js';
export { discoverAgents } from './agent-discovery.js';
export { discoverAllAgents } from './git-discovery.js';
export { AgentResolver } from './agent-resolver.js';
export type { GitRepository } from './types.js';
export type { GitAgent } from '@shaman/core/types/agent.js';
