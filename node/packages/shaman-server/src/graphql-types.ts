/**
 * Re-export all GraphQL generated types
 * 
 * This file serves as the main entry point for GraphQL types in the server package.
 * It re-exports the generated types and can include any additional type extensions.
 */

// Re-export all generated GraphQL types
export * from './generated/graphql.js';

// Additional server-specific GraphQL type extensions can be added here