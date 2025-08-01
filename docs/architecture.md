# Architecture

## System Overview

Shaman has two server types:
- **GraphQL Server**: Management only (users, repos, monitoring)
- **A2A Server**: All agent execution (public and internal modes)

```
External Request → Public A2A → BullMQ → Worker → Internal A2A → Agent
                      ↓                     ↓           ↓
                  PostgreSQL            PostgreSQL  PostgreSQL
```

## Workflow Model

Everything is a **step**:
- **Agent Step**: AI agent execution with LLM
- **Tool Step**: Tool execution (database, API, webhook, or calling another agent)

All workflows start with a `call_agent` tool step - even external requests. This creates a uniform model with no special cases.

### Example Flow

```
1. External: "@CustomerSupport refund order #123"
   → Creates: call_agent tool step (id: step_001)
   
2. call_agent executes
   → Creates: CustomerSupport agent step (id: step_002)
   
3. CustomerSupport executes (with LLM)
   → Creates: query_database tool step (id: step_003)
   → Creates: call_agent tool step (id: step_004)
   
4. call_agent executes
   → Creates: PaymentProcessor agent step (id: step_005)
```

## Packages

### Core Infrastructure

**@codespin/shaman-db**
- PostgreSQL connections with multi-tenancy
- `createRlsDb(orgId)` - Tenant-scoped queries
- `createUnrestrictedDb()` - Admin operations

**@codespin/shaman-workflow**
- BullMQ wrapper for job processing
- Queues: step execution, async polling
- Simple interface hiding implementation details

**@codespin/shaman-worker**
- Processes workflow jobs
- Executes agents and tools
- Updates PostgreSQL state

### Agent System

**@codespin/shaman-agents**
- Unified agent resolution from all sources
- Combines Git repos, external registry
- Agent discovery and loading

**@codespin/shaman-agent-executor**
- Core agent execution engine
- Manages conversations with LLM
- Tracks runs and steps in PostgreSQL
- Domain functions: `createRun()`, `createStep()`, `updateStep()`

**@codespin/shaman-git-resolver**
- Loads agents from Git repositories
- Caches by commit hash
- Supports branches

### Communication

**@codespin/shaman-a2a-server**
- A2A protocol implementation
- Public mode: External API gateway
- Internal mode: Agent execution
- Creates workflows via message handler

**@codespin/shaman-a2a-client**
- HTTP client for A2A calls
- Used by agents to call other agents
- JWT authentication for internal calls

**@codespin/shaman-gql-server**
- GraphQL API for management
- User/repo/workflow queries
- NO agent execution

### Tools & LLM

**@codespin/shaman-tool-router**
- Routes tool calls to handlers
- Platform tools: workflow_data_*
- Handles agent-to-agent calls
- MCP protocol support

**@codespin/shaman-llm-core**
- LLM provider interface
- Model-agnostic abstraction

**@codespin/shaman-llm-vercel**
- Vercel AI SDK implementation
- OpenAI and Anthropic support

### Supporting

**@codespin/shaman-types**
- Shared TypeScript types
- No implementation, just interfaces

**@codespin/shaman-logger**
- Centralized logging
- Structured log output

**@codespin/shaman-config**
- Configuration management
- Environment variables

**@codespin/shaman-security**
- JWT token handling
- Authentication utilities
- (Note: Most auth handled by external services)

**@codespin/shaman-cli**
- Command-line interface
- Development tools

## External Dependencies

### Ory Kratos
- User authentication (sessions)
- Identity management
- GraphQL server integration only

### Permiso
- RBAC authorization
- Permission checks
- External service (not embedded)
- GraphQL server uses their API

### PostgreSQL
- All persistent data
- Row Level Security for multi-tenancy
- Two users: `rls_db_user` (app), `unrestricted_db_user` (admin)

### Redis
- BullMQ job queues
- Temporary workflow state
- Can be reconstructed from PostgreSQL

## Database Schema

### Core Tables

**run** - Workflow instances
```sql
CREATE TABLE run (
  id VARCHAR(26) PRIMARY KEY,
  organization_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  initial_input TEXT NOT NULL,
  final_output TEXT,
  created_by VARCHAR(255) NOT NULL,
  -- timing, costs, metadata...
);
```

**step** - Units of work
```sql
CREATE TABLE step (
  id VARCHAR(26) PRIMARY KEY,
  run_id VARCHAR(26) REFERENCES run(id),
  parent_step_id VARCHAR(26) REFERENCES step(id),
  step_type VARCHAR(20) CHECK (step_type IN ('agent', 'tool')),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  webhook_id VARCHAR(100), -- For async callbacks
  -- timing, errors, metadata...
);
```

**workflow_data** - Agent collaboration store
```sql
CREATE TABLE workflow_data (
  run_id VARCHAR(26) REFERENCES run(id),
  key VARCHAR(255),
  value JSONB,
  created_by_step_id VARCHAR(26) REFERENCES step(id),
  UNIQUE(run_id, key)
);
```

## Execution Flow

### 1. External Request
```javascript
// A2A server receives request
POST /a2a/v1/message/send
{ message: { parts: [{ text: "@Agent do something" }] } }

// Creates in PostgreSQL:
- Run (id: run_001, status: pending)
- Step (id: step_001, type: tool, name: call_agent)

// Queues in BullMQ:
- StepRequest { stepId: step_001, type: tool, name: call_agent }
```

### 2. Worker Processing
```javascript
// Worker picks up job
const request = job.data; // StepRequest

// Updates PostgreSQL:
- Step status → running
- Run status → running (if first)

// Executes based on type:
if (type === 'tool' && name === 'call_agent') {
  // Creates new agent step
  createStep({ type: 'agent', name: request.input.agent });
}
```

### 3. Agent Execution
```javascript
// Worker calls internal A2A server
const jwt = generateInternalJWT({ runId, stepId, orgId });
const response = await a2aClient.sendMessage({
  agent: 'CustomerSupport',
  metadata: { 'shaman:runId': runId, 'shaman:stepId': stepId }
});

// Internal A2A server:
- Loads agent from Git
- Executes with LLM
- Returns response or task ID
```

### 4. Async Handling
```javascript
// Tool returns webhook ID
if (tool === 'send_to_payment_api') {
  const webhookId = generateId();
  await callExternalAPI({ 
    callback: `https://acme.shaman.ai/webhooks/${webhookId}` 
  });
  
  // Update step with webhook_id
  updateStep(stepId, { status: 'waiting', webhook_id: webhookId });
}

// Later, webhook arrives:
POST /webhooks/:webhookId
// Finds step by webhook_id, updates status → completed
```

## Security Model

### Authentication Layers
1. **External**: API keys or Kratos sessions
2. **Internal**: JWT tokens between servers
3. **Database**: RLS policies for tenant isolation

### Multi-Tenancy
- Every table has `organization_id`
- RLS policies enforce isolation
- Separate Redis queues per tenant (optional)

## Deployment

### Development
```bash
# Start services
docker-compose up -d postgres redis

# Run migrations
npm run migrate:shaman:latest

# Start servers
npm run dev:gql-server
npm run dev:a2a-server -- --role public --port 3000
npm run dev:a2a-server -- --role internal --port 4000
npm run dev:worker
```

### Production
- GraphQL server: Public internet
- A2A public server: Public internet  
- A2A internal server: Private network only
- Workers: Private network, multiple instances
- PostgreSQL: Managed service with backups
- Redis: Managed service or cluster