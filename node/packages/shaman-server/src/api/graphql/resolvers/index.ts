/**
 * GraphQL resolver aggregation
 */

import { queryResolvers } from './queries/index.js';
import { mutationResolvers } from './mutations/index.js';
import { subscriptionResolvers } from './subscriptions/index.js';
import { typeResolvers } from './types/index.js';

export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  Subscription: subscriptionResolvers,
  ...typeResolvers,
};