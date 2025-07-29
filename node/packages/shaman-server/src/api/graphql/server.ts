/**
 * Apollo Server setup
 */

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer as _ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '@codespin/shaman-logger';
import { loadConfig } from '@codespin/shaman-config';
import type { ServerConfig, GraphQLContext } from '../../types.js';
import { resolvers } from './resolvers/index.js';
import { 
  DateTimeScalar, 
  ToolCallIDScalar, 
  JSONScalar, 
  EmailAddressScalar,
  UploadScalar 
} from './scalars.js';
import { createContext } from './context.js';
import type { Request } from 'express';

const logger = createLogger('GraphQLServer');

// Load GraphQL schema
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = join(__dirname, '../../schema.graphql');
const typeDefs = readFileSync(schemaPath, 'utf-8');

/**
 * Create Apollo Server instance
 */
export async function createApolloServer(serverConfig: ServerConfig): Promise<ApolloServer<GraphQLContext>> {
  try {
    // Load Shaman configuration
    const configResult = loadConfig();
    if (!configResult.success) {
      throw configResult.error;
    }
    const shamanConfig = configResult.data;

    // Create executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        // Custom scalars
        DateTime: DateTimeScalar,
        ToolCallID: ToolCallIDScalar,
        JSON: JSONScalar,
        EmailAddress: EmailAddressScalar,
        Upload: UploadScalar,
        
        // Resolvers
        ...resolvers,
      },
    });

    // Create Apollo Server
    const apolloServer = new ApolloServer<GraphQLContext>({
      schema,
      introspection: serverConfig.graphql.introspection,
      csrfPrevention: true,
      cache: 'bounded',
      formatError: (formattedError, error) => {
        logger.error('GraphQL error', {
          message: formattedError.message,
          locations: formattedError.locations,
          path: formattedError.path,
          extensions: formattedError.extensions,
          originalError: error,
        });

        // In production, sanitize error messages
        if (process.env.NODE_ENV === 'production') {
          // Only expose user-friendly errors
          if (formattedError.extensions?.code === 'BAD_USER_INPUT' ||
              formattedError.extensions?.code === 'UNAUTHENTICATED' ||
              formattedError.extensions?.code === 'FORBIDDEN') {
            return formattedError;
          }

          // Hide internal errors
          return {
            message: 'Internal server error',
            extensions: {
              code: 'INTERNAL_SERVER_ERROR',
              requestId: formattedError.extensions?.requestId,
            },
          };
        }

        return formattedError;
      },
    });

    // Add context function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (apolloServer as any).createContext = async ({ req }: { req: unknown }) => {
      return await createContext(req as Request, shamanConfig);
    };

    logger.info('Apollo Server created successfully');
    return apolloServer;

  } catch (error) {
    logger.error('Failed to create Apollo Server', { error });
    throw error;
  }
}