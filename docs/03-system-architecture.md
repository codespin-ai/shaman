[← Previous: Use Cases & Agent Model](./02-use-cases-and-agent-model.md) | [🏠 Home](./README.md) | [Next: Deployment & Configuration →](./04-deployment-and-configuration.md)

---

# System Architecture

Shaman employs a **clean separation of concerns** with distinct servers for management (GraphQL) and execution (A2A). All agent execution flows through the A2A protocol, ensuring security, auditability, and standards compliance.

## Server Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         External World                               │
│  Browsers, Mobile Apps, External Systems, Partner APIs              │
└─────────────────────────────────┬────────────┬──────────────────────┘
                                  │ HTTPS      │ A2A Protocol
                                  ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GRAPHQL SERVER                                  │
│                   (shaman-gql-server)                                │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │  GraphQL API │  │ Ory Kratos      │  │  Permiso RBAC          │ │
│  │ (Management) │  │ (Auth)          │  │  (Permissions)         │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Management Operations Only:                                    │  │
│  │ • Agent repository sync                                        │  │
│  │ • User/tenant management                                       │  │
│  │ • Workflow monitoring                                          │  │
│  │ • NO AGENT EXECUTION                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   A2A SERVER - PUBLIC MODE                           │
│              (shaman-a2a-server --role public)                       │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ A2A Endpoint │  │ API Key/OAuth   │  │  Workflow Engine       │ │
│  │  /a2a/v1/*   │  │  Validation     │  │  (BullMQ)              │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
│                                                                      │
│  • Accepts external A2A requests                                     │
│  • Starts workflow jobs                                              │
│  • Returns execution results                                         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ Internal A2A (JWT)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   A2A SERVER - INTERNAL MODE                         │
│              (shaman-a2a-server --role internal)                     │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ A2A Endpoint │  │ JWT Token       │  │  Agent Executor        │ │
│  │  /a2a/v1/*   │  │  Validation     │  │  (LLM + Tools)         │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
│                                                                      │
│  • Only accepts internal requests (JWT auth)                         │
│  • Executes agent logic                                              │
│  • Makes A2A calls to other agents                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ PostgreSQL   │  │ Redis (BullMQ)  │  │  Object Storage        │ │
│  │ (Multi-DB)   │  │                 │  │  (Artifacts)           │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Server Components

### GraphQL Server (`shaman-gql-server`)

The **management-only server** that provides administrative APIs:

**Primary Functions:**
- GraphQL API for all management operations
- User authentication via Ory Kratos
- Authorization via Permiso RBAC
- Agent repository management
- Workflow monitoring and queries
- NO agent execution capabilities

**Key Characteristics:**
- Stateless and horizontally scalable
- Cannot execute agents
- Read-only access to workflow data
- Manages configuration and metadata

**Startup Command:**
```bash
cd node/packages/shaman-gql-server && npm start
```

### A2A Server (`shaman-a2a-server`)

The **execution gateway** that handles all agent invocations:

**Deployment Modes:**

#### Public Mode (`--role public`)
- Accepts A2A requests from external systems
- Validates API keys or OAuth tokens
- Starts workflow jobs via BullMQ
- Returns execution results
- Exposed to internet (with security)

#### Internal Mode (`--role internal`)
- Only accepts requests with internal JWT tokens
- Executes agent logic with LLM providers
- Manages tool execution via MCP and platform tools
- Makes A2A calls to other agents
- NOT exposed to internet

**Startup Commands:**
```bash
# Public mode
cd node/packages/shaman-a2a-server && npm start -- --role public --port 5000

# Internal mode
cd node/packages/shaman-a2a-server && npm start -- --role internal --port 5001
```

## Communication Flows

### 1. External Agent Invocation

When an external system wants to execute an agent:

```
1. External System → A2A Server (Public)
   POST https://acme.shaman.ai/a2a/v1/message/send
   Authorization: Bearer sk_live_abc123...
   Content-Type: application/json
   
   {
     "jsonrpc": "2.0",
     "id": "req-001",
     "method": "message/send",
     "params": {
       "message": {
         "role": "user",
         "parts": [{
           "kind": "text",
           "text": "@ProcessOrder Process order #12345"
         }]
       },
       "configuration": {
         "blocking": false
       }
     }
   }
   
2. A2A Public Server:
   - Validates API key
   - Creates workflow job in BullMQ
   - Returns task ID immediately
   
3. Worker picks up job:
   - Generates internal JWT token
   - Makes A2A call to internal server
   
4. Worker → A2A Server (Internal)
   POST https://internal-a2a:5001/a2a/v1/message/send
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   Content-Type: application/json
   
   {
     "jsonrpc": "2.0",
     "id": "req-002",
     "method": "message/send",
     "params": {
       "message": {
         "role": "user",
         "parts": [{
           "kind": "text",
           "text": "@ProcessOrder Process order #12345"
         }],
         "taskId": "task-123"
       },
       "configuration": {
         "blocking": true
       },
       "metadata": {
         "shaman:runId": "run-abc123",
         "shaman:organizationId": "acme"
       }
     }
   }
   
5. A2A Internal Server:
   - Validates JWT token
   - Executes agent with LLM
   - Returns result
   
6. Worker updates job status
   
7. External system can poll or receive webhook
```

### 2. Agent-to-Agent Communication

When one agent needs to call another:

```
1. OrderProcessor (Internal Server A) decides to call InventoryChecker
   
2. Internal Server A → Internal Server B (A2A)
   POST https://internal-server-b:4000/a2a/v1/message/send
   Authorization: Bearer <api-token>
   Content-Type: application/json
   
   {
     "jsonrpc": "2.0",
     "id": "req-001",
     "method": "message/send",
     "params": {
       "message": {
         "role": "user",
         "parts": [{
           "kind": "text",
           "text": "Check inventory for item SKU-12345"
         }]
       },
       "metadata": {
         "shaman:runId": "run-abc123",
         "shaman:parentStepId": "step-456",
         "shaman:depth": 2,
         "shaman:organizationId": "acme"
       }
     }
   }
   
3. Internal Server B:
   - Validates API token
   - Checks agent exists and is accessible
   - Executes InventoryChecker with workflow context
   - Returns result with same metadata
   
4. OrderProcessor receives result and continues
```

**Critical Detail**: The `metadata` field carries the workflow context (runId, parentStepId, depth) through all agent-to-agent calls. This enables Shaman to build the complete execution DAG (Directed Acyclic Graph) across distributed agent invocations.

### 3. External Agent Federation

When an agent needs to call an external agent:

```
1. TaxCalculator (Internal) needs external rate service
   
2. Internal Server → External A2A Service
   POST https://tax-service.com/a2a/v1/message/send
   Authorization: Bearer external_api_key_xyz...
   Content-Type: application/json
   
   {
     "jsonrpc": "2.0",
     "id": "req-003",
     "method": "message/send",
     "params": {
       "message": {
         "role": "user",
         "parts": [{
           "kind": "text",
           "text": "@GetTaxRate Calculate tax for ZIP 94105, amount $1000"
         }]
       }
     }
   }
   
3. External service processes and returns result
   
4. TaxCalculator continues with tax rate data
```

## Security Architecture

### Three-Layer Security Model

**Layer 1: Perimeter Security (Public Server)**
- API Gateway validates all incoming requests
- Dual authentication: Kratos sessions + API keys
- Permiso RBAC for authorization
- Rate limiting and DDoS protection
- TLS termination

**Layer 2: Internal Communication (A2A Protocol)**
- JWT tokens for all internal calls
- Short-lived tokens (5-minute expiry)
- Token includes workflow context, not user data
- Mutual TLS between servers (optional)
- Request signing for integrity

**Layer 3: Agent Execution (Internal Server)**
- Agents run in isolated contexts
- No direct access to user tokens
- Tool access controlled via MCP permissions in agent YAML
- Audit logging for all operations
- Resource limits per execution

### Row Level Security (RLS) Implementation

Shaman implements comprehensive RLS for automatic multi-tenant isolation:

```typescript
// Create org-scoped database connection
const db = createRlsDb(orgId);

// All queries automatically filtered by organization
const agents = await getAgentsByOrg(db); // Only returns this org's agents
```

**Database Users:**
- `rls_db_user`: Application user with RLS policies enforced
- `unrestricted_db_user`: Admin user for migrations and system tasks

**RLS Features:**
- Automatic context injection: Sets `app.current_org_id` before each query
- Transparent operation: No manual filtering required in queries
- Policy-based: PostgreSQL enforces isolation at database level
- Performance optimized: Uses session variables for efficient filtering

**Protected Tables:**
- All tenant-scoped tables have RLS policies
- Policies cascade through foreign key relationships
- Cross-tenant queries automatically blocked

### JWT Token Structure

Internal JWT tokens contain:

```json
{
  "iss": "shaman-public-server",
  "aud": "shaman-internal-server",
  "exp": 1234567890,
  "iat": 1234567800,
  "jti": "unique-request-id",
  "context": {
    "tenantId": "acme",
    "runId": "run-abc123",
    "parentTaskId": "task-parent-456",
    "depth": 1,
    "initiator": {
      "type": "api_key",
      "id": "sk_live_abc123",
      "userId": "user-789"
    }
  }
}
```

### Git Repository Authentication

The system supports universal Git authentication across all providers (GitHub, GitLab, Bitbucket, etc.) using personal access tokens (PATs).

#### Authentication Flow
1. Customer provides PAT via GraphQL mutation `setGitCredentials`
2. Token is encrypted at rest using AES-256-GCM
3. Git operations use HTTPS with token embedded in URL
4. Tokens are automatically sanitized from all logs

#### Security Considerations
- Tokens stored in `git_credentials` table with encryption
- Each repository can have its own credentials
- Tokens scoped to minimum required permissions (read-only)
- Automatic token rotation reminders
- Audit logging for all credential operations

## Workflow Tracking via A2A Metadata

Shaman tracks the complete execution DAG across distributed agents using the A2A protocol's `metadata` field:

### Metadata Structure
```json
{
  "metadata": {
    "shaman:runId": "run-abc123",           // Unique workflow instance ID
    "shaman:parentStepId": "step-parent-456", // Parent step in the DAG
    "shaman:depth": 2,                       // Call depth (for recursion limits)
    "shaman:organizationId": "acme",         // Tenant isolation
    "shaman:initiatorId": "user-789"         // Original caller
  }
}
```

### How It Works

#### Option 1: Implicit Run Creation (Default)
1. **Initial Request**: A2A public server creates a new Run with unique ID
2. **First Agent**: Receives metadata with runId and no parentStepId
3. **Agent Calls Agent**: Includes runId and its own stepId as parentStepId
4. **Response Flow**: Each agent returns results with same metadata
5. **DAG Construction**: System builds complete execution tree from metadata

#### Option 2: Explicit Run Creation (Advanced Orchestration)
1. **Create Run**: Client calls GraphQL `createRun` mutation, gets runId
2. **Start Multiple Agents**: Client invokes multiple agents with same runId:
   ```json
   {
     "metadata": {
       "shaman:runId": "run-abc123"  // Pre-created run ID
       // No parentStepId - these are all root steps
     }
   }
   ```
3. **Parallel Execution**: Multiple agents execute as root steps in same workflow
4. **Fork-Join Patterns**: Enables map-reduce, parallel processing, etc.

### Benefits
- **Full Traceability**: Every step linked to its parent and workflow
- **Distributed Tracking**: Works across any number of servers
- **A2A Compliant**: Uses standard metadata field, no protocol changes
- **Tenant Isolation**: organizationId ensures data separation
- **Flexible Orchestration**: Support for both single-root and multi-root workflows

## Component Architecture

### Agent Resolution Pipeline

```
Agent Name → Alias Resolution → Repository Check → Git Sync → Agent Load
    │              │                   │                │           │
    └──────────────┴───────────────────┴────────────────┴───────────┘
                              Resolution Cache
```

**Resolution Steps:**
1. Check `agents.json` for aliases
2. Search in current repository
3. Check external agent registry
4. Sync from Git if needed
5. Cache by commit hash

### Tool Execution via MCP

Agents access tools through MCP servers configured in their Git repositories:

```
Agent → Tool Request → MCP Client → Transport → MCP Server → Tool
  │                        │            │            │          │
  └────────────────────────┴────────────┴────────────┴──────────┘
                          Tool Response Pipeline
```

**MCP Configuration:**
- Defined in agent YAML frontmatter (not in database)
- Servers discovered from Git repositories
- Multiple transport options (stdio, HTTP+SSE)

**Built-in Platform Tools:**
- `workflow_data_write`: Store data for agent collaboration
- `workflow_data_read`: Retrieve specific data by key
- `workflow_data_query`: Search data by patterns
- `workflow_data_list`: List all stored data with metadata

### Workflow Orchestration

The workflow engine (BullMQ) manages execution flow:

```
A2A Request → Job Queue → Worker Pool → Agent Execution
      │           │            │              │
      └───────────┴────────────┴──────────────┘
               BullMQ Job Processing
```

**Workflow Features:**
- **BullMQ**: Redis-based job queue
- **Job persistence**: Survives server restarts
- **Retry logic**: Configurable retry policies
- **Job priorities**: Important jobs first
- **Monitoring**: Built-in job dashboard

## Multi-Tenant Isolation

### Tenant Boundaries

Each organization operates in complete isolation:

```
┌─────────────────────────────────────────┐
│          Organization: ACME             │
│                                         │
│  Subdomain: acme.shaman.ai            │
│  Database: tenant_acme_*               │
│  Agents: acme/repository/*             │
│  Queue: shaman-acme-jobs               │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Users   │  │ Agents  │  │ API Keys│ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│        Organization: TechCorp           │
│                                         │
│  Subdomain: techcorp.shaman.ai        │
│  Database: tenant_techcorp_*          │
│  Agents: techcorp/repository/*        │
│  Queue: shaman-techcorp-jobs          │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Users   │  │ Agents  │  │ API Keys│ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

### Isolation Enforcement

**Network Level:**
- Subdomain routing at load balancer
- Separate internal networks per tenant (optional)
- API Gateway enforces tenant context

**Data Level:**
- Tenant ID in all database queries
- Separate schemas or databases
- No cross-tenant joins possible

**Execution Level:**
- Workflow queues scoped by tenant
- Agent namespaces prevent conflicts
- MCP servers configured in agent repositories

## Scalability Patterns

### Horizontal Scaling

Each component scales independently:

```
                    Load Balancer
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Public-1         Public-2         Public-3
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Internal LB
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  Internal-1       Internal-2       Internal-3
```

**Scaling Strategies:**
- Public servers: Scale based on API traffic
- Internal servers: Scale based on agent execution load
- Database: Read replicas for query distribution
- Message queue: Partition by tenant

### Performance Optimizations

**Caching Layers:**
1. CDN for static assets
2. Redis for session data
3. Git agent cache (commit-based)
4. LLM response cache (optional)

**Connection Pooling:**
- Database connections per server
- HTTP keep-alive for A2A calls
- MCP server connection reuse

**Async Processing:**
- Long-running agents use workflow engine
- WebSocket for real-time updates
- Batch operations where possible

## Observability

### Distributed Tracing

Every request flows through multiple services:

```
[Trace ID: abc123]
├─ API Gateway (50ms)
│  └─ Auth Check (10ms)
├─ Public Server (200ms)
│  ├─ Permission Check (20ms)
│  └─ A2A Call (180ms)
└─ Internal Server (150ms)
   ├─ Agent Resolution (30ms)
   ├─ LLM Call (100ms)
   └─ Tool Execution (20ms)
```

### Metrics Collection

Key metrics tracked:
- Request latency by endpoint
- Agent execution time
- LLM token usage
- Tool call frequency
- Error rates by tenant

### Audit Logging

Complete audit trail:
```json
{
  "timestamp": "2024-03-15T10:00:00Z",
  "traceId": "abc123",
  "tenantId": "acme",
  "userId": "user-456",
  "action": "agent.execute",
  "resource": "ProcessOrder",
  "server": "internal-server-1",
  "protocol": "a2a",
  "duration": 350,
  "status": "success"
}
```

## Deployment Topologies

### Development Environment

Simple single-node setup:
```
Docker Compose
├─ postgres:15
├─ redis:7
├─ shaman-public:latest (port 3000)
├─ shaman-internal:latest (port 4000)
└─ temporal:latest (optional)
```

### Production Environment

Multi-region, high-availability:
```
Region: US-East
├─ ALB → Public Servers (3x)
├─ Internal ALB → Internal Servers (5x)
├─ RDS PostgreSQL (Multi-AZ)
├─ ElastiCache Redis (Cluster)
└─ Temporal Cloud

Region: EU-West
├─ ALB → Public Servers (3x)
├─ Internal ALB → Internal Servers (5x)
├─ RDS PostgreSQL (Read Replica)
├─ ElastiCache Redis (Cluster)
└─ Temporal Cloud
```

## Key Architecture Benefits

1. **Security**: Complete separation of concerns with protocol-based communication
2. **Scalability**: Independent scaling of public and internal tiers
3. **Standards**: A2A and MCP protocols ensure interoperability
4. **Auditability**: Every operation tracked through the system
5. **Flexibility**: Pluggable components for different deployment needs
6. **Isolation**: True multi-tenant architecture with no shared resources

---

[← Previous: Use Cases & Agent Model](./02-use-cases-and-agent-model.md) | [🏠 Home](./README.md) | [Next: Deployment & Configuration →](./04-deployment-and-configuration.md)