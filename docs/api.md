# API Reference

## A2A API (Agent Execution)

Shaman implements the A2A Protocol v0.3.0 for agent-to-agent communication.

Base URL: `https://{subdomain}.shaman.ai/a2a/v1`

### Core Methods

All A2A methods use JSON-RPC 2.0 format via HTTP POST.

#### message/send

Send a message to an agent to initiate or continue an interaction.

```http
POST /a2a/v1
Content-Type: application/json
Authorization: Bearer {api_key}

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
        "text": "I need help with my order #12345"
      }]
    },
    "taskId": "task_abc123",  // Optional: Continue existing task
    "contextId": "ctx_xyz789"  // Optional: Group related tasks
  }
}
```

**Response (New Task):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "taskId": "task_abc123",
    "contextId": "ctx_xyz789",
    "status": {
      "state": "submitted",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Response (Completed Immediately):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "taskId": "task_abc123",
    "contextId": "ctx_xyz789",
    "status": {
      "state": "completed",
      "timestamp": "2024-01-01T00:00:10Z"
    },
    "artifacts": [{
      "kind": "text",
      "name": "response",
      "mimeType": "text/plain",
      "data": "I can help you with order #12345. Let me look that up for you."
    }]
  }
}
```

**Response (Direct Message - for simple responses):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "kind": "message",
    "messageId": "msg-agent-456",
    "role": "agent",
    "parts": [{
      "kind": "text",
      "text": "I can help you with order #12345. Let me look that up for you."
    }],
    "contextId": "ctx_xyz789",
    "taskId": "task_abc123"
  }
}
```

#### tasks/get

Retrieve the current state of one or more tasks.

```http
POST /a2a/v1
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-002",
  "method": "tasks/get",
  "params": {
    "ids": ["task_abc123", "task_def456"]
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "result": {
    "tasks": [{
      "id": "task_abc123",
      "contextId": "ctx_xyz789",
      "status": {
        "state": "completed",
        "timestamp": "2024-01-01T00:00:30Z"
      },
      "artifacts": [{
        "kind": "text",
        "name": "response",
        "mimeType": "text/plain",
        "data": "Order #12345 has been shipped and will arrive tomorrow."
      }],
      "history": [
        {
          "timestamp": "2024-01-01T00:00:00Z",
          "type": "message",
          "message": {
            "role": "user",
            "parts": [{"kind": "text", "text": "I need help with my order #12345"}]
          }
        },
        {
          "timestamp": "2024-01-01T00:00:10Z",
          "type": "message",
          "message": {
            "role": "assistant",
            "parts": [{"kind": "text", "text": "I can help you with order #12345. Let me look that up for you."}]
          }
        },
        {
          "timestamp": "2024-01-01T00:00:30Z",
          "type": "artifact",
          "artifact": {
            "kind": "text",
            "name": "response",
            "mimeType": "text/plain"
          }
        },
        {
          "timestamp": "2024-01-01T00:00:30Z",
          "type": "status",
          "status": {"state": "completed"}
        }
      ]
    }]
  }
}
```

#### tasks/cancel

Cancel one or more ongoing tasks.

```http
POST /a2a/v1
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-003",
  "method": "tasks/cancel",
  "params": {
    "ids": ["task_abc123"]
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "canceled": ["task_abc123"],
    "notCancelable": []
  }
}
```

### Optional Methods

#### message/stream

Stream real-time updates for a task using Server-Sent Events.

```http
POST /a2a/v1
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-004",
  "method": "message/stream",
  "params": {
    "agentName": "CustomerSupport",
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Stream my order status updates"}]
    }
  }
}
```

