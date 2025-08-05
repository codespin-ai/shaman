# Foreman

A workflow orchestration engine with REST API, built with TypeScript. Foreman provides queue-agnostic task orchestration with PostgreSQL as the source of truth.

**Architecture**: ID-only queue pattern - queues store only task IDs, all data remains in PostgreSQL.

**Security Model**: Foreman is designed to run in a fully trusted environment behind a firewall. All authenticated callers have full access to all operations.

## Features

- 🏢 **Multi-tenant Runs** - Isolated execution contexts per organization
- 📋 **Task Management** - Queue-agnostic task orchestration
- 💾 **PostgreSQL Storage** - All data stored in PostgreSQL, queues only contain IDs
- 🔄 **Run Data Storage** - Key-value storage with tags and multi-value support for inter-task communication
- 🚀 **REST API** - Simple HTTP API for all operations
- 📊 **Status Tracking** - Complete execution history and status tracking
- 🐳 **Docker Support** - Official Docker images available
- 📦 **TypeScript Client** - Published npm package for easy integration

## Architecture

Foreman follows a clean architecture where:
- **Queue systems** (BullMQ, SQS, etc.) only store task IDs
- **PostgreSQL** stores all task data, run state, and execution history
- **foreman-client** handles queue operations in your application
- **foreman-server** provides REST API for state management

## Quick Start

### Option 1: Docker (Recommended)

The fastest way to get started with Foreman:

```bash
# Using Docker Compose (includes PostgreSQL)
git clone https://github.com/codespin-ai/foreman.git
cd foreman
docker-compose up

# The API will be available at http://localhost:5002
# Note: Add Redis service to docker-compose.yml if using BullMQ
```

Or use the official Docker image:

```bash
docker run -p 5002:5002 \
  -e FOREMAN_DB_HOST=your-db-host \
  -e FOREMAN_DB_NAME=foreman \
  -e FOREMAN_DB_USER=postgres \
  -e FOREMAN_DB_PASSWORD=your-password \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e FOREMAN_AUTO_MIGRATE=true \
  ghcr.io/codespin-ai/foreman:latest
```

### Option 2: TypeScript Client SDK

For existing applications, install the TypeScript client:

```bash
npm install @codespin/foreman-client
```

```typescript
import { initializeForemanClient } from '@codespin/foreman-client';

const client = await initializeForemanClient({
  endpoint: 'https://your-foreman-server.com',
  apiKey: 'fmn_prod_myorg_abc123'
});
```

### Option 3: Local Development

#### Prerequisites

- Node.js 22+
- PostgreSQL 12+
- Redis (if using BullMQ)
- npm or yarn

#### Installation

```bash
# Clone the repository
git clone https://github.com/codespin-ai/foreman.git
cd foreman

# Install dependencies
npm install

# Build all packages
./build.sh
```

#### Database Setup

```bash
# Set environment variables

# Database configuration
export FOREMAN_DB_HOST=localhost
export FOREMAN_DB_PORT=5432
export FOREMAN_DB_NAME=foreman
export FOREMAN_DB_USER=foreman
export FOREMAN_DB_PASSWORD=your_password

# Redis configuration (for BullMQ)
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=your_redis_password  # Optional
export REDIS_DB=0                          # Optional

# Queue configuration
export TASK_QUEUE_NAME=foreman:tasks       # Default: foreman:tasks
export RESULT_QUEUE_NAME=foreman:results   # Default: foreman:results

# API configuration
export FOREMAN_API_KEY=fmn_dev_testorg_123 # Optional: Default API key

# Run migrations
npm run migrate:foreman:latest
```

### Starting the Server

```bash
./start.sh
```

The REST API will be available at `http://localhost:3000`.

## API Overview

### Authentication

All API endpoints (except health check) require authentication. You can use either:

1. **Bearer token** in Authorization header:
   ```
   Authorization: Bearer fmn_prod_org123_randomstring
   ```

2. **API key** in x-api-key header:
   ```
   x-api-key: fmn_prod_org123_randomstring
   ```

