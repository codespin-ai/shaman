/**
 * Run and execution-related query resolvers
 */

import { GraphQLError } from 'graphql';
import { createLogger } from '@codespin/shaman-logger';
import { 
  getRunById,
  getRunsByUser,
  getRunsNeedingInput,
} from '../../../../persistence-adapter.js';
import type { GraphQLContext } from '../../../../types.js';

const logger = createLogger('RunQueries');

export const runQueries = {
  /**
   * Get run by ID
   */
  run: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
    logger.debug('Fetching run by ID', { 
      runId: args.id,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const result = await getRunById(parseInt(args.id));
    if (!result.success) {
      if (result.error.message.includes('not found')) {
        return null;
      }
      logger.error('Failed to fetch run', { 
        runId: args.id,
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch run', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    const run = result.data;

    // Check permissions - users can only see their own runs unless admin
    if (run.createdBy !== context.user.id.toString() && 
        context.user.role !== 'ADMIN' && 
        context.user.role !== 'SUPER_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Add computed fields
    return {
      ...run,
      stepCount: 0, // TODO: Get step count from persistence
      dagStatus: {
        interactableSteps: [],
        blockedSteps: [],
        activeSteps: [],
        cancellableSubgraphs: [],
        agentCallGraph: [],
      },
      pendingInputRequest: null, // TODO: Implement
      totalAgentCalls: 0, // TODO: Implement
      maxCallDepth: 0, // TODO: Implement
      uniqueAgentsInvolved: 0, // TODO: Implement
      gitAgentsUsed: [],
      externalAgentsUsed: [],
    };
  },

  /**
   * List runs with filters
   */
  runs: async (
    _parent: unknown,
    args: {
      filters?: {
        status?: string;
        agentName?: string;
        agentSource?: string;
        createdBy?: string;
        createdAfter?: Date;
        createdBefore?: Date;
        hasInputRequests?: boolean;
        hasAgentCalls?: boolean;
        hasExternalCalls?: boolean;
        minCallDepth?: number;
        maxCallDepth?: number;
        gitRepository?: string;
        gitCommit?: string;
      };
      limit?: number;
      offset?: number;
    },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching runs', { 
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

    const limit = args.limit || 20;
    const offset = args.offset || 0;

    // Regular users can only see their own runs
    const userId = context.user.role === 'ADMIN' || context.user.role === 'SUPER_ADMIN'
      ? args.filters?.createdBy ? parseInt(args.filters.createdBy) : undefined
      : context.user.id;

    const result = await getRunsByUser(userId, limit, offset);
    if (!result.success) {
      logger.error('Failed to fetch runs', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch runs', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    // Map and add computed fields
    return result.data.map(run => ({
      ...run,
      stepCount: 0, // TODO: Get step count from persistence
      dagStatus: {
        interactableSteps: [],
        blockedSteps: [],
        activeSteps: [],
        cancellableSubgraphs: [],
        agentCallGraph: [],
      },
      pendingInputRequest: null,
      totalAgentCalls: 0,
      maxCallDepth: 0,
      uniqueAgentsInvolved: 0,
      gitAgentsUsed: [],
      externalAgentsUsed: [],
    }));
  },

  /**
   * Find runs needing input
   */
  runsNeedingInput: async (
    _parent: unknown,
    args: { limit?: number },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching runs needing input', { 
      limit: args.limit,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const limit = args.limit || 50;

    // For regular users, only show their own runs
    const userId = context.user.role === 'ADMIN' || context.user.role === 'SUPER_ADMIN'
      ? undefined
      : context.user.id;

    const result = await getRunsNeedingInput(userId, limit);
    if (!result.success) {
      logger.error('Failed to fetch runs needing input', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch runs needing input', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    // Map and add computed fields
    return result.data.map(run => ({
      ...run,
      stepCount: 0, // TODO: Get step count from persistence
      dagStatus: {
        interactableSteps: [],
        blockedSteps: [],
        activeSteps: [],
        cancellableSubgraphs: [],
        agentCallGraph: [],
      },
      pendingInputRequest: null, // TODO: Implement proper input request mapping
      totalAgentCalls: 0,
      maxCallDepth: 0,
      uniqueAgentsInvolved: 0,
      gitAgentsUsed: [],
      externalAgentsUsed: [],
    }));
  },

  /**
   * Get agent call graph for a run
   */
  agentCallGraph: async (
    _parent: unknown,
    args: { runId: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching agent call graph', { 
      runId: args.runId,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement agent call graph generation
    return {};
  },

  /**
   * Get circular call attempts
   */
  circularCallAttempts: async (
    _parent: unknown,
    args: { agentName?: string; timeRange?: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching circular call attempts', { 
      agentName: args.agentName,
      timeRange: args.timeRange,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement circular call detection
    return [];
  },

  /**
   * Get MCP servers
   */
  mcpServer: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching MCP server', { 
      serverId: args.id,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement MCP server retrieval
    return null;
  },

  /**
   * List MCP servers
   */
  mcpServers: async (
    _parent: unknown,
    args: { source?: string; type?: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching MCP servers', { 
      source: args.source,
      type: args.type,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement MCP server listing
    return [];
  },

  /**
   * Get tool by ID
   */
  tool: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching tool', { 
      toolId: args.id,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement tool retrieval
    return null;
  },

  /**
   * List tools
   */
  tools: async (
    _parent: unknown,
    args: { mcpServerId?: string; limit?: number; offset?: number },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching tools', { 
      mcpServerId: args.mcpServerId,
      limit: args.limit,
      offset: args.offset,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement tool listing
    return [];
  },

  /**
   * Get system tools
   */
  systemTools: async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext
  ) => {
    logger.debug('Fetching system tools', { 
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement system tool listing
    return [];
  },

  /**
   * Get external A2A agent
   */
  externalA2AAgent: async (
    _parent: unknown,
    args: { id?: string },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching external A2A agent', { 
      agentId: args.id,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement external A2A agent retrieval
    return null;
  },

  /**
   * List external A2A agents
   */
  externalA2AAgents: async (
    _parent: unknown,
    args: { limit?: number; offset?: number },
    context: GraphQLContext
  ) => {
    logger.debug('Fetching external A2A agents', { 
      limit: args.limit,
      offset: args.offset,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Implement external A2A agent listing
    return [];
  },
};