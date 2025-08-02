# Transport Protocols

A2A supports multiple transport protocols for agent communication. Agents MUST implement at least one transport protocol to be A2A-compliant.

## Supported Transports

### 1. JSON-RPC 2.0 (Default)

The primary and most common transport protocol.

**Characteristics:**
- Uses HTTP POST requests to a single endpoint
- Content-Type: `application/json`
- Follows JSON-RPC 2.0 specification
- Single endpoint handles all methods via JSON-RPC routing

**Endpoint Pattern:**
- All requests go to: `POST /` (at the configured base URL)
- Example: If base URL is `/a2a/v1`, then endpoint is `POST /a2a/v1/`

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "message/send",
  "params": {
    // Method-specific parameters
  }
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    // Method-specific result
  }
}
```

**Error Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32001,
    "message": "Task not found",
    "data": {
      // Optional error details
    }
  }
}
```

### 2. gRPC

High-performance binary protocol using Protocol Buffers.

**Characteristics:**
- Uses HTTP/2
- Binary serialization with Protocol Buffers v3
- Supports bidirectional streaming
- Defined in `a2a.proto` specification

**Service Definition:**
```proto
service A2AService {
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
  rpc SendStreamingMessage(SendMessageRequest) returns (stream StreamResponse);
  rpc GetTask(GetTaskRequest) returns (Task);
  rpc CancelTask(CancelTaskRequest) returns (Task);
  // ... other methods
}
```

### 3. HTTP+JSON (REST)

RESTful API following standard HTTP conventions.

**Characteristics:**
- Uses appropriate HTTP verbs (GET, POST, PUT, DELETE)
- Resource-based URLs
- Content-Type: `application/json`
- HTTP status codes for errors

**URL Patterns:**
- `POST /v1/message:send` - Send message
- `POST /v1/message:stream` - Stream message
- `GET /v1/tasks/{id}` - Get task
- `POST /v1/tasks/{id}:cancel` - Cancel task
- `GET /v1/card` - Get agent card

**Request Example:**
```http
POST /v1/message:send HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": {
    "role": "user",
    "parts": [{"kind": "text", "text": "Hello"}]
  }
}
```

## Transport Declaration

Agents declare supported transports in their AgentCard:

```json
{
  "url": "https://api.example.com/a2a/v1",
  "preferredTransport": "JSONRPC",    // Transport at main URL
  "additionalInterfaces": [
    {
      "url": "https://api.example.com/a2a/v1",
      "transport": "JSONRPC"
    },
    {
      "url": "https://grpc.example.com/a2a",
      "transport": "GRPC"
    },
    {
      "url": "https://rest.example.com/v1",
      "transport": "HTTP+JSON"
    }
  ]
}
```

## Streaming Support

### Server-Sent Events (SSE)

Used by JSON-RPC and REST transports for streaming responses.

**Characteristics:**
- Content-Type: `text/event-stream`
- Each event contains a complete response object
- Connection closes after final event

**SSE Format:**
```
data: {"jsonrpc": "2.0", "id": "req-1", "result": {"kind": "task", "id": "task-123", "status": {"state": "submitted"}}}

data: {"jsonrpc": "2.0", "id": "req-1", "result": {"kind": "status-update", "taskId": "task-123", "status": {"state": "working"}}}

data: {"jsonrpc": "2.0", "id": "req-1", "result": {"kind": "artifact-update", "taskId": "task-123", "artifact": {...}, "append": true}}

data: {"jsonrpc": "2.0", "id": "req-1", "result": {"kind": "status-update", "taskId": "task-123", "status": {"state": "completed"}, "final": true}}
```

### gRPC Server Streaming

Uses native gRPC server streaming:

```proto
rpc SendStreamingMessage(SendMessageRequest) returns (stream StreamResponse);
```

## Transport Selection

### Client Rules

1. Check agent's `preferredTransport` and main `url`
2. Use preferred transport if supported by client
3. Fall back to alternative transports from `additionalInterfaces`
4. Implement retry logic with different transports on failure

### Discovery Endpoints

All transports should provide agent discovery:

**JSON-RPC/HTTP Discovery:**
- `GET /.well-known/agent.json` - Returns the AgentCard for this agent
- `GET /.well-known/a2a/agents` - Returns list of available agents (optional)

Note: Discovery endpoints are always HTTP GET, regardless of the main transport.

### Implementation Requirements

When supporting multiple transports, agents MUST:

1. **Provide identical functionality** across all transports
2. **Return equivalent results** for same requests
3. **Use consistent error codes** mapped appropriately
4. **Support same authentication** schemes
5. **Expose discovery endpoints** via HTTP GET

## Authentication

Authentication is handled at the HTTP transport layer:

### Common Schemes

**Bearer Token:**
```http
Authorization: Bearer <token>
```

**API Key:**
```http
X-API-Key: <api-key>
```

**Basic Auth:**
```http
Authorization: Basic <base64-credentials>
```

### Declaration in AgentCard

```json
{
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    },
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key"
    }
  },
  "security": [
    {"bearer": []},    // Option 1
    {"apiKey": []}     // Option 2
  ]
}
```

## Error Mapping

Different transports map A2A errors differently:

| A2A Error | JSON-RPC Code | gRPC Status | HTTP Status |
|-----------|---------------|-------------|-------------|
| TaskNotFound | -32001 | NOT_FOUND | 404 |
| InvalidParams | -32602 | INVALID_ARGUMENT | 400 |
| InternalError | -32603 | INTERNAL | 500 |
| Unauthorized | N/A | UNAUTHENTICATED | 401 |
| Forbidden | N/A | PERMISSION_DENIED | 403 |

## Best Practices

1. **Default to JSON-RPC**: Most widely supported
2. **Use gRPC for Performance**: When binary efficiency matters
3. **Use REST for Simplicity**: When integrating with web clients
4. **Support Multiple Transports**: Increases interoperability
5. **Test All Transports**: Ensure functional equivalence