The API key format is: `fmn_[environment]_[organizationId]_[random]`

Since Foreman runs in a fully trusted environment, the authentication is simplified:
- No permission checks - all authenticated users have full access
- No database validation - API key format is validated only
- Organization ID is extracted from the API key

For testing:
- Set `FOREMAN_API_KEY` environment variable to use a specific test key
- Authentication can be disabled by not setting `FOREMAN_API_KEY_ENABLED` or `FOREMAN_API_KEY`

### Health Check

- `GET /health` - Health check endpoint (no authentication required)

### Runs

- `POST /api/v1/runs` - Create a new run
- `GET /api/v1/runs/:id` - Get run details
- `PATCH /api/v1/runs/:id` - Update run status
- `GET /api/v1/runs` - List runs with filtering

### Tasks

- `POST /api/v1/tasks` - Create a new task
- `GET /api/v1/tasks/:id` - Get task details
- `PATCH /api/v1/tasks/:id` - Update task status
- `GET /api/v1/tasks` - List tasks with filtering

### Run Data

- `POST /api/v1/runs/:runId/data` - Store data with optional tags
- `GET /api/v1/runs/:runId/data` - Query data with flexible filtering (by key, tags, prefix)
- `PATCH /api/v1/runs/:runId/data/:dataId/tags` - Update tags on existing data
- `DELETE /api/v1/runs/:runId/data` - Delete data by key or ID

### Configuration

- `GET /api/v1/config` - Get client configuration (Redis, queues, version)
- `GET /api/v1/config/redis` - Get Redis configuration only
- `GET /api/v1/config/queues` - Get queue names configuration only

## TypeScript Client SDK

The `@codespin/foreman-client` package provides a complete workflow SDK that handles all queue operations internally:

### Core Features
- 🔧 **Automatic Configuration** - Fetches Redis/queue config from Foreman server
- 📦 **Complete SDK** - Handles both database and queue operations
- 🏃 **Worker Management** - Built-in BullMQ worker creation and management
- 🔄 **Task Lifecycle** - Full task enqueueing, execution, and status tracking
- 📊 **Run Data** - Store and query workflow data with tags
- 🎯 **Clean API** - Simple, composable functions

### Quick Start Example

```typescript
import { 
  initializeForemanClient, 
  createRun, 
  enqueueTask,
  createWorker,
  createRunData,
  queryRunData
} from '@codespin/foreman-client';

// Initialize client (fetches Redis config automatically)
const foremanConfig = {
  endpoint: 'http://localhost:3000',
  apiKey: 'fmn_prod_myorg_abc123',  // Format: fmn_[env]_[orgId]_[random]
  queues: {  // Optional: override default queue names
    taskQueue: 'my-app:tasks',
    resultQueue: 'my-app:results'
  }
};

const client = await initializeForemanClient(foremanConfig);
const { enqueueTask: enqueueFn, createWorker: createWorkerFn } = client;

// Create a run
const run = await createRun(foremanConfig, {
  inputData: { workflowType: 'order-processing' }
});

// Enqueue tasks (handles both DB and BullMQ)
const task = await enqueueFn({
  type: 'process-order',
  runId: run.data.id,
  inputData: { orderId: 'order-456' },
  priority: 10
});

// Complete workflow example with inter-task communication
const worker = await createWorkerFn({
  'validate-order': async (task) => {
    console.log('Validating order:', task.inputData);
    
    // Perform validation
    const isValid = validateOrder(task.inputData.orderId);
    
    // Store result using run data
    await createRunData(foremanConfig, task.runId, {
      taskId: task.id,
      key: 'order-validation',
      value: { valid: isValid, timestamp: Date.now() },
      tags: ['validation', 'order']
    });
    
    return { valid: isValid };
  },
  
  'process-payment': async (task) => {
    console.log('Processing payment:', task.inputData);
    
    // Query previous validation result
    const validationData = await queryRunData(foremanConfig, task.runId, {
      key: 'order-validation'
    });
    
    if (!validationData.success || !validationData.data.data[0]?.value.valid) {
      throw new Error('Order validation failed');
    }
    
    // Process payment
    const result = await processPayment(task.inputData);
    return result;
  }
}, { 
  concurrency: 5,
  maxRetries: 3
});

await worker.start();
```

