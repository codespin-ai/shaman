/**
 * Query resolver aggregation
 */

import { userQueries } from './user.js';
import { agentQueries } from './agent.js';
import { repositoryQueries } from './repository.js';
import { runQueries } from './run.js';
import { analyticsQueries } from './analytics.js';

export const queryResolvers = {
  ...userQueries,
  ...agentQueries,
  ...repositoryQueries,
  ...runQueries,
  ...analyticsQueries,
};