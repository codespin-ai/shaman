/**
 * Server configuration and types
 */

// Organization type definition
export type Organization = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly settings: {
    defaultModel?: string;
    defaultProviders?: string[];
    maxConcurrentRuns?: number;
    maxRunDuration?: number;
    allowExternalAgents?: boolean;
    requireApprovalForNewAgents?: boolean;
    allowedExternalDomains?: string[];
    features?: string[];
  };
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

// User type definition
export type User = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly systemRole: 'USER' | 'SYSTEM_ADMIN';
  readonly isActive: boolean;
  readonly currentOrgId?: string;
  readonly createdAt: Date;
  readonly lastLoginAt?: Date;
};
import type { Request } from 'express';
import type { ShamanConfig } from '@codespin/shaman-config';

/**
 * Server configuration
 */
export type ServerConfig = {
  readonly port: number;
  readonly host: string;
  readonly cors: {
    readonly enabled: boolean;
    readonly origin?: string | string[];
    readonly credentials?: boolean;
  };
  readonly graphql: {
    readonly path: string;
    readonly playground: boolean;
    readonly introspection: boolean;
    readonly subscriptions: {
      readonly enabled: boolean;
      readonly path: string;
    };
  };
  readonly security: {
    readonly helmet: boolean;
    readonly rateLimit?: {
      readonly windowMs: number;
      readonly max: number;
    };
  };
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly format: 'json' | 'pretty';
  };
};

/**
 * GraphQL context type (duplicated in graphql-context.ts - use that one)
 * @deprecated Use GraphQLContext from './graphql-context.js' instead
 */
export type GraphQLContext = {
  readonly user?: User;
  readonly organization?: Organization;
  readonly orgId?: string;
  readonly config: ShamanConfig;
  readonly requestId: string;
  readonly dataSources: Record<string, unknown>;
};

/**
 * Authenticated request with user
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
  requestId?: string;
}

/**
 * WebSocket connection context
 */
export type WebSocketContext = {
  readonly user?: User;
  readonly connectionParams?: Record<string, unknown>;
  readonly requestId: string;
};

/**
 * Subscription event types
 */
export type SubscriptionEvent =
  | { type: 'RUN_UPDATED'; runId: string; run: unknown }
  | { type: 'STEP_STREAM'; stepId: string; chunk: unknown }
  | { type: 'INPUT_REQUESTED'; request: unknown }
  | { type: 'AGENT_CALL_STARTED'; runId?: string; chunk: unknown }
  | { type: 'REPOSITORY_SYNCED'; repository: unknown }
  | { type: 'SYSTEM_ALERT'; alert: unknown };