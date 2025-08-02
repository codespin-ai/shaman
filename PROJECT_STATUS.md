# PROJECT STATUS

Last Updated: 2025-08-02

## Current State: A2A Protocol Implementation

### Overview

Shaman needs to be updated to fully comply with the A2A (Agent-to-Agent) Protocol v0.3.0 as implemented in the official JavaScript SDK v0.2.5. The current implementation has several deviations that need to be corrected.

### Key Findings from A2A SDK Analysis

After examining the official A2A JavaScript SDK at `/home/jester/repos/public/a2a/a2a-js/`, we discovered:

1. **Single Endpoint Pattern**: 
   - SDK uses `POST /` for ALL JSON-RPC methods (not separate paths like `/message/send`)
   - Methods are routed internally via JSON-RPC `method` field

2. **Message Format**:
   - Message parts use `"kind"` field, NOT `"type"`
   - Message responses must include: `kind: "message"`, `messageId`, `role`, and optional `contextId`/`taskId`

3. **SSE Streaming Format**:
   - Each SSE event must be a complete JSON-RPC response
   - Format: `id: <timestamp>\nevent: message\ndata: {"jsonrpc": "2.0", "id": "req-id", "result": {...}}`
   - NOT simple data objects

4. **Discovery Endpoints**:
   - `GET /.well-known/agent.json` - Returns the AgentCard for this agent
   - `GET /.well-known/a2a/agents` - Returns list of available agents (optional)

5. **Task States**:
   - Use American spelling: `"canceled"` NOT `"cancelled"`

6. **Capabilities**:
   - Field name is `stateTransitionHistory` NOT `stateHistory`

7. **Required Methods**:
   - `message/send`, `message/stream`, `tasks/get`, `tasks/cancel`
   - `tasks/resubscribe`, `tasks/pushNotificationConfig/set`

### Architecture Decision

Maintain the current 3-server architecture:
- **GraphQL Server** (`shaman-gql-server`) - Control plane for management
- **Internal A2A Server** (`shaman-a2a-server --role internal`) - For internal agent-to-agent calls
- **External A2A Server** (`shaman-a2a-server --role external`) - For external API access

**IMPORTANT**: This is an early-stage product. We are free to completely discard and rewrite existing implementations without worrying about migration or backward compatibility.

## Implementation Plan

### Phase 1: New Packages (Week 1)

#### 1. `@codespin/shaman-a2a-protocol`
**Purpose**: Pure A2A protocol types from SDK

**Contents**:
- Copy all types from official SDK's `types.ts`
- No Shaman-specific modifications
- Exports: Message, Task, Part, AgentCard, all event types, etc.

**Key Types**:
```typescript
interface Message {
  kind: "message";
  messageId: string;
  role: "user" | "agent";
  parts: Part[];
  contextId?: string;
  taskId?: string;
}

interface Part {
  kind: "text" | "file" | "data";
  // ... part-specific fields
}

interface Task {
  id: string;
  contextId?: string;
  status: TaskStatus;
  artifacts: Artifact[];
  history: Message[];
  metadata?: Record<string, unknown>;
}
```

#### 2. `@codespin/shaman-jsonrpc`
**Purpose**: Clean JSON-RPC 2.0 implementation

**Features**:
- Request/response parsing and validation
- Method routing
- Error handling with proper codes (-32700 to -32603 for JSON-RPC, -32001 to -32007 for A2A)
- Batch request support
- Middleware system

**Example Usage**:
```typescript
const rpc = createJsonRpcHandler();
rpc.method('message/send', async (params) => { /* ... */ });
rpc.method('tasks/get', async (params) => { /* ... */ });
// Single endpoint handles all methods
app.post('/', rpc.handle);
```

#### 3. `@codespin/shaman-a2a-transport`
**Purpose**: Transport layer abstractions

**Features**:
- Transport interface
- JSON-RPC transport (primary)
- HTTP+JSON REST transport (maps to JSON-RPC)
- SSE streaming support with proper event format

**Transports**:
1. **JSON-RPC**: Default, single POST endpoint
2. **REST**: Maps URLs like `/v1/message:send` to JSON-RPC methods
3. **SSE**: For streaming responses, each event is JSON-RPC response

### Phase 2: Rewrites (Week 2)

#### 1. `@codespin/shaman-a2a-server` (Complete Rewrite)
**Delete existing implementation entirely**

**New Structure**:
```
src/
├── server.ts           # Express app setup
├── routes/
│   ├── jsonrpc.ts     # POST / handler
│   └── discovery.ts   # GET /.well-known/* handlers
├── methods/           # JSON-RPC method implementations
│   ├── message-send.ts
│   ├── message-stream.ts
│   ├── tasks-get.ts
│   └── ...
├── transports/        # Transport implementations
└── middleware/        # Auth, logging, etc.
```

**Key Features**:
- Single `POST /` endpoint for all JSON-RPC
- Discovery endpoints at well-known URIs
- Proper SSE streaming
- Role-based filtering (internal vs external)
- Transform GitAgent → AgentCard

#### 2. `@codespin/shaman-a2a-client` (Complete Rewrite)
**Delete existing implementation entirely**

**New Features**:
- Match SDK client structure exactly
- SSE client support
- Proper error handling
- Transport negotiation
- AgentCard fetching

### Phase 3: Updates (Week 3)

#### 1. `@codespin/shaman-agent-executor`
**Changes**:
- Update message format (use `kind` not `type`)
- Generate proper `messageId`
- Include all required fields in responses
- Transform between domain types and protocol types at boundaries

