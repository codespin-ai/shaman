# Architecture

## System Overview

Shaman implements the A2A Protocol v0.3.0 for agent-to-agent communication and has two server types:
- **GraphQL Server**: Management only (users, repos, monitoring)
- **A2A Server**: All agent execution (public and internal modes)

```
External Request → Public A2A → Foreman → Worker → Agent Executor
    (JSON-RPC)        ↓            ↓         ↓           ↓
                  PostgreSQL    Redis    PostgreSQL   LLM Provider
```

## A2A Protocol Implementation

Shaman fully implements the A2A v0.3.0 specification:

### Core Methods
- `message/send` - Send messages to agents
- `tasks/get` - Retrieve task status
- `tasks/cancel` - Cancel running tasks

### Optional Methods
- `message/stream` - Server-Sent Events for real-time updates
- `tasks/pushNotificationConfig/set` - Configure webhooks
- `agent/authenticatedExtendedCard` - Extended agent metadata

### Transport
- Primary: JSON-RPC 2.0 over HTTP
- Streaming: Server-Sent Events (SSE)
- Future: gRPC and HTTP+JSON support

### Task Lifecycle
Tasks follow the A2A state machine:
- Active: `submitted`, `working`
- Interrupted: `input-required`, `auth-required`
- Terminal: `completed`, `failed`, `canceled`, `rejected`

## Workflow Model

Everything is a **step**:
- **Agent Step**: AI agent execution with LLM
- **Tool Step**: Tool execution (database, API, webhook, or calling another agent)

All workflows start with a `call_agent` tool step - even external requests. This creates a uniform model with no special cases.

**Note**: All workflow orchestration is handled by the external Foreman service via `@codespin/foreman-client`.

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

**Foreman (External Service)**
- Handles ALL workflow orchestration via `@codespin/foreman-client`
- Manages runs, tasks, and workflow state
- Provides run_data storage for agent collaboration
- Queue management (Redis/BullMQ) handled internally by Foreman
- REST API at `FOREMAN_ENDPOINT` (default: http://localhost:3000)

**@codespin/shaman-worker**
- Processes tasks from Foreman queues
- Directly executes agents using agent-executor
- Integrates with LLM providers (OpenAI, Anthropic)
- Updates task status in Foreman
- Stores results as run_data in Foreman

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
- Full A2A v0.3.0 protocol implementation
- Public mode: External API gateway with AgentCard discovery
- Internal mode: Agent execution with JWT auth
- Creates workflows via message handler
- Generates AgentCards from agent YAML frontmatter
- Supports streaming via SSE and webhook notifications

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
- Platform tools: run_data_*
- Handles agent-to-agent calls
- MCP protocol support

**@codespin/shaman-llm-core**
- LLM provider interface
- Model-agnostic abstraction

**@codespin/shaman-llm-vercel**
- Vercel AI SDK v5.0.8 implementation
- OpenAI support via @ai-sdk/openai@2.0.5
- Anthropic support via @ai-sdk/anthropic@2.0.1
- Streaming and tool calling support

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

### Ory Kratos (Planned Integration)
- User authentication service (external)
- Would provide identity management and sessions
- **Status**: Not yet integrated
- **Current Auth**: JWT tokens and API keys handled internally by shaman-security package

### Permiso (Planned Integration)
- RBAC authorization service (external)
- Would provide permission checks via GraphQL API
- **Status**: Not yet integrated - configuration exists but no implementation
- **Future**: Will use `@codespin/permiso-client` when implemented

### Foreman
- Workflow orchestration engine
- Run and task management
- Workflow data storage (run_data)
- External REST API service accessed via `@codespin/foreman-client`
- Handles all workflow execution and state management

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

**run_data** - Agent collaboration store
```sql
CREATE TABLE run_data (
  run_id VARCHAR(26) REFERENCES run(id),
  key VARCHAR(255),
  value JSONB,
  created_by_step_id VARCHAR(26) REFERENCES step(id),
  UNIQUE(run_id, key)
);
```

## Execution Flow

### 1. External Request (A2A Protocol)
```javascript
// A2A server receives JSON-RPC request
POST /a2a/v1
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "message/send",
  "params": {
    "agentName": "CustomerSupport",
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Help with order #123"
      }]
    }
  }
}

// Creates in PostgreSQL:
- Run (id: run_001, status: pending)
- Task mapping (taskId: task_run_001 -> runId: run_001)
- Step (id: step_001, type: tool, name: call_agent)

// Returns A2A response:
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "taskId": "task_run_001",
    "contextId": "ctx_abc123",
    "status": {
      "state": "submitted",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}

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
  
  // Configure A2A push notification
  await a2aServer.configurePushNotification({
    taskId: currentTaskId,
    webhookUrl: `https://acme.shaman.ai/a2a/v1/webhooks/${webhookId}`,
    headers: { 'X-Webhook-Secret': generateSecret() }
  });
  
  await callExternalAPI({ 
    callback: `https://acme.shaman.ai/webhooks/${webhookId}` 
  });
  
  // Update step with webhook_id
  updateStep(stepId, { status: 'waiting', webhook_id: webhookId });
}

// Later, webhook arrives:
POST /webhooks/:webhookId
// Finds step by webhook_id, updates status → completed
// Sends A2A task update to any configured push endpoints
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

## AgentCard Discovery

Shaman automatically generates AgentCards from agent YAML frontmatter:

```yaml
# Agent file
---
name: CustomerSupport
description: Handles customer inquiries
model: gpt-4
exposed: true
tools: [run_data_read, call_agent]
---
```

Becomes:

```json
{
  "protocolVersion": "0.3.0",
  "name": "CustomerSupport",
  "description": "Handles customer inquiries",
  "version": "1.0.0",
  "url": "https://acme.shaman.ai/a2a/v1",
  "preferredTransport": "JSONRPC",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateHistory": true
  }
}
```

Discovery endpoints:
- `/.well-known/a2a/agents` - List all exposed agents
- `/a2a/v1/agents/{name}` - Individual agent details

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