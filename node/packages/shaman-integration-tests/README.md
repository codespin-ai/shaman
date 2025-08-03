# Shaman Integration Tests

This package contains integration tests for the Shaman AI agent management system. The tests are currently scaffolded but disabled until the main Shaman implementation is ready for testing.

## Structure

```
shaman-integration-tests/
├── src/
│   ├── index.ts          # Test setup and teardown
│   ├── tests/            # Test files (currently commented out)
│   │   ├── agent-repositories.test.ts
│   │   └── workflow-runs.test.ts
│   └── utils/            # Test utilities
│       ├── test-db.ts    # Test database management
│       ├── server.ts     # Test server management
│       └── graphql-client.ts # GraphQL client for tests
├── .mocharc.json         # Mocha configuration
├── package.json
└── tsconfig.json
```

## Prerequisites for Running Tests

Before tests can be enabled and run, the following components must be implemented in Shaman:

### 1. GraphQL Schema (`shaman-gql-server/src/schema.graphql`)
- Define types for AgentRepository, GitAgent, Run, Step, RunData
- Define queries for listing and fetching entities
- Define mutations for management operations (NO execution)

### 2. GraphQL Resolvers (`shaman-gql-server/src/resolvers/`)
- Implement resolvers for all queries and mutations
- Connect resolvers to persistence layer

### 3. Server Binaries
- **GraphQL Server** (`shaman-gql-server/src/start.ts`): Management API
- **A2A Server** (`shaman-a2a-server/src/start.ts`): Agent execution with --role flag
- Both servers must be running for full functionality

### 4. Database Migrations
- Ensure all tables are created with proper indexes
- Foreign key constraints must be properly set up

## Test Patterns

### Basic Test Structure

```typescript
import { expect } from 'chai';
import { gql } from '@apollo/client/core/index.js';
import { testDb, client } from '../index.js';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Clean database before each test
    await testDb.truncateAllTables();
  });

  describe('operation name', () => {
    it('should do something', async () => {
      // Define GraphQL query/mutation
      const mutation = gql`
        mutation CreateSomething($input: CreateSomethingInput!) {
          createSomething(input: $input) {
            id
            field1
            field2
          }
        }
      `;

      // Execute operation
      const result = await client.mutate(mutation, {
        input: {
          field1: 'value1',
          field2: 'value2'
        }
      });

      // Assert results
      const data = result.data?.createSomething;
      expect(data?.field1).to.equal('value1');
      expect(data?.field2).to.equal('value2');
    });
  });
});
```

### Testing Error Cases

```typescript
it('should handle errors correctly', async () => {
  try {
    await client.mutate(mutation, {
      input: { /* invalid input */ }
    });
    expect.fail('Should have thrown an error');
  } catch (error: any) {
    expect(error.message).to.include('expected error message');
  }
});
```

### Testing Complex Workflows

```typescript
it('should handle multi-step workflows', async () => {
  // Step 1: Create initial entity
  const entity1 = await createEntity1();
  
  // Step 2: Create related entity
  const entity2 = await createEntity2(entity1.id);
  
  // Step 3: Verify relationship
  const query = gql`
    query GetEntity1WithRelations($id: ID!) {
      entity1(id: $id) {
        id
        relatedEntities {
          id
        }
      }
    }
  `;
  
  const result = await client.query(query, { id: entity1.id });
  expect(result.data?.entity1.relatedEntities).to.have.lengthOf(1);
});
```

## Running Tests

Currently, all tests are marked with `describe.skip()` to disable them. When Shaman is ready for testing:

1. Remove `.skip` from test descriptions
2. Ensure the database is running
3. Run the tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/tests/agent-repositories.test.ts
```

## Test Database

The test suite automatically:
- Creates a separate `shaman_test` database
- Runs all migrations before tests
- Truncates all tables between tests
- Drops the test database after all tests complete

## Environment Variables

The test suite uses the same environment variables as the main application, but overrides the database name:

```bash
SHAMAN_DB_HOST=localhost      # Default: localhost
SHAMAN_DB_PORT=5432           # Default: 5432
SHAMAN_DB_USER=postgres       # Default: postgres
SHAMAN_DB_PASSWORD=postgres   # Default: postgres
# SHAMAN_DB_NAME is automatically set to 'shaman_test'
```

## Adding New Tests

1. Create a new test file in `src/tests/`
2. Import it in `src/index.ts`
3. Follow the established patterns
4. Use `describe.skip()` until the feature is implemented

## Test Categories to Implement

### Agent Management
- [ ] Agent repository CRUD operations
- [ ] Git synchronization
- [ ] Agent discovery and parsing
- [ ] Agent version tracking

### Workflow Execution
- [ ] Run lifecycle (create, execute, complete)
- [ ] Step tracking and telemetry
- [ ] Agent-to-agent communication
- [ ] Tool execution
- [ ] Error handling and recovery

### Data Management
- [ ] Run data storage and retrieval
- [ ] Data immutability
- [ ] Query patterns (by key, agent, time range)

### Authentication & Authorization
- [ ] API key authentication
- [ ] User context propagation
- [ ] Rate limiting

### Performance & Scalability
- [ ] Concurrent run execution
- [ ] Large dataset handling
- [ ] Database query optimization

## Debugging Tests

To debug failing tests:

1. Check server logs in the console output
2. Enable GraphQL error details in the client
3. Use `console.log` in test code
4. Run single tests with `.only()`
5. Check the test database state during test execution

## CI/CD Integration

Once tests are enabled, add to CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: |
    npm run test:integration:all
  env:
    SHAMAN_DB_HOST: localhost
    SHAMAN_DB_PORT: 5432
    SHAMAN_DB_USER: postgres
    SHAMAN_DB_PASSWORD: postgres
```