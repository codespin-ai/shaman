/**
 * packages/shaman-git-resolver/src/index.ts
 *
 * Barrel export for the git-resolver package.
 */

export * from './agent-resolver.js';
export * from './git-manager.js';
export * from './agent-discovery.js';

// Export persistence functions for other packages that might need them
export * from './persistence/agent-repository.js';
export * from './persistence/git-agent.js';
