/**
 * Subscription resolver aggregation
 */

import { createLogger } from '@codespin/shaman-logger';
import type { GraphQLContext as _GraphQLContext } from '../../../../types.js';

const logger = createLogger('Subscriptions');

export const subscriptionResolvers = {
  // Placeholder subscriptions - to be implemented with WebSocket support
  runUpdated: {
    subscribe: () => {
      logger.warn('Subscription not implemented: runUpdated');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  stepStream: {
    subscribe: () => {
      logger.warn('Subscription not implemented: stepStream');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  inputRequested: {
    subscribe: () => {
      logger.warn('Subscription not implemented: inputRequested');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  inputRequestResolved: {
    subscribe: () => {
      logger.warn('Subscription not implemented: inputRequestResolved');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  agentCallStarted: {
    subscribe: () => {
      logger.warn('Subscription not implemented: agentCallStarted');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  agentCallCompleted: {
    subscribe: () => {
      logger.warn('Subscription not implemented: agentCallCompleted');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  repositorySynced: {
    subscribe: () => {
      logger.warn('Subscription not implemented: repositorySynced');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  agentDiscovered: {
    subscribe: () => {
      logger.warn('Subscription not implemented: agentDiscovered');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  agentUpdated: {
    subscribe: () => {
      logger.warn('Subscription not implemented: agentUpdated');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  externalAgentHealthChanged: {
    subscribe: () => {
      logger.warn('Subscription not implemented: externalAgentHealthChanged');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  systemAlert: {
    subscribe: () => {
      logger.warn('Subscription not implemented: systemAlert');
      throw new Error('Subscriptions not yet implemented');
    },
  },

  agentCompleted: {
    subscribe: () => {
      logger.warn('Subscription not implemented: agentCompleted');
      throw new Error('Subscriptions not yet implemented');
    },
  },
};