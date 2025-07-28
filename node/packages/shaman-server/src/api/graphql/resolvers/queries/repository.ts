/**
 * Repository-related query resolvers
 */

import { GraphQLError } from 'graphql';
import { createLogger } from '@codespin/shaman-logger';
import { 
  getAgentRepositoryByName,
  getAllAgentRepositories,
  getGitAgentsByRepository
} from '../../../../persistence-adapter.js';
import type { GraphQLContext } from '../../../../types.js';

const logger = createLogger('RepositoryQueries');

export const repositoryQueries = {
  /**
   * Get agent repository by name
   */
  agentRepository: async (
    _parent: unknown, 
    args: { name: string }, 
    context: GraphQLContext
  ) => {
    logger.debug('Fetching agent repository', { 
      repositoryName: args.name,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const result = await getAgentRepositoryByName(args.name);
    if (!result.success) {
      if (result.error.message.includes('not found')) {
        return null;
      }
      logger.error('Failed to fetch repository', { 
        repositoryName: args.name,
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch repository', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    const repo = result.data;
    
    // Add computed fields
    return {
      ...repo,
      lastSyncStatus: repo.lastSyncStatus || 'NEVER_SYNCED',
      syncErrors: [], // TODO: Implement sync error tracking
      authType: 'none', // TODO: Map from actual auth configuration
      agentCount: 0, // Will be resolved in field resolver
      discoveredAgents: [], // Will be resolved in field resolver
    };
  },

  /**
   * List all agent repositories
   */
  agentRepositories: async (
    _parent: unknown, 
    _args: unknown, 
    context: GraphQLContext
  ) => {
    logger.debug('Fetching all agent repositories', { 
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const repos = await getAllAgentRepositories();

    // Map to GraphQL types
    return repos.map((repo: any) => ({
      ...repo,
      lastSyncStatus: repo.lastSyncStatus || 'NEVER_SYNCED',
      syncErrors: [],
      authType: 'none',
      agentCount: 0,
      discoveredAgents: [],
    }));
  },

  /**
   * Get Git branches for a repository
   */
  gitBranches: async (
    _parent: unknown,
    args: { repositoryName: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching Git branches', { 
      repositoryName: args.repositoryName,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement Git branch listing
    return ['main', 'develop'];
  },

  /**
   * Get Git tags for a repository
   */
  gitTags: async (
    _parent: unknown,
    args: { repositoryName: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching Git tags', { 
      repositoryName: args.repositoryName,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement Git tag listing
    return [];
  },

  /**
   * Get Git history for an agent
   */
  agentGitHistory: async (
    _parent: unknown,
    args: { agentName: string; limit?: number },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching agent Git history', { 
      agentName: args.agentName,
      limit: args.limit,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement Git history retrieval
    return [];
  },
};