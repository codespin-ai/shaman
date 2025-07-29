# GraphQL Code Generation

This document explains the GraphQL code generation setup in the shaman-server package.

## Overview

We use GraphQL Code Generator to automatically generate TypeScript types from our GraphQL schema. This ensures type safety between the GraphQL API and our TypeScript code.

## Architecture

```
Database Layer (DbRow types in persistence)
    ↓ existing mappers
Domain Layer (types in shaman-types)
    ↓ graphql-mappers.ts
GraphQL Layer (generated types)
    ↓
GraphQL Resolvers
```

## Key Files

- `schema.graphql` - The GraphQL schema definition
- `codegen.yml` - Code generator configuration
- `src/generated/graphql.ts` - Generated types (gitignored)
- `src/graphql-types.ts` - Re-exports generated types
- `src/mappers/graphql-mappers.ts` - Maps domain types to GraphQL types
- `src/graphql-context.ts` - GraphQL context type definition

## Code Generation Process

1. **During Build**: The `npm run build` command runs code generation automatically
2. **Manual Generation**: Run `npm run codegen` to generate types without building

## Type Mapping Strategy

### Domain to GraphQL

The mappers in `graphql-mappers.ts` convert from domain types to GraphQL types:

```typescript
// Domain type (from @codespin/shaman-types)
interface AgentRepository {
  id: number;
  name: string;
  gitUrl: string;
  // ...
}

// GraphQL type (generated)
type AgentRepository {
  id: ID!
  name: String!
  gitUrl: String!
  // ...
}

// Mapper function
export function mapAgentRepositoryToGraphQL(
  repo: Domain.AgentRepository
): GQL.AgentRepository {
  return {
    id: repo.id.toString(),
    name: repo.name,
    gitUrl: repo.gitUrl,
    // ...
  };
}
```

### Key Differences

1. **IDs**: Domain uses `number`, GraphQL uses `ID` (string)
2. **Enums**: Domain uses string literals, GraphQL uses proper enums
3. **Optional Fields**: Domain uses `null`, GraphQL uses nullable types
4. **Complex Types**: Some domain types are flattened or restructured for the API

## Adding New Types

1. Add the type to `schema.graphql`
2. Run `npm run codegen`
3. Create mapper functions in `graphql-mappers.ts` if needed
4. Use the generated types in resolvers

## Benefits

1. **Type Safety**: All GraphQL operations are fully typed
2. **No Manual Sync**: Schema changes automatically update TypeScript types
3. **Better DX**: IDE autocomplete and type checking
4. **Clear Boundaries**: API layer is separate from domain layer