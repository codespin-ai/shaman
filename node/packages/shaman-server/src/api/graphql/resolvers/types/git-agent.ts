/**
 * GitAgent type field resolvers
 */

import { createLogger } from '@codespin/shaman-logger';
import { getAgentRepositoryById } from '../../../../persistence-adapter.js';
import type { GitAgent } from '@codespin/shaman-types';

const _logger = createLogger('GitAgentResolvers');

export const gitAgentResolvers = {
  /**
   * Resolve repository for agent
   */
  repository: async (parent: GitAgent & { repository?: unknown; repositoryId?: number }) => {
    if (parent.repository && typeof parent.repository === 'object') {
      return parent.repository;
    }
    if (parent.repositoryId) {
      const result = await getAgentRepositoryById(parent.repositoryId);
      if (result.success) {
        return {
          ...result.data,
          lastSyncStatus: result.data.lastSyncStatus || 'NEVER_SYNCED',
          syncErrors: [],
          authType: 'none',
          agentCount: 0,
          discoveredAgents: [],
        };
      }
    }
    return null;
  },

  /**
   * Map context scope
   */
  contextScope: (parent: GitAgent & { contextScope?: string; context_scope?: string }) => {
    const scope = parent.contextScope || parent.context_scope || 'full';
    return scope.toUpperCase();
  },

  /**
   * Computed properties
   */
  isNamespaced: (parent: GitAgent) => {
    return parent.name.includes('.');
  },

  fullPath: (parent: GitAgent & { filePath?: string; file_path?: string }) => {
    return parent.filePath || parent.file_path || `agents/${parent.name}.md`;
  },

  /**
   * Analytics placeholders
   */
  usageCount: () => 0,
  lastUsed: () => null,
  averageExecutionTime: () => null,
  successRate: () => null,
};