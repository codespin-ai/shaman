/**
 * Agent-related query resolvers
 */

import { GraphQLError } from 'graphql';
import { createLogger } from '@codespin/shaman-logger';
import { 
  getGitAgentByName, 
  getGitAgentsByRepository,
  searchGitAgents 
} from '../../../../persistence-adapter.js';
import type { GraphQLContext } from '../../../../types.js';

const logger = createLogger('AgentQueries');

export const agentQueries = {
  /**
   * Get agent by name (unified interface)
   */
  agent: async (_parent: unknown, args: { name: string }, context: GraphQLContext) => {
    logger.debug('Fetching agent by name', { 
      agentName: args.name,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // For now, use the git agent lookup directly
    const gitResult = await getGitAgentByName(args.name);
    if (!gitResult.success) {
      if (gitResult.error.message.includes('not found')) {
        return null;
      }
      logger.error('Failed to resolve agent', { 
        agentName: args.name,
        error: gitResult.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to resolve agent', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    const agent = gitResult.data;
    
    // Map to GraphQL Agent type
    return {
      name: agent.name,
      description: agent.description || '',
      version: agent.version || '1.0.0',
      source: 'GIT',
      gitAgent: agent,
      externalA2AAgent: null,
      tags: agent.tags || [],
      usageCount: 0, // TODO: Implement usage tracking
      lastUsed: null,
      averageExecutionTime: null,
      successRate: null,
      analytics: {
        totalRuns: 0,
        successRate: 0,
        averageExecutionTime: 0,
        averageCost: 0,
        userRating: null,
        usageGrowth: 0,
        peakUsageHours: [],
        commonFailureReasons: [],
        costTrend: [],
        performanceTrend: [],
        completionReliability: 0,
        averageChildAgents: 0,
        inputRequestFrequency: 0,
        agentCallFrequency: 0,
        circularCallAttempts: 0,
      },
    };
  },

  /**
   * Get Git agent by name
   */
  gitAgent: async (_parent: unknown, args: { name: string }, context: GraphQLContext) => {
    logger.debug('Fetching Git agent by name', { 
      agentName: args.name,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const result = await getGitAgentByName(args.name);
    if (!result.success) {
      if (result.error.message.includes('not found')) {
        return null;
      }
      logger.error('Failed to fetch Git agent', { 
        agentName: args.name,
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch Git agent', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return result.data;
  },

  /**
   * List Git agents with filters
   */
  gitAgents: async (
    _parent: unknown, 
    args: { 
      filters?: {
        repositoryName?: string;
        tags?: string[];
        hasAllowedAgents?: boolean;
        lastModifiedAfter?: Date;
        lastModifiedBefore?: Date;
      };
      limit?: number; 
      offset?: number;
    }, 
    context: GraphQLContext
  ) => {
    logger.debug('Fetching Git agents', { 
      filters: args.filters,
      limit: args.limit,
      offset: args.offset,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;

    // If repository filter is provided, use optimized query
    if (args.filters?.repositoryName) {
      const result = await getGitAgentsByRepository(args.filters.repositoryName, limit, offset);
      if (!result.success) {
        logger.error('Failed to fetch Git agents by repository', { 
          error: result.error,
          requestId: context.requestId 
        });
        throw new GraphQLError('Failed to fetch Git agents', {
          extensions: { 
            code: 'INTERNAL_SERVER_ERROR',
            requestId: context.requestId,
          },
        });
      }
      return result.data;
    }

    // Otherwise use search
    const result = await searchGitAgents({
      tags: args.filters?.tags,
      hasAllowedAgents: args.filters?.hasAllowedAgents,
      lastModifiedAfter: args.filters?.lastModifiedAfter,
      lastModifiedBefore: args.filters?.lastModifiedBefore,
    }, limit, offset);

    if (!result.success) {
      logger.error('Failed to search Git agents', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch Git agents', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return result.data;
  },

  /**
   * Search agents across all sources
   */
  searchAgents: async (
    _parent: unknown,
    args: {
      filters: {
        query?: string;
        source?: 'GIT' | 'A2A_EXTERNAL';
        repositoryName?: string;
        tags?: string[];
        providers?: string[];
        minVersion?: string;
        isActive?: boolean;
        hasExternalAccess?: boolean;
        createdBy?: string;
      };
      sort?: {
        field: string;
        direction: 'ASC' | 'DESC';
      };
      limit?: number;
      offset?: number;
    },
    context: GraphQLContext
  ) => {
    logger.debug('Searching agents', { 
      filters: args.filters,
      sort: args.sort,
      limit: args.limit,
      offset: args.offset,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement comprehensive agent search
    // For now, return empty results
    return {
      agents: [],
      totalCount: 0,
      suggestedTags: [],
      facets: {
        sources: [],
        repositories: [],
        tags: [],
        providers: [],
        versions: [],
      },
    };
  },

  /**
   * Get recommended agents
   */
  recommendAgents: async (
    _parent: unknown,
    args: {
      basedOnAgent?: string;
      forUser?: string;
      limit?: number;
    },
    context: GraphQLContext
  ) => {
    logger.debug('Getting agent recommendations', { 
      basedOnAgent: args.basedOnAgent,
      forUser: args.forUser,
      limit: args.limit,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement agent recommendations
    return [];
  },
};