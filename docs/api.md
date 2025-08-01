# API Reference

## A2A API (Agent Execution)

Base URL: `https://{subdomain}.shaman.ai/a2a/v1`

### Send Message

Execute an agent with a message.

```http
POST /message/send
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "@AgentName Your message here"
      }]
    },
    "configuration": {
      "blocking": false  // Don't wait for completion
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "kind": "task",
    "id": "run_abc123",
    "contextId": "ctx_abc123",
    "status": {
      "state": "submitted",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Get Task Status

Check the status of a running task.

```http
POST /tasks/get
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-002",
  "method": "tasks/get",
  "params": {
    "id": "run_abc123"
  }
}
```

### Discover Agents

List available agents.

```http
GET /agents
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "agents": [
    {
      "name": "CustomerSupport",
      "description": "Handles customer inquiries",
      "version": "1.0.0",
      "url": "https://acme.shaman.ai/a2a/v1"
    }
  ],
  "totalCount": 1
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

### A2A Errors

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "details": "Agent not found"
    }
  }
}
```

Common error codes:
- `-32600` - Invalid request
- `-32602` - Invalid params
- `-32603` - Internal error
- `-32001` - Task not found

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