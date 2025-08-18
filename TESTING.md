# Testing Guide for Shaman

This document provides comprehensive guidance for testing the Shaman AI agent management system.

## Overview

Shaman uses integration tests to ensure the system works correctly end-to-end. The test infrastructure is already set up in `/node/packages/shaman-integration-tests/` but tests are currently disabled until the implementation is ready.

## Test Infrastructure

### Technology Stack

- **Test Runner**: Mocha
- **Assertion Library**: Chai
- **GraphQL Client**: Apollo Client
- **Database**: PostgreSQL (separate test database)
- **Language**: TypeScript

### Key Components

1. **Test Database Management** (`test-db.ts`)
   - Creates isolated `shaman_test` database
   - Runs migrations automatically
   - Truncates tables between tests
   - Cleans up after test suite completes

2. **Test Server** (`server.ts`)
   - Starts Shaman server on port 5002
   - Uses test database configuration
   - Manages server lifecycle

3. **GraphQL Client** (`graphql-client.ts`)
   - Preconfigured Apollo Client
   - Error handling and logging
   - Type-safe operations

## Before Writing Tests

### Required Implementations

Before enabling tests, ensure these components exist:

1. **GraphQL Schema** (`shaman-server/src/schema.graphql`)

   ```graphql
   type AgentRepository {
     id: ID!
     name: String!
     gitUrl: String!
     branch: String!
     isRoot: Boolean!
     lastSyncCommitHash: String
     lastSyncAt: DateTime
     lastSyncStatus: SyncStatus!
     agents: [GitAgent!]!
   }

   type Run {
     id: ID!
     status: RunStatus!
     initialInput: String!
     totalCost: Float!
     startTime: DateTime!
     endTime: DateTime
     duration: Int
     createdBy: String!
     steps: [Step!]!
   }

   # ... more types
   ```

2. **Resolvers** (`shaman-server/src/resolvers/`)
   - Query resolvers for fetching data
   - Mutation resolvers for operations
   - Proper error handling

3. **Server Binary** (`shaman-server/src/bin/shaman-server.ts`)
   - Apollo Server setup
   - Express middleware
   - Health check endpoint

## Writing Tests

### Test File Structure

```typescript
import { expect } from "chai";
import { gql } from "@apollo/client/core/index.js";
import { testDb, client } from "../index.js";

describe("Feature Name", () => {
  // Clean database before each test
  beforeEach(async () => {
    await testDb.truncateAllTables();
  });

  describe("specific operation", () => {
    it("should perform expected behavior", async () => {
      // Test implementation
    });
  });
});
```

### Common Test Patterns

#### 1. Testing Mutations

```typescript
it("should create an entity", async () => {
  const mutation = gql`
    mutation CreateEntity($input: CreateEntityInput!) {
      createEntity(input: $input) {
        id
        name
        createdAt
      }
    }
  `;

  const result = await client.mutate(mutation, {
    input: {
      name: "Test Entity",
    },
  });

  expect(result.data?.createEntity.name).to.equal("Test Entity");
  expect(result.data?.createEntity.id).to.exist;
});
```

#### 2. Testing Queries

```typescript
it("should fetch entities", async () => {
  // First create some test data
  await createTestEntities();

  const query = gql`
    query ListEntities($filter: EntityFilter) {
      entities(filter: $filter) {
        id
        name
        status
      }
    }
  `;

  const result = await client.query(query, {
    filter: { status: "ACTIVE" },
  });

  expect(result.data?.entities).to.have.lengthOf(2);
});
```

#### 3. Testing Error Handling

```typescript
it("should handle validation errors", async () => {
  const mutation = gql`
    mutation CreateEntity($input: CreateEntityInput!) {
      createEntity(input: $input) {
        id
      }
    }
  `;

  try {
    await client.mutate(mutation, {
      input: {
        name: "", // Invalid empty name
      },
    });
    expect.fail("Should have thrown validation error");
  } catch (error: any) {
    expect(error.graphQLErrors[0].message).to.include("Name is required");
  }
});
```

#### 4. Testing Complex Workflows

```typescript
it("should execute agent and track steps", async () => {
  // Create a run
  const run = await createTestRun();

  // Execute an agent
  const executeResult = await executeAgent({
    runId: run.id,
    agentName: "test-agent",
    input: "test input",
  });

  // Verify steps were created
  const steps = await getRunSteps(run.id);
  expect(steps).to.have.length.greaterThan(0);
  expect(steps[0].type).to.equal("agent_execution");
  expect(steps[0].agentName).to.equal("test-agent");
});
```

### Test Data Helpers

Create reusable helper functions for common test data:

