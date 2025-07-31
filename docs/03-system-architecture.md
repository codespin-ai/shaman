# System Architecture

Shaman's architecture is designed for **multi-tenant operation** with **strong isolation** between organizations while maintaining **pluggable components** for infrastructure flexibility.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Subdomain     │  │  Ory Kratos     │  │    Permiso      │  │
│  │    Routing      │  │    (AuthN)      │  │    (AuthZ)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                        SHAMAN SERVER                              │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   GraphQL API   │  │  A2A Endpoint   │  │ Stream Publisher│  │
│  │  (Management)   │  │ (Exposed Agents) │  │   (WebSocket)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                │                                │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │                    AGENT EXECUTOR                         │  │
│  │  ┌─────────────────┐  ┌─────────────────┐              │  │
│  │  │  Tool Router    │  │ LLM Provider    │              │  │
│  │  │  (MCP Protocol) │  │   Abstraction   │              │  │
│  │  └─────────────────┘  └─────────────────┘              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                        SHAMAN WORKER                              │
│                    (Workflow Orchestration)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Workflow Engine │  │  JWT Generator   │  │ Agent Resolver  │  │
│  │    Adapter      │  │  (Internal A2A)  │  │ (Git + External)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                    PERSISTENCE LAYER                              │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   PostgreSQL    │  │  Message Queue   │  │  Redis Cache    │  │
│  │   (State)       │  │  (BullMQ/Temporal)│  │  (Sessions)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Gateway

The **perimeter security layer** that handles all external requests.