**SSE Response:**
```
id: 1704067200000
event: message
data: {"jsonrpc": "2.0", "id": "req-003", "result": {"kind": "task", "id": "task_abc123", "contextId": "ctx_xyz789", "status": {"state": "submitted", "timestamp": "2024-01-01T00:00:00Z"}, "history": [], "artifacts": []}}

id: 1704067201000
event: message
data: {"jsonrpc": "2.0", "id": "req-003", "result": {"kind": "status-update", "taskId": "task_abc123", "contextId": "ctx_xyz789", "status": {"state": "working", "message": {"kind": "message", "role": "agent", "messageId": "msg-001", "parts": [{"kind": "text", "text": "Checking your order status..."}], "taskId": "task_abc123", "contextId": "ctx_xyz789"}, "timestamp": "2024-01-01T00:00:01Z"}, "final": false}}

id: 1704067202000
event: message
data: {"jsonrpc": "2.0", "id": "req-003", "result": {"kind": "artifact-update", "taskId": "task_abc123", "contextId": "ctx_xyz789", "artifact": {"artifactId": "art-001", "name": "status.txt", "parts": [{"kind": "text", "text": "Order shipped"}]}, "append": false, "lastChunk": true}}

id: 1704067203000
event: message
data: {"jsonrpc": "2.0", "id": "req-003", "result": {"kind": "status-update", "taskId": "task_abc123", "contextId": "ctx_xyz789", "status": {"state": "completed", "timestamp": "2024-01-01T00:00:30Z"}, "final": true}}
```

#### tasks/pushNotificationConfig/set

Configure webhooks for task updates.

```http
POST /a2a/v1
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-005",
  "method": "tasks/pushNotificationConfig/set",
  "params": {
    "taskId": "task_abc123",
    "pushNotificationConfig": {
      "url": "https://myapp.com/webhooks/a2a",
      "headers": {
        "X-Webhook-Secret": "my-secret-token"
      }
    }
  }
}
```

### Agent Discovery

#### Single Agent Discovery

Get the AgentCard for this A2A server's primary agent.

```http
GET /.well-known/agent.json
```

**Response:**
Returns the AgentCard for the primary agent at this endpoint.

#### Agent List Discovery

Discover all available agents via the well-known URI.

```http
GET /.well-known/a2a/agents
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "protocolVersion": "0.3.0",
  "agents": [
    {
      "name": "CustomerSupport",
      "description": "Handles customer inquiries and support requests",
      "version": "1.0.0",
      "url": "https://acme.shaman.ai/a2a/v1",
      "preferredTransport": "JSONRPC",
      "capabilities": {
        "streaming": true,
        "pushNotifications": true,
        "stateTransitionHistory": true
      },
      "skills": [
        {
          "name": "order-tracking",
          "description": "Track order status and shipping information",
          "examples": ["Where is my order?", "Track order #12345"]
        }
      ],
      "securitySchemes": {
        "bearer": {
          "type": "http",
          "scheme": "bearer",
          "description": "API key authentication"
        }
      }
    }
  ]
}
```

#### Individual AgentCard

Get detailed information about a specific agent.

```http
GET /a2a/v1/agents/{agentName}
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "protocolVersion": "0.3.0",
  "name": "CustomerSupport",
  "description": "Handles customer inquiries and support requests",
  "version": "1.0.0",
  "url": "https://acme.shaman.ai/a2a/v1",
  "preferredTransport": "JSONRPC",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateHistory": true
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "orderId": {"type": "string", "pattern": "^[A-Z0-9-]+$"},
      "customerEmail": {"type": "string", "format": "email"}
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "status": {"type": "string"},
      "message": {"type": "string"}
    }
  }
}
```

## GraphQL API (Management)

Base URL: `https://{subdomain}.shaman.ai/graphql`

### Authentication

Use session cookies (via Ory Kratos) or API keys.

```http
POST /graphql
Authorization: Bearer {api_key}
# OR
Cookie: ory_kratos_session={session}
```

### Queries

**Get Run**
```graphql
query GetRun($id: ID!) {
  getRun(id: $id) {
    id
    status
    initialInput
    finalOutput
    startTime
    endTime
    steps {
      id
      stepType
      name
      status
      duration
      input
      output
      error
    }
  }
}
```

**List Runs**
```graphql
query ListRuns($status: String, $limit: Int) {
  listRuns(status: $status, limit: $limit) {
    items {
      id
      status
      createdAt
      createdBy
    }
    totalCount
  }
}
```