```typescript
// test-helpers.ts
export async function createTestRepository(
  name = "test-repo",
  gitUrl = "https://github.com/example/test.git",
) {
  const mutation = gql`...`;
  const result = await client.mutate(mutation, {
    input: { name, gitUrl, branch: "main" },
  });
  return result.data.createAgentRepository;
}

export async function createTestRun(
  initialInput = "Test input",
  createdBy = "test-user",
) {
  // Implementation
}
```

## Test Organization

### By Feature

```
tests/
├── agent-management/
│   ├── repositories.test.ts
│   ├── git-sync.test.ts
│   └── agent-discovery.test.ts
├── workflow-execution/
│   ├── runs.test.ts
│   ├── steps.test.ts
│   └── data-storage.test.ts
└── integration/
    ├── end-to-end.test.ts
    └── performance.test.ts
```

### By Operation Type

```
tests/
├── queries/
│   ├── list-agents.test.ts
│   └── get-run-details.test.ts
├── mutations/
│   ├── create-repository.test.ts
│   └── execute-agent.test.ts
└── subscriptions/
    └── run-updates.test.ts
```

## Running Tests

### Commands

```bash
# From shaman-integration-tests package
npm test                    # Run all tests
npm run test:watch         # Run in watch mode

# From project root
npm run test:integration:shaman       # Run integration tests
npm run test:integration:shaman:watch # Watch mode
npm run test:integration:all          # Run all integration test suites
```

### Environment Setup

1. Ensure PostgreSQL is running
2. Set environment variables (or use defaults)
3. Build the project: `./build.sh`
4. Run tests: `npm test`

### Debugging

1. **Enable verbose logging**:

   ```typescript
   before(() => {
     process.env.LOG_LEVEL = "debug";
   });
   ```

2. **Inspect GraphQL errors**:

   ```typescript
   catch (error) {
     console.log('GraphQL Errors:', error.graphQLErrors);
     console.log('Network Error:', error.networkError);
   }
   ```

3. **Check database state**:
   ```typescript
   // In test
   const tables = await testDb.getTables();
   console.log("Tables:", tables);
   ```

## Best Practices

### DO's

- ✅ Clean database state between tests
- ✅ Use descriptive test names
- ✅ Test both success and error cases
- ✅ Create helper functions for common operations
- ✅ Use proper TypeScript types
- ✅ Test edge cases and boundaries

### DON'Ts

- ❌ Share state between tests
- ❌ Hardcode IDs or timestamps
- ❌ Make tests dependent on execution order
- ❌ Skip error handling tests
- ❌ Use production database for tests

## Performance Testing

For performance-critical operations:

```typescript
it("should handle large datasets efficiently", async () => {
  // Create many entities
  const promises = Array.from({ length: 1000 }, (_, i) =>
    createTestEntity(`entity-${i}`),
  );
  await Promise.all(promises);

  // Measure query time
  const start = Date.now();
  const result = await client.query(listEntitiesQuery, {
    limit: 100,
    offset: 0,
  });
  const duration = Date.now() - start;

  expect(duration).to.be.lessThan(1000); // Less than 1 second
  expect(result.data?.entities).to.have.lengthOf(100);
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: ./build.sh --install

      - name: Build project
        run: ./build.sh

      - name: Run integration tests
        run: npm run test:integration:all
        env:
          SHAMAN_DB_HOST: localhost
          SHAMAN_DB_PORT: 5432
          SHAMAN_DB_USER: postgres
          SHAMAN_DB_PASSWORD: postgres
```

## Extending Tests

### Adding New Test Categories

1. Create new test file in appropriate directory
2. Import in `src/index.ts`
3. Follow existing patterns
4. Document any special setup required

### Custom Assertions

```typescript
// custom-assertions.ts
export function expectValidUUID(value: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(value).to.match(uuidRegex);
}

export function expectRecentTimestamp(timestamp: string, maxAgeMs = 5000) {
  const time = new Date(timestamp).getTime();
  const now = Date.now();
  expect(now - time).to.be.lessThan(maxAgeMs);
}
```

## Troubleshooting

### Common Issues

1. **"Cannot connect to database"**
   - Check PostgreSQL is running
   - Verify environment variables
   - Ensure test database can be created

2. **"Server failed to start"**
   - Check if port 5002 is available
   - Verify server binary exists and is built
   - Check server logs for startup errors

3. **"Test timeout"**
   - Increase timeout in .mocharc.json
   - Check for unhandled promises
   - Verify server startup completes

4. **"Foreign key constraint violation"**
   - Check test data creation order
   - Ensure proper cleanup between tests
   - Use CASCADE in truncate operations
