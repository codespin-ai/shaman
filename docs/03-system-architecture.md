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
- Dual authentication support:
  - Session cookies via Ory Kratos (human users)
  - API keys via Permiso (programmatic access)
- Authorization checks via Permiso
- Request forwarding to appropriate Shaman Server instance
- Rate limiting and DDoS protection

**Authentication Flows:**

*Human Users (Management UI):*
```
1. Extract org from subdomain
2. Validate session cookie with Ory Kratos
3. Check permissions with Permiso
4. Forward to GraphQL API with user context
```

*API Key Users (A2A Calls):*
```
1. Extract org from subdomain
2. Extract API key from Authorization header
3. Query Permiso: "Which user owns this API key?"
4. Validate API key is active and not expired
5. Check user permissions with Permiso
6. Forward to A2A endpoint with user context
```

### 2. Shaman Server

The **core API service** handling management operations and exposed agent calls.

**GraphQL API** (Management):
- Repository management (add/remove/sync)
- Organization settings
- User management (delegated to Permiso)
- API key management (create/revoke/list)
- Audit log access
- Requires Kratos session authentication

**A2A Endpoint** (Agent Execution):
- Receives calls to exposed agents
- Accepts API key authentication only
- Creates workflow runs with API key owner context
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

*Management UI Access:*
```
Browser → API Gateway → GraphQL API
    ↑           ↓            ↓
Session    Ory Kratos    Permiso
Cookie     (Identity)    (Permissions)
```

*A2A API Access:*
```
External System → API Gateway → A2A Endpoint
       ↑              ↓              ↓
   API Key        Permiso        Permiso
                (Key→User)    (Permissions)
```

**Layer 2: Internal Security (Agent-to-Agent)**

```
Workflow → Worker → Internal JWT → Agent Execution
            ↓                         ↓
     Generates JWT            Validates JWT
     (workflow scope)         (no user token)
```

### Token Lifecycle

**Session-based Flow (Human Users):**
1. User logs in via Kratos UI
2. Kratos sets session cookie
3. Gateway validates session with Kratos
4. Gateway checks permissions with Permiso
5. Session info used for audit trail

**API Key Flow (Programmatic Access):**
1. System provides API key in Authorization header
2. Gateway looks up key owner in Permiso
3. Gateway validates key is active
4. Gateway checks owner's permissions
5. Owner identity used for audit trail

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
   Headers: Authorization: Bearer sk_live_abc123...

2. API Gateway:
   - Extracts API key from header
   - Queries Permiso: GET /api-keys/sk_live_abc123
   - Gets owner: user_id: "service-account-1", org_id: "acme-corp"
   - Checks user's permission to call ProcessInvoice
   - Forwards to Shaman Server with user context

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

### Exposed Agent Access Control

Organizations control who can access their exposed agents through service accounts:

```typescript
// 1. Admin creates service account for external partner
const serviceAccount = await createServiceAccount({
  email: "partner@external.com",
  type: "SERVICE_ACCOUNT",
  role: "EXTERNAL_API_CLIENT",
  allowedAgents: [
    "/agents/ProcessOrder",     // Can call this
    "/agents/CheckOrderStatus"  // And this
    // Cannot call any other agents
  ]
});

// 2. API key generated with limited permissions
const apiKey = serviceAccount.apiKey; // sk_live_abc123...

// 3. External partner uses API key
// ✅ Allowed - agent is in allowedAgents list
POST /a2a/agents/ProcessOrder
Authorization: Bearer sk_live_abc123...

// ❌ Denied - agent not in allowedAgents list  
POST /a2a/agents/ProcessInvoice
Authorization: Bearer sk_live_abc123...
// Returns: 403 Forbidden

// 4. Permission check in API Gateway
async function checkAgentAccess(apiKey: string, agentPath: string) {
  const validation = await permiso.validateApiKey(apiKey);
  const user = validation.apiKey.user;
  
  // Check if user has permission for this specific agent
  const hasPermission = user.permissions.some(p => 
    p.resourceId === agentPath && p.action === "execute"
  );
  
  if (!hasPermission) {
    throw new ForbiddenError(`API key cannot access agent: ${agentPath}`);
  }
}
```

**Key Points:**
- Only exposed agents can be called externally
- Service accounts have NO Kratos identity
- Permissions are agent-specific, not wildcard
- All calls are audited with service account identity
- API keys can be revoked instantly

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