**Get Agent Repositories**
```graphql
query GetRepositories {
  getAgentRepositories {
    id
    name
    gitUrl
    branch
    lastSyncAt
    lastSyncStatus
    agents {
      name
      description
      exposed
    }
  }
}
```

### Mutations

**Add Agent Repository**
```graphql
mutation AddRepository($input: AddAgentRepositoryInput!) {
  addAgentRepository(input: $input) {
    id
    name
    gitUrl
  }
}

# Variables:
{
  "input": {
    "name": "my-agents",
    "gitUrl": "https://github.com/org/agents.git",
    "branch": "main"
  }
}
```

**Sync Repository**
```graphql
mutation SyncRepository($id: ID!) {
  syncAgentRepository(id: $id) {
    success
    message
    syncedCount
  }
}
```

**Create API Key**
```graphql
mutation CreateAPIKey($input: CreateAPIKeyInput!) {
  createAPIKey(input: $input) {
    id
    key  # Only shown once!
    name
    expiresAt
  }
}
```

**Set Git Credentials**
```graphql
mutation SetGitCreds($repoId: ID!, $token: String!) {
  setGitCredentials(
    repositoryId: $repoId, 
    token: $token
  ) {
    success
  }
}
```

## Webhooks

For async tool completion.

### Webhook Callback

```http
POST /webhooks/{webhook_id}
Content-Type: application/json
X-Webhook-Secret: {configured_secret}

{
  "success": true,
  "output": {
    "result": "Payment processed",
    "transactionId": "txn_123"
  }
}
```

**Response:**
```json
{
  "accepted": true
}
```

## Error Responses

### A2A Error Codes

A2A uses standard JSON-RPC 2.0 error codes plus protocol-specific codes:

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32001,
    "message": "Task not found",
    "data": {
      "taskId": "task_invalid123",
      "suggestion": "Verify the task ID or check if it has expired"
    }
  }
}
```

**Standard JSON-RPC Errors:**
- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

**A2A-Specific Errors:**
- `-32001` - TaskNotFoundError
- `-32002` - TaskNotCancelableError
- `-32003` - PushNotificationNotSupportedError
- `-32004` - UnsupportedOperationError
- `-32005` - ContentTypeNotSupportedError
- `-32006` - InvalidAgentResponseError
- `-32007` - AuthenticatedExtendedCardNotConfiguredError

### Task State Errors

When a task is in an unexpected state:

```json
{
  "jsonrpc": "2.0",
  "id": "req-cancel",
  "error": {
    "code": -32002,
    "message": "Task not cancelable",
    "data": {
      "taskId": "task_abc123",
      "currentState": "completed",
      "reason": "Task has already reached terminal state"
    }
  }
}
```

### GraphQL Errors

```json
{
  "errors": [
    {
      "message": "Not authorized",
      "extensions": {
        "code": "UNAUTHORIZED"
      }
    }
  ]
}
```

## Rate Limits

Default limits:
- 100 requests/minute per API key
- 1000 requests/hour per organization

Headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

## Authentication

### API Keys

Create via GraphQL, use in Authorization header:
```
Authorization: Bearer sk_live_abcdef123456
```

### Session Auth

For web applications using Ory Kratos:
1. Redirect to `/auth/login`
2. Receive session cookie
3. Include cookie in requests

### Internal JWT

Used between internal services (not for external use):
```
Authorization: Bearer eyJhbGc...
```

## Pagination

### GraphQL
```graphql
query ListRuns($cursor: String, $limit: Int) {
  listRuns(cursor: $cursor, limit: $limit) {
    items { ... }
    nextCursor
    hasMore
  }
}
```

### REST (A2A)
```
GET /agents?limit=20&offset=40
```

## Filtering

### Run Status
```graphql
listRuns(status: "completed", createdAfter: "2024-01-01")
```

### Agent Source
```graphql
getAgents(source: "git", exposed: true)
```

## Postman Collection

Import `postman-collection.json` from the repo for examples of all endpoints.