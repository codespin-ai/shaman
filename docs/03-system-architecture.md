[← Previous: Use Cases & Agent Model](./02-use-cases-and-agent-model.md) | [🏠 Home](./README.md) | [Next: Deployment & Configuration →](./04-deployment-and-configuration.md)

---

# System Architecture

Shaman employs a **two-server deployment model** that separates public-facing operations from internal agent execution. All agent-to-agent communication uses the **A2A protocol over HTTP**, ensuring security, auditability, and standards compliance.

## Two-Server Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         External World                               │
│  Browsers, Mobile Apps, External Systems, Partner APIs              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PUBLIC SERVER (--role public)                     │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ API Gateway  │  │  GraphQL API    │  │  A2A Public Endpoint   │ │
│  │ (Auth/Route) │  │  (Management)    │  │  (/a2a/v1/agents/*)   │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ Ory Kratos   │  │    Permiso      │  │  WebSocket Gateway     │ │
│  │ (Sessions)   │  │  (RBAC/Users)   │  │  (Live Updates)        │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ A2A Protocol (HTTPS + JWT)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INTERNAL SERVER (--role internal)                  │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ A2A Internal │  │ Agent Executor  │  │  Workflow Engine       │ │
│  │  Endpoint    │  │ (LLM + Tools)   │  │  (Temporal/BullMQ)     │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ Git Agent    │  │  MCP Server     │  │  JWT Token             │ │
│  │  Resolver    │  │  Manager        │  │  Generator             │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ PostgreSQL   │  │ Redis/Message   │  │  Object Storage        │ │
│  │ (Multi-DB)   │  │    Queue        │  │  (Artifacts)           │ │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Server Roles and Responsibilities

### Public Server (`--role public`)

The **public-facing server** that handles all external interactions:

**Primary Functions:**
- API Gateway with subdomain-based tenant routing
- GraphQL API for management operations
- External A2A endpoint for agent invocations
- Authentication via Ory Kratos (sessions) and API keys
- Authorization via Permiso RBAC
- WebSocket gateway for real-time updates

**Key Characteristics:**
- Stateless and horizontally scalable
- Does NOT execute agents directly
- Forwards agent requests to internal server via A2A
- Maintains security perimeter
- Handles all external authentication

**Startup Command:**
```bash
npm start -- --role public --port 3000
```

### Internal Server (`--role internal`)

The **agent execution server** that runs in a protected environment:

**Primary Functions:**
- Receives A2A requests from public server
- Executes agent logic with LLM providers
- Manages MCP tool connections
- Orchestrates workflows via pluggable engines
- Handles agent-to-agent communication via A2A

**Key Characteristics:**
- Not directly accessible from internet
- Authenticates via JWT tokens only
- Can make outbound A2A calls to other agents
- Manages tool execution via MCP protocol
- Maintains conversation context

**Startup Command:**
```bash
npm start -- --role internal --port 4000
```

## Communication Flows

### 1. External Agent Invocation

When an external system calls an exposed agent:

```
1. External System → Public Server
   POST https://acme.shaman.ai/a2a/v1/agents/ProcessOrder/execute
   Authorization: Bearer sk_live_abc123...
   
2. Public Server:
   - Validates API key with Permiso
   - Checks permissions for agent access
   - Creates workflow run record
   - Generates internal JWT token
   
3. Public Server → Internal Server (A2A)
   POST https://internal-server:4000/a2a/v1/agents/ProcessOrder/execute
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   X-Shaman-Context: {"tenantId":"acme","userId":"api-user-123"}
   
4. Internal Server:
   - Validates JWT token
   - Resolves agent from Git repository
   - Executes agent with LLM
   - Returns result via A2A response
   
5. Public Server → External System
   Returns final result with execution metadata
```

### 2. Agent-to-Agent Communication

When one agent needs to call another:

```
1. OrderProcessor (Internal Server A) decides to call InventoryChecker
   
2. Internal Server A → Internal Server B (A2A)
   POST https://internal-server-b:4000/a2a/v1/agents/InventoryChecker/execute
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   X-Shaman-Context: {"parentTaskId":"task-123","depth":2}
   
3. Internal Server B:
   - Validates JWT (issued by workflow engine)
   - Checks agent exists and is accessible
   - Executes InventoryChecker
   - Returns result
   
4. OrderProcessor receives result and continues
```

### 3. External Agent Federation

When an agent needs to call an external agent:

```
1. TaxCalculator (Internal) needs external rate service
   
2. Internal Server → External A2A Service
   POST https://tax-service.com/a2a/v1/agents/GetTaxRate/execute
   Authorization: Bearer external_api_key_xyz...
   
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
- Tool access controlled via MCP permissions
- Audit logging for all operations
- Resource limits per execution

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

Agents access tools through MCP servers:

```
Agent → Tool Request → MCP Client → Transport → MCP Server → Tool
  │                        │            │            │          │
  └────────────────────────┴────────────┴────────────┴──────────┘
                          Tool Response Pipeline
```

**MCP Transports:**
- `stdio`: Local process communication
- `http+sse`: Remote server communication
- Future: WebSocket, gRPC

### Workflow Orchestration

The workflow engine manages execution flow:

```
Workflow Definition → Task Queue → Worker Pool → Agent Execution
        │                 │            │              │
        └─────────────────┴────────────┴──────────────┘
                    Workflow State Machine
```

**Supported Engines:**
- **Temporal**: Production-grade with durability
- **BullMQ**: Redis-based for development
- **Custom**: Implement adapter interface

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
- Separate MCP tool permissions

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