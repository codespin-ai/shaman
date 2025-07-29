/**
 * User-related query resolvers
 */

import { GraphQLError } from 'graphql';
import { createLogger } from '@codespin/shaman-logger';
import { getUserById, getAllUsers } from '../../../../persistence-adapter.js';
import type { GraphQLContext } from '../../../../types.js';

const logger = createLogger('UserQueries');

export const userQueries = {
  /**
   * Get current authenticated user
   */
  me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
    logger.debug('Fetching current user', { 
      userId: context.user?.id,
      requestId: context.requestId 
    });

    if (!context.user) {
      return null;
    }

    return context.user;
  },

  /**
   * Get user by ID
   */
  user: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
    logger.debug('Fetching user by ID', { 
      userId: args.id,
      requestId: context.requestId 
    });

    // Check permissions
    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Only admins can fetch other users
    if (context.user.id !== args.id && context.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const result = await getUserById(args.id);
    if (!result.success) {
      logger.error('Failed to fetch user', { 
        userId: args.id, 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch user', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return result.data;
  },

  /**
   * List all users with pagination
   */
  users: async (
    _parent: unknown, 
    args: { limit?: number; offset?: number }, 
    context: GraphQLContext
  ) => {
    logger.debug('Fetching users list', { 
      limit: args.limit,
      offset: args.offset,
      requestId: context.requestId 
    });

    // Check permissions - only admins can list users
    if (!context.user || (context.user.systemRole !== 'SYSTEM_ADMIN')) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const limit = args.limit || 20;
    const offset = args.offset || 0;

    const result = await getAllUsers(limit, offset);
    if (!result.success) {
      logger.error('Failed to fetch users', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to fetch users', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return result.data;
  },
};