### Key Architecture Principles

1. **ID-Only Queue Pattern**: Queues store only task IDs, never data
2. **PostgreSQL First**: All data in PostgreSQL, queues are ephemeral
3. **Queue Agnostic**: Can switch between BullMQ, SQS, RabbitMQ without data migration
4. **Multi-tenant**: Organization isolation built-in
5. **Complete SDK**: TypeScript client handles both database and queue operations

## Client API Reference

### Types

```typescript
type ForemanConfig = {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  queues?: {
    taskQueue?: string;
    resultQueue?: string;
  };
}
```

### Configuration Functions

```typescript
// Initialize client with automatic config fetching
// @throws Error if initialization fails
initializeForemanClient(config: ForemanConfig): Promise<{
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  enqueueTask: Function;
  createWorker: Function;
}>

// Get Redis configuration
getRedisConfig(config: ForemanConfig): Promise<Result<RedisConfig, Error>>

// Get queue configuration  
getQueueConfig(config: ForemanConfig): Promise<Result<QueueConfig, Error>>
```

### Run Management

```typescript
// Create a new run
createRun(config: ForemanConfig, input: CreateRunInput): Promise<Result<Run, Error>>

// Get run details
getRun(config: ForemanConfig, id: string): Promise<Result<Run, Error>>

// Update run status
updateRun(config: ForemanConfig, id: string, input: UpdateRunInput): Promise<Result<Run, Error>>

// List runs with filtering
listRuns(config: ForemanConfig, params?: PaginationParams): Promise<Result<PaginatedResult<Run>, Error>>
```

### Task Management

```typescript
// Create a task (DB only)
createTask(config: ForemanConfig, input: CreateTaskInput): Promise<Result<Task, Error>>

// Enqueue a task (DB + Queue) - from initialized client
enqueueTask({
  runId: string,
  type: string,
  inputData: unknown,
  priority?: number,
  delay?: number
}): Promise<Result<{ taskId: string }, Error>>

// Get task status
getTaskStatus(params: {
  foremanConfig: ForemanConfig;
  taskId: string;
}): Promise<Result<TaskStatus, Error>>

// Wait for task completion
waitForTask(params: {
  foremanConfig: ForemanConfig;
  taskId: string;
  timeout?: number;
  pollInterval?: number;
}): Promise<Result<TaskResult, Error>>
```

### Worker Management

```typescript
// Create a worker with multiple handlers
createWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  handlers: Record<string, TaskHandler>;
  options?: WorkerOptions;
}): Promise<WorkerControls>

// Create a worker for a single task type
createTaskWorker(params: {
  foremanConfig: ForemanConfig;
  redisConfig: RedisConfig;
  queueConfig: QueueConfig;
  taskType: string;
  handler: TaskHandler;
  options?: WorkerOptions;
}): Promise<WorkerControls>
```

### Run Data Management (Key Feature)

Foreman's sophisticated key-value storage system for inter-task communication:

```typescript
// Store run data with tags
createRunData(
  config: ForemanConfig,
  runId: string,
  input: CreateRunDataInput
): Promise<Result<RunData, Error>>

// Query run data with flexible filtering
queryRunData(
  config: ForemanConfig,
  runId: string,
  params?: QueryRunDataParams  // Supports key, tags, prefix, sorting
): Promise<Result<{ data: RunData[]; pagination: {...} }, Error>>

// Update tags on existing data
updateRunDataTags(
  config: ForemanConfig,
  runId: string,
  dataId: string,
  input: UpdateRunDataTagsInput
): Promise<Result<RunData, Error>>

// Delete run data
deleteRunData(
  config: ForemanConfig,
  runId: string,
  options: { key?: string; id?: string }
): Promise<Result<{ deleted: number }, Error>>
```

