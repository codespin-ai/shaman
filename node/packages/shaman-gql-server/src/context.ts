import type { Database } from '@codespin/shaman-db';

export type GraphQLContext = {
  db: Database;
  currentUser?: {
    id: string;
    email: string;
    organizationId: string;
    roles: string[];
  };
};