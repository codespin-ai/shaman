/**
 * Type-specific resolvers for interfaces and field resolution
 */

import { agentRepositoryResolvers } from './agent-repository.js';
import { gitAgentResolvers } from './git-agent.js';
import { runResolvers } from './run.js';
import { stepResolvers } from './step.js';
import { streamChunkResolvers } from './stream-chunk.js';

export const typeResolvers = {
  AgentRepository: agentRepositoryResolvers,
  GitAgent: gitAgentResolvers,
  Run: runResolvers,
  Step: stepResolvers,
  StreamChunk: streamChunkResolvers,
};