#### 2. `@codespin/shaman-workflow`
**Changes**:
- Update task states (`canceled` not `cancelled`)
- Generate proper A2A events for SSE
- Keep internal WorkflowRun model, transform to Task at API boundary

#### 3. `@codespin/shaman-types`
**Changes**:
- Remove any A2A-specific types
- Keep focused on Shaman domain (Organization, GitAgent, WorkflowRun, etc.)
- Let A2A packages handle protocol concerns

### Phase 4: Integration (Week 4)

1. Update `build.sh` with new package order
2. End-to-end testing
3. Remove old code
4. Update documentation

## Package Decisions

### Packages to KEEP (17)
- `shaman-types` - Core domain types
- `shaman-logger` - Logging utility
- `shaman-core` - Core utilities (Result type, etc.)
- `shaman-config` - Configuration management
- `shaman-llm-core` - LLM abstraction
- `shaman-db` - Database with RLS
- `shaman-observability` - Metrics/tracing
- `shaman-security` - Auth/RBAC (Permiso/Kratos)
- `shaman-external-registry` - External agents
- `shaman-git-resolver` - Git agent discovery
- `shaman-agents` - Unified agent resolution
- `shaman-llm-vercel` - Vercel AI SDK
- `shaman-tool-router` - Tool execution
- `shaman-agent-executor` - Execution engine (needs updates)
- `shaman-workflow` - BullMQ workflows (needs updates)
- `shaman-gql-server` - GraphQL control plane
- `shaman-worker` - Job processor
- `shaman-cli` - CLI tool

### Packages to DISCARD (2)
- `shaman-a2a-server` - Complete rewrite needed
- `shaman-a2a-client` - Complete rewrite needed

### Packages to CREATE (4)
- `shaman-a2a-protocol` - Protocol types
- `shaman-jsonrpc` - JSON-RPC implementation
- `shaman-a2a-transport` - Transport abstractions
- `shaman-a2a-discovery` - Discovery endpoints

## Key Technical Decisions

### 1. Separation of Concerns
- **Domain Model** (shaman-types): Shaman's internal representation
- **Protocol Model** (shaman-a2a-protocol): A2A wire format
- Transformation happens at API boundaries only

### 2. Single Endpoint Architecture
```
POST /a2a/v1/  → JSON-RPC router → method handlers
               ↓
         { "method": "message/send", "params": {...} }
               ↓
         Route to appropriate handler
```

### 3. SSE Streaming Format
```
id: 1704067200000
event: message
data: {"jsonrpc": "2.0", "id": "req-001", "result": {"kind": "task", ...}}

id: 1704067201000
event: message
data: {"jsonrpc": "2.0", "id": "req-001", "result": {"kind": "status-update", ...}}
```

### 4. Discovery Pattern
- `/.well-known/agent.json` → Single agent's AgentCard
- `/.well-known/a2a/agents` → List of all agents
- Filter based on server role (internal shows all, external shows only exposed)

## Configuration Changes Needed

```typescript
{
  a2a: {
    basePath: '/a2a/v1',  // Remove, always use /
    transports: ['jsonrpc', 'rest'],
    streaming: {
      enabled: true,
      timeout: 300000
    },
    discovery: {
      enabled: true,
      primaryAgent: 'CustomerSupport'  // For /.well-known/agent.json
    }
  }
}
```

## Next Steps

1. Start with creating `@codespin/shaman-a2a-protocol` package
2. Copy types directly from SDK
3. Build `@codespin/shaman-jsonrpc` package
4. Begin server rewrites

## Important Notes

- NO MIGRATION NEEDED - This is early stage, we can break everything
- Focus on exact SDK compliance, not preserving existing behavior
- Use SDK as the source of truth for all protocol decisions
- Keep domain and protocol models separate
- Transform at boundaries only

## References

- Official A2A SDK: `/home/jester/repos/public/a2a/a2a-js/`
- A2A Spec Docs: `/home/jester/repos/codespin-ai/shaman/docs/external-specs/a2a/`
- Key SDK Files:
  - `src/types.ts` - All protocol types
  - `src/server/a2a_express_app.ts` - Server implementation
  - `src/client/client.ts` - Client implementation

## Previous Project Status (Before A2A Update)

### Completed Core Packages
1. **shaman-types** - Type definitions for entire system
2. **shaman-logger** - Centralized logging with context
3. **shaman-core** - Core utilities and base types
4. **shaman-config** - Configuration loading and validation
5. **shaman-llm-core** - LLM provider interface
6. **shaman-db** - Database connection management only
7. **shaman-observability** - OpenTelemetry integration
8. **shaman-llm-vercel** - Vercel AI SDK implementation
9. **shaman-workflow** - Workflow engine using BullMQ

### Completed Agent Infrastructure
10. **shaman-git-resolver** - Git-based agent discovery with caching
11. **shaman-external-registry** - External agent registry support
12. **shaman-agents** - Unified agent resolution
13. **shaman-a2a-client** - A2A protocol HTTP client (needs rewrite)
14. **shaman-tool-router** - Tool execution routing
15. **shaman-agent-executor** - Agent execution engine

### Server Architecture
16. **shaman-gql-server** - GraphQL management API
17. **shaman-a2a-server** - A2A execution server (needs rewrite)

### Partially Implemented
18. **shaman-security** - Has structure but needs JWT implementation
19. **shaman-worker** - Has bootstrap but needs job processing
20. **shaman-cli** - Has command structure but needs implementations