### Run Data Features
- **Multiple Values per Key**: Store multiple entries with same key
- **Tag System**: Flexible tagging for categorization and filtering
- **Prefix Matching**: Query by key prefixes
- **GIN Indexes**: Fast queries on tags using PostgreSQL GIN indexes
- **Sorting Support**: Sort by creation time, update time, or custom fields

## Advanced Usage Examples

### Processing Pipeline with Dependencies

```typescript
// Initialize once
const client = await initializeForemanClient(config);
const { enqueueTask, createWorker } = client;

// Create a processing pipeline
const run = await createRun(config, {
  inputData: { pipeline: 'etl' }
});

// Enqueue tasks with dependencies
const extractTask = await enqueueTask({
  runId: run.data.id,
  type: 'extract',
  inputData: { source: 'database' }
});

const transformTask = await enqueueTask({
  runId: run.data.id,
  type: 'transform',
  inputData: { dependsOn: extractTask.taskId },
  delay: 5000 // Wait 5 seconds
});

// Create workers for each task type
const worker = await createWorker({
  'extract': async (task) => {
    const data = await fetchData(task.inputData.source);
    await createRunData(config, task.runId, {
      taskId: task.id,
      key: 'raw-data',
      value: data,
      tags: ['extracted', 'raw']
    });
    return { recordCount: data.length };
  },
  
  'transform': async (task) => {
    // Query previous results
    const rawData = await queryRunData(config, task.runId, {
      key: 'raw-data'
    });
    
    const transformed = transformData(rawData.data[0].value);
    await createRunData(config, task.runId, {
      taskId: task.id,
      key: 'transformed-data',
      value: transformed,
      tags: ['transformed', 'processed']
    });
    return { success: true };
  }
}, { concurrency: 10 });

await worker.start();
```

### Error Handling with Run Data

```typescript
const worker = await createWorker({
  'risky-operation': async (task) => {
    try {
      const result = await riskyOperation(task.inputData);
      return { success: true, result };
    } catch (error) {
      // Log error details to run data
      await createRunData(config, task.runId, {
        taskId: task.id,
        key: `error-${Date.now()}`,
        value: { 
          error: error.message, 
          stack: error.stack,
          input: task.inputData 
        },
        tags: ['error', task.type]
      });
      throw error; // Re-throw for retry logic
    }
  }
}, {
  maxRetries: 3,
  backoffDelay: 2000
});
```

## Integration with Shaman

Shaman uses Foreman for all workflow orchestration:

```typescript
// Initialize Foreman client in Shaman
import { initializeForemanClient } from '@codespin/foreman-client';

const foremanConfig = {
  endpoint: process.env.FOREMAN_ENDPOINT || 'http://localhost:3000',
  apiKey: process.env.FOREMAN_API_KEY || 'fmn_dev_default_key',
  timeout: 30000,
  queues: {
    taskQueue: process.env.SHAMAN_TASK_QUEUE || 'shaman:tasks',
    resultQueue: process.env.SHAMAN_RESULT_QUEUE || 'shaman:results'
  }
};

const client = await initializeForemanClient(foremanConfig);

// Agent execution workflow
const run = await createRun(foremanConfig, {
  inputData: {
    agentName: 'CustomerSupport',
    input: { message: 'Hello' }
  },
  metadata: { 
    source: 'a2a',
    organizationId: 'org-123' 
  }
});

// Store agent collaboration data
await createRunData(foremanConfig, run.data.id, {
  taskId: 'task-456',
  key: 'agent-response',
  value: { result: 'success' },
  tags: ['response', 'agent:CustomerSupport']
});

// Query collaboration data
const responses = await queryRunData(foremanConfig, run.data.id, {
  tags: ['response'],
  sortBy: 'created_at',
  sortOrder: 'desc'
});
```

## Best Practices

