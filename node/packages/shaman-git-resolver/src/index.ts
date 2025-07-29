/**
 * packages/shaman-git-resolver/src/index.ts
 *
 * Barrel export for the git-resolver package.
 */

export * from './agent-resolver.js';
export * from './git-manager.js';
export * from './agent-discovery.js';

// Export domain functions for other packages that might need them
export * from './domain/agent-repository/index.js';
export * from './domain/git-agent/index.js';
