/**
 * Mutation resolver aggregation
 */

import { userMutations } from './user.js';
import { repositoryMutations } from './repository.js';
import { executionMutations } from './execution.js';

export const mutationResolvers = {
  ...userMutations,
  ...repositoryMutations,
  ...executionMutations,
};