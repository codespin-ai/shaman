/**
 * Types for GraphQL server
 */

export type GraphQLServerConfig = {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origin?: string | string[];
    credentials: boolean;
  };
  graphql: {
    path: string;
    playground: boolean;
    introspection: boolean;
  };
  security: {
    helmet: boolean;
    rateLimit?: {
      windowMs: number;
      max: number;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'pretty';
  };
};