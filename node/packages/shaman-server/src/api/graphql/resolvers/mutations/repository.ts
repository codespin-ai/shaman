/**
 * Repository-related mutation resolvers
 */

import { GraphQLError } from 'graphql';
import { createLogger } from '@codespin/shaman-logger';
import { 
  createAgentRepository,
  updateAgentRepository,
  deleteAgentRepository 
} from '../../../../persistence-adapter.js';
import { syncRepository } from '../../../../persistence-adapter.js';
import type { GraphQLContext } from '../../../../types.js';
import type { AgentRepository } from '@codespin/shaman-types';

const logger = createLogger('RepositoryMutations');

export const repositoryMutations = {
  /**
   * Add a new agent repository
   */
  addAgentRepository: async (
    _parent: unknown,
    args: {
      input: {
        name: string;
        gitUrl: string;
        branch?: string;
        isRoot?: boolean;
        syncInterval?: string;
        authType: string;
        sshKeyPath?: string;
        authToken?: string;
        webhookSecret?: string;
        readOnly?: boolean;
      };
    },
    context: GraphQLContext
  ) => {
    logger.debug('Adding agent repository', { 
      name: args.input.name,
      gitUrl: args.input.gitUrl,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Only admins can add repositories
    if (context.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (!context.user.currentOrgId) {
      throw new GraphQLError('No organization selected', {
        extensions: { code: 'NO_ORGANIZATION' },
      });
    }
    const orgId = context.user.currentOrgId;
    const result = await createAgentRepository({
      orgId,
      name: args.input.name,
      gitUrl: args.input.gitUrl,
      branch: args.input.branch || 'main',
      isRoot: args.input.isRoot || false,
      createdBy: context.user.id.toString(),
    });

    if (!result.success) {
      logger.error('Failed to create repository', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to create repository', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    // Trigger initial sync
    const syncResult = await syncRepository(args.input.gitUrl, args.input.branch || 'main');
    if (!syncResult.success) {
      logger.warn('Initial sync failed', { 
        error: syncResult.error,
        requestId: context.requestId 
      });
    }

    return {
      ...result.data,
      lastSyncStatus: syncResult.success ? 'SUCCESS' : 'FAILED',
      syncErrors: [],
      authType: args.input.authType,
      agentCount: 0,
      discoveredAgents: [],
    } as AgentRepository & { syncErrors: unknown[]; authType: string; agentCount: number; discoveredAgents: unknown[] };
  },

  /**
   * Update agent repository
   */
  updateAgentRepository: async (
    _parent: unknown,
    args: {
      name: string;
      input: {
        gitUrl?: string;
        branch?: string;
        isRoot?: boolean;
        syncInterval?: string;
        authType?: string;
        sshKeyPath?: string;
        authToken?: string;
        webhookSecret?: string;
        readOnly?: boolean;
        isActive?: boolean;
      };
    },
    context: GraphQLContext
  ) => {
    logger.debug('Updating agent repository', { 
      name: args.name,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Only admins can update repositories
    if (context.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (!context.user.currentOrgId) {
      throw new GraphQLError('No organization selected', {
        extensions: { code: 'NO_ORGANIZATION' },
      });
    }
    const orgId = context.user.currentOrgId;
    const result = await updateAgentRepository(args.name, orgId, args.input);
    if (!result.success) {
      logger.error('Failed to update repository', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to update repository', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    return {
      ...result.data,
      lastSyncStatus: result.data.lastSyncStatus || 'NEVER_SYNCED',
      syncErrors: [],
      authType: args.input.authType || 'none',
      agentCount: 0,
      discoveredAgents: [],
    } as AgentRepository & { syncErrors: unknown[]; authType: string; agentCount: number; discoveredAgents: unknown[] };
  },

  /**
   * Remove agent repository
   */
  removeAgentRepository: async (
    _parent: unknown,
    args: { name: string },
    context: GraphQLContext
  ) => {
    logger.debug('Removing agent repository', { 
      name: args.name,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Only admins can remove repositories
    if (context.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (!context.user.currentOrgId) {
      throw new GraphQLError('No organization selected', {
        extensions: { code: 'NO_ORGANIZATION' },
      });
    }
    const orgId = context.user.currentOrgId;
    const result = await deleteAgentRepository(args.name, orgId);
    if (!result.success) {
      logger.error('Failed to remove repository', { 
        error: result.error,
        requestId: context.requestId 
      });
      return false;
    }

    return true;
  },

  /**
   * Sync agent repository
   */
  syncAgentRepository: async (
    _parent: unknown,
    args: { name: string },
    context: GraphQLContext
  ) => {
    logger.debug('Syncing agent repository', { 
      name: args.name,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // TODO: Get repository details and trigger sync
    throw new GraphQLError('Not implemented', {
      extensions: { code: 'NOT_IMPLEMENTED' },
    });
  },

  /**
   * Sync all repositories
   */
  syncAllAgentRepositories: async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext
  ) => {
    logger.debug('Syncing all agent repositories', { 
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Only admins can sync all repositories
    if (context.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // TODO: Implement bulk sync
    return [];
  },

  /**
   * Switch repository branch
   */
  switchRepositoryBranch: async (
    _parent: unknown,
    args: { name: string; branch: string },
    context: GraphQLContext
  ) => {
    logger.debug('Switching repository branch', { 
      name: args.name,
      branch: args.branch,
      requestId: context.requestId 
    });

    if (!context.user) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Only admins can switch branches
    if (context.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (!context.user.currentOrgId) {
      throw new GraphQLError('No organization selected', {
        extensions: { code: 'NO_ORGANIZATION' },
      });
    }
    const orgId = context.user.currentOrgId;
    const result = await updateAgentRepository(args.name, orgId, { branch: args.branch });
    if (!result.success) {
      logger.error('Failed to switch branch', { 
        error: result.error,
        requestId: context.requestId 
      });
      throw new GraphQLError('Failed to switch branch', {
        extensions: { 
          code: 'INTERNAL_SERVER_ERROR',
          requestId: context.requestId,
        },
      });
    }

    // Trigger sync on new branch
    const syncResult = await syncRepository(result.data.gitUrl, args.branch);
    if (!syncResult.success) {
      logger.warn('Sync after branch switch failed', { 
        error: syncResult.error,
        requestId: context.requestId 
      });
    }

    return {
      ...result.data,
      lastSyncStatus: syncResult.success ? 'SUCCESS' : 'FAILED',
      syncErrors: [],
      authType: 'none',
      agentCount: 0,
      discoveredAgents: [],
    } as AgentRepository & { syncErrors: unknown[]; authType: string; agentCount: number; discoveredAgents: unknown[] };
  },
};