1. **Store Task IDs Only**: Keep queue payloads minimal by storing only task IDs
2. **Use Run Data**: Share data between tasks using the run data key-value store
3. **Handle Retries**: Configure `maxRetries` when creating tasks
4. **Update Status**: Always update task status during processing
5. **Error Handling**: Store detailed error information for debugging
6. **Metadata**: Use metadata for filtering and additional context
7. **Initialize Once**: Call `initializeForemanClient` once and reuse the client
8. **Tag Data**: Use tags for efficient data querying
9. **Set Concurrency**: Configure worker concurrency based on your workload
10. **Clean Shutdown**: Call `worker.stop()` for graceful shutdown

## Configuration Options

### Queue Names

By default, the client fetches queue names from the Foreman server. You can override these:

```typescript
const config = {
  endpoint: 'http://localhost:3000',
  apiKey: 'your-api-key',
  queues: {
    taskQueue: 'my-app:tasks',      // Default: from server config
    resultQueue: 'my-app:results'   // Default: from server config
  }
};
```

This is useful when:
- Running multiple applications with separate queues
- Testing with isolated queue names
- Implementing queue-based routing or priority systems

## Environment Variables

The client respects these environment variables when connecting to Foreman:

- `FOREMAN_ENDPOINT` - Default Foreman server URL
- `FOREMAN_API_KEY` - Default API key for authentication
- `FOREMAN_TIMEOUT` - Default request timeout in milliseconds

## Development

### Project Structure

```
foreman/
├── node/packages/
│   ├── foreman-core/        # Core types and utilities
│   ├── foreman-logger/      # Logging utilities
│   ├── foreman-db/          # Database connection management
│   ├── foreman-server/      # REST API server
│   ├── foreman-client/      # Client library
│   └── foreman-integration-tests/
├── database/
│   └── foreman/
│       ├── migrations/      # Database migrations
│       └── seeds/          # Database seeds
├── scripts/                # Build and utility scripts
└── docs/                   # Documentation
```

### Running Tests

#### Prerequisites

Before running tests, ensure PostgreSQL is running:

```bash
# Start development environment
cd devenv
./run.sh up

# Verify PostgreSQL is running
./run.sh logs postgres
```

#### Test Commands

```bash
# Run all tests (integration + client)
npm run test:integration:all

# Run integration tests only
npm run test:integration:foreman

# Run client tests only
npm run test:client

# Run specific test suite
npm run test:grep -- "Organizations"
npm run test:client:grep -- "Run Management"

# Run with watch mode
npm run test:integration:foreman:watch
npm run test:client:watch
```

### Building

```bash
# Build all packages
./build.sh

# Clean build artifacts
./clean.sh
```

## Testing Coverage

Foreman includes comprehensive testing with a two-layer architecture:

### Integration Tests (49 tests)
- Test the REST API directly using HTTP requests
- Use a real Foreman server instance
- Cover all API endpoints: runs, tasks, run data, configuration
- Located in `/node/packages/foreman-integration-tests`

### Client Tests (18 tests)
- Test the TypeScript client library
- Validate Result types and error handling
- Located in `/node/packages/foreman-client/src/tests`
- Cover all client functions and edge cases

### Test Infrastructure
- Separate test databases (`foreman_test`, `foreman_client_test`)
- Fresh migrations before each test suite
- Table truncation between tests for isolation
- Support grep patterns for running specific tests

## Docker Support

### Quick Start with Docker Compose

```bash
# Start Foreman with PostgreSQL and Redis
docker-compose up

# Access the API at http://localhost:5002
curl http://localhost:5002/health
```

### Building Docker Images

```bash
# Build the Docker image
./scripts/docker-build.sh

# Test the image locally
./scripts/docker-test.sh

# Push to registry
./scripts/docker-push.sh ghcr.io/codespin-ai/foreman latest
```

### Official Images

Official Docker images are available at `ghcr.io/codespin-ai/foreman`.

## Contributing

Please read [CODING-STANDARDS.md](CODING-STANDARDS.md) for our coding standards and guidelines.

## License

MIT