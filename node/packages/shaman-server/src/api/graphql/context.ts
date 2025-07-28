/**
 * GraphQL context creation
 */

import { createLogger } from '@codespin/shaman-logger';
import type { Request } from 'express';
import type { ShamanConfig } from '@codespin/shaman-config';
import type { GraphQLContext, AuthenticatedRequest } from '../../types.js';

const logger = createLogger('GraphQLContext');

/**
 * Create GraphQL context from request
 */
export async function createContext(
  req: Request,
  config: ShamanConfig
): Promise<GraphQLContext> {
  const authenticatedReq = req as AuthenticatedRequest;
  
  const context: GraphQLContext = {
    user: authenticatedReq.user,
    config,
    requestId: authenticatedReq.requestId || 'unknown',
    dataSources: {
      // Data sources will be added as needed
    },
  };

  logger.debug('GraphQL context created', {
    requestId: context.requestId,
    hasUser: !!context.user,
    userId: context.user?.id,
  });

  return context;
}