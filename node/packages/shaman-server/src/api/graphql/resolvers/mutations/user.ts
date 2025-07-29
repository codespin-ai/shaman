/**
 * User-related mutation resolvers
 */

import { GraphQLError } from 'graphql';
import { createLogger } from '@codespin/shaman-logger';
import { createUser, updateUser } from '../../../../persistence-adapter.js';
import type { GraphQLContext } from '../../../../types.js';

const logger = createLogger('UserMutations');

export const userMutations = {
  /**
   * Create a new user
   */
  createUser: async (
    _parent: unknown,
    args: {
      input: {
        email: string;
        name: string;
        systemRole?: 'USER' | 'SYSTEM_ADMIN';
      };
    },
    context: GraphQLContext
  ) => {
    logger.debug('Creating user', { 
      email: args.input.email,
      requestId: context.requestId 
    });

    // Check permissions - only admins can create users
    if (!context.user || (context.user.systemRole !== 'SYSTEM_ADMIN')) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const result = await createUser({
      email: args.input.email,
      name: args.input.name,
      systemRole: args.input.systemRole || 'USER',
      isActive: true,
    });

    if (!result.success) {
      logger.error('Failed to create user', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to create user', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return result.data;
  },

  /**
   * Update user
   */
  updateUser: async (
    _parent: unknown,
    args: {
      id: string;
      input: {
        name?: string;
        systemRole?: 'USER' | 'SYSTEM_ADMIN';
        isActive?: boolean;
      };
    },
    context: GraphQLContext
  ) => {
    logger.debug('Updating user', { 
      userId: args.id,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Users can update their own profile (name only)
    // Admins can update any user
    const isOwnProfile = context.user.id.toString() === args.id;
    const isAdmin = context.user.systemRole === 'SYSTEM_ADMIN';

    if (!isOwnProfile && !isAdmin) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Non-admins can only update their name
    if (!isAdmin && (args.input.systemRole !== undefined || args.input.isActive !== undefined)) {
      throw new GraphQLError('Cannot update role or status', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const result = await updateUser(args.id, args.input);
    if (!result.success) {
      logger.error('Failed to update user', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to update user', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return result.data;
  },

  /**
   * Deactivate user
   */
  deactivateUser: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ) => {
    logger.debug('Deactivating user', { 
      userId: args.id,
      requestId: context.requestId 
    });

    // Check permissions - only admins can deactivate users
    if (!context.user || (context.user.systemRole !== 'SYSTEM_ADMIN')) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Prevent self-deactivation
    if (context.user.id.toString() === args.id) {
      throw new GraphQLError('Cannot deactivate yourself', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    const result = await updateUser(args.id, { isActive: false });
    if (!result.success) {
      logger.error('Failed to deactivate user', { 
        error: result.error,
        requestId: context.requestId 
      });
      return false;
    }

    return true;
  },
};