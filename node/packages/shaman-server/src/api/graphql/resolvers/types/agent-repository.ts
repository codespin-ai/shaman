/**
 * AgentRepository type field resolvers
 */

import { createLogger } from '@codespin/shaman-logger';
import { getGitAgentsByRepository, getUserById } from '../../../../persistence-adapter.js';
import type { AgentRepository } from '@codespin/shaman-types';

const _logger = createLogger('AgentRepositoryResolvers');

export const agentRepositoryResolvers = {
  /**
   * Resolve agent count for repository
   */
  agentCount: async (parent: AgentRepository) => {
    const result = await getGitAgentsByRepository(parent.name, 1000, 0);
    return result.success ? result.data.length : 0;
  },

  /**
   * Resolve discovered agents
   */
  discoveredAgents: async (parent: AgentRepository) => {
    const result = await getGitAgentsByRepository(parent.name, 100, 0);
    return result.success ? result.data : [];
  },

  /**
   * Resolve created by user
   */
  createdBy: async (parent: AgentRepository & { createdBy?: number | object }) => {
    if (parent.createdBy && typeof parent.createdBy === 'object') {
      return parent.createdBy;
    }
    if (parent.createdBy && typeof parent.createdBy === 'number') {
      const result = await getUserById(parent.createdBy);
      return result.success ? result.data : null;
    }
    return null;
  },

  /**
   * Map sync status
   */
  lastSyncStatus: (parent: AgentRepository) => {
    return parent.lastSyncStatus || 'NEVER_SYNCED';
  },

  /**
   * Sync errors (placeholder)
   */
  syncErrors: () => [],

  /**
   * Auth type (placeholder)
   */
  authType: () => 'none',
};