**Key Responsibilities:**
- Subdomain-based routing (`acme-corp.shaman.ai` → ACME's environment)
- User authentication via Ory Kratos
- Authorization checks via Permiso
- Request forwarding to appropriate Shaman Server instance
- Rate limiting and DDoS protection

**Security Flow:**
```
1. Extract org from subdomain
2. Validate bearer token with Ory Kratos
3. Check permissions with Permiso (can user call this agent?)
4. Forward to Shaman Server with org context
5. Never pass user token beyond gateway
```

### 2. Shaman Server

The **core API service** handling management operations and exposed agent calls.

**GraphQL API** (Management):
- Repository management (add/remove/sync)
- Organization settings
- User management (delegated to Permiso)
- Audit log access

**A2A Endpoint** (Agent Execution):
- Receives calls to exposed agents
- Creates workflow runs
- Queues jobs for Shaman Worker
- Returns execution results

**Key Features:**
- Multi-tenant aware (org isolation)
- Maintains local user/org mirrors from Permiso
- WebSocket streaming for real-time updates
- Stateless for horizontal scaling

### 3. Shaman Worker

The **workflow orchestration engine** that executes agent DAGs.

**Key Responsibilities:**
- Picks up jobs from message queue
- Resolves agents from repositories
- Generates internal JWT tokens for A2A calls
- Orchestrates agent execution order
- Manages parallel execution branches
- Maintains workflow state

**Internal Security:**
```typescript
// Worker generates JWT for internal calls
const internalToken = {
  iss: "shaman-worker",
  aud: "target-agent-name",
  run_id: "workflow-123",
  org_id: "acme-corp",
  exp: Date.now() + 300000 // 5 minutes
};
```

### 4. Agent Resolution System

Unified agent discovery across multiple sources with intelligent caching.

**Resolution Order:**
1. Check `agents.json` aliases in current repository
2. Look for agent in same repository
3. Check external agent registry
4. Return error if not found

**Git Repository Caching:**
- Commit-hash based (only sync when changed)
- Per-file change detection
- Branch-aware resolution
- Automatic sync intervals

### 5. Identity & Authorization Services

**Ory Kratos** (Authentication):
- Handles user login/logout
- Session management
- Multi-factor authentication
- Password recovery
- Answers: "Who is this user?"

**Permiso** (Authorization & Data):
- Organization management
- User profiles and roles
- Resource-based permissions
- Answers: "What can this user do?"

**Local Mirrors:**
```typescript
// Shaman maintains local copies for performance
type OrgMirror = {
  id: string;        // From Permiso
  permiso_id: string;
  subdomain: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

type UserMirror = {
  id: string;        // From Permiso
  permiso_id: string;
  org_id: string;
  identity_provider: string;
  identity_provider_user_id: string;
};
```

## Multi-Tenant Architecture

### Isolation Mechanisms

**Network Isolation:**
- Each org gets unique subdomain
- Routing at API Gateway level
- No cross-org network access

**Data Isolation:**
- Org ID required for all queries
- Database-level row security
- Separate agent repositories per org

**Execution Isolation:**
- Workflows scoped to organization
- No cross-org agent calls without external A2A
- Separate message queues per org (optional)

### Repository Management

Each organization can have multiple repositories:

```typescript
type Repository = {
  id: string;
  org_id: string;
  name: string;
  git_url: string;
  branch: string;
  is_root: boolean;  // Can agents be called without namespace?
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
};
```

**Repository Structure:**
```
customer-support-repo/
├── agents.json           # Aliases and configuration
├── ProcessInvoice/
│   └── prompt.md         # Exposed agent
├── ValidateData/
│   └── prompt.md         # Private agent
└── internal/
    └── AuditCheck/
        └── prompt.md     # Private agent
```

## Security Architecture

### Two-Layer Security Model

**Layer 1: Perimeter Security (External Calls)**

```
External Client → API Gateway → Shaman Server → Workflow
     ↑                ↓              ↓
     |         Ory Kratos      Permiso
     |         (Identity)      (Permissions)
     |
Bearer Token
```

**Layer 2: Internal Security (Agent-to-Agent)**

```
Workflow → Worker → Internal JWT → Agent Execution
            ↓                         ↓
     Generates JWT            Validates JWT
     (workflow scope)         (no user token)
```

### Token Lifecycle

**External Token Flow:**
1. User provides bearer token
2. Gateway validates with Ory Kratos
3. Gateway checks permissions with Permiso
4. Token stops at gateway (never passed internally)
5. Worker maintains token for audit only

**Internal Token Flow:**
1. Worker generates short-lived JWT
2. JWT contains workflow metadata (not user data)
3. Each agent call gets new JWT
4. Tokens expire after 5 minutes
5. Agent infrastructure validates JWT

## Execution Flow

### Exposed Agent Call

```
1. POST https://acme-corp.shaman.ai/a2a/agents/ProcessInvoice
   Headers: Authorization: Bearer <user-token>

2. API Gateway:
   - Validates user with Ory Kratos
   - Checks permission with Permiso
   - Forwards to Shaman Server

3. Shaman Server:
   - Creates workflow_run record
   - Queues job for Worker
   - Returns run_id to client

4. Shaman Worker:
   - Picks up job
   - Resolves ProcessInvoice agent
   - Executes agent with LLM
   - Agent calls internal agents

5. Internal A2A calls:
   - Worker generates JWT for each call
   - Executes ValidateData agent
   - Returns result to ProcessInvoice

6. Completion:
   - ProcessInvoice calls complete_agent_execution
   - Worker updates workflow_run status
   - Result returned to client
```

### Agent Resolution

```typescript
// Agent calls another by name
call_agent({ agent: "TaxCalculator", task: "..." })

// Resolution process:
1. Check agents.json:
   {
     "TaxCalculator": {
       "url": "https://tax-service.com/a2a/agents/CalculateTax"
     }
   }

2. If found → use URL
3. If not found → check same repository
4. If not found → check external registry
5. If not found → error
```

## Workflow Engine Adapters

Pluggable workflow engines for different deployment scenarios:

**BullMQ Adapter** (Development):
```typescript
{
  type: 'bullmq',
  config: {
    redis: { host: 'localhost', port: 6379 },
    queues: { 
      default: 'shaman-jobs',
      perOrg: true  // Separate queues per org
    }
  }
}
```

**Temporal Adapter** (Production):
```typescript
{
  type: 'temporal',
  config: {
    connection: { address: 'temporal.cluster:7233' },
    namespace: 'shaman-production',
    taskQueue: 'shaman-workers'
  }
}
```

## Observability

### OpenTelemetry Integration

Every component emits traces:
- HTTP requests (Gateway → Server)
- Workflow execution (Worker)
- Agent calls (with full context)
- Tool executions
- LLM interactions

### Audit Trail

Complete record of all actions:
```typescript
type AuditEntry = {
  id: string;
  org_id: string;
  user_id: string;      // Original user
  run_id: string;       // Workflow run
  action: string;       // 'agent_call', 'tool_execution', etc
  resource: string;     // Agent or tool name
  timestamp: Date;
  metadata: {
    input?: any;
    output?: any;
    error?: any;
    duration_ms: number;
  };
};
```

## Scalability Patterns

### Horizontal Scaling

**API Gateway**: Load balancer with multiple instances
**Shaman Server**: Stateless, auto-scale based on load
**Shaman Worker**: Scale workers independently per org
**Database**: Read replicas for query distribution

### Performance Optimizations

**Agent Caching**: Git agents cached by commit hash
**Connection Pooling**: Reuse database and Redis connections
**Lazy Loading**: Load agents on-demand, not at startup
**Streaming**: WebSocket for real-time updates without polling

### Multi-Region Deployment

```
Region 1 (US-East)          Region 2 (EU-West)
├── API Gateway             ├── API Gateway
├── Shaman Servers          ├── Shaman Servers
├── Workers                 ├── Workers
└── Regional DB             └── Regional DB
         ↓                           ↓
         └───────── Global DB ───────┘
              (Multi-region replica)
```

This architecture provides:
- ✅ **Complete tenant isolation**
- ✅ **Two-layer security model**
- ✅ **Flexible workflow engines**
- ✅ **Horizontal scalability**
- ✅ **Full audit trails**
- ✅ **Simple agent authoring**