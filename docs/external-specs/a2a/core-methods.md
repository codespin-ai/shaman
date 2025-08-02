# Core A2A Methods

This document describes the core methods that MUST be implemented by all A2A-compliant agents.

## Required Methods

### 1. message/send

Sends a message to an agent to initiate or continue an interaction.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Process order #12345"
        }
      ],
      "messageId": "msg-123",      // Client-generated unique ID
      "contextId": "ctx-456",      // Optional: Continue existing context
      "taskId": "task-789"         // Optional: Continue specific task
    },
    "configuration": {
      "blocking": true,            // Wait for completion
      "pushNotificationConfig": {  // Optional: Webhook config
        "url": "https://client.com/webhook",
        "token": "secret-token"
      }
    },
    "metadata": {}                 // Optional: Custom metadata
  }
}
```

**Response (Task):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "id": "task-789",
    "contextId": "ctx-456",
    "status": {
      "state": "working",
      "timestamp": "2024-01-20T10:30:00Z"
    },
    "artifacts": [],
    "history": [...],
    "kind": "task"
  }
}
```

**Response (Message - for simple responses):**
```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "role": "agent",
    "parts": [
      {
        "kind": "text",
        "text": "Order #12345 has been processed successfully"
      }
    ],
    "kind": "message",
    "messageId": "msg-agent-456",
    "role": "agent",
    "contextId": "ctx-456",
    "taskId": "task-789"
  }
}
```

### 2. tasks/get

Retrieves the current state of a task.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "method": "tasks/get",
  "params": {
    "id": "task-789",
    "historyLength": 10    // Optional: Limit history
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "result": {
    "id": "task-789",
    "contextId": "ctx-456",
    "status": {
      "state": "completed",
      "timestamp": "2024-01-20T10:35:00Z"
    },
    "artifacts": [
      {
        "artifactId": "artifact-001",
        "name": "order_confirmation.json",
        "parts": [
          {
            "kind": "data",
            "data": {
              "orderId": "12345",
              "status": "confirmed",
              "total": 299.99
            }
          }
        ]
      }
    ],
    "history": [...],
    "metadata": {}
  }
}
```

### 3. tasks/cancel

Requests cancellation of an ongoing task.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "method": "tasks/cancel",
  "params": {
    "id": "task-789"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "id": "task-789",
    "contextId": "ctx-456",
    "status": {
      "state": "cancelled",
      "timestamp": "2024-01-20T10:32:00Z"
    },
    "artifacts": [],
    "history": [...],
    "metadata": {}
  }
}
```

## Optional Methods

### 4. message/stream

Sends a message and subscribes to real-time updates via Server-Sent Events.
Requires `capabilities.streaming: true` in AgentCard.

**Request:** Same as `message/send`

**Response:** HTTP 200 with `Content-Type: text/event-stream`

Each SSE event has:
- `event: message` (optional, defaults to "message")
- `data: <json>` containing the JSON-RPC response
- `id: <timestamp>` (optional event ID)

```
id: 1704067200000
event: message
data: {"jsonrpc": "2.0", "id": "req-004", "result": {"kind": "task", "id": "task-789", "contextId": "ctx-456", "status": {"state": "submitted", "timestamp": "2024-01-20T10:30:00Z"}, "history": [], "artifacts": []}}

id: 1704067201000
event: message
data: {"jsonrpc": "2.0", "id": "req-004", "result": {"kind": "status-update", "taskId": "task-789", "contextId": "ctx-456", "status": {"state": "working", "message": {"kind": "message", "role": "agent", "messageId": "msg-001", "parts": [{"kind": "text", "text": "Processing your request..."}], "taskId": "task-789", "contextId": "ctx-456"}, "timestamp": "2024-01-20T10:30:01Z"}, "final": false}}

id: 1704067202000
event: message
data: {"jsonrpc": "2.0", "id": "req-004", "result": {"kind": "artifact-update", "taskId": "task-789", "contextId": "ctx-456", "artifact": {"artifactId": "a-001", "name": "result.txt", "parts": [{"kind": "text", "text": "Processing..."}]}, "append": false, "lastChunk": true}}

id: 1704067203000
event: message
data: {"jsonrpc": "2.0", "id": "req-004", "result": {"kind": "status-update", "taskId": "task-789", "contextId": "ctx-456", "status": {"state": "completed", "timestamp": "2024-01-20T10:30:03Z"}, "final": true}}

event: error
data: {"jsonrpc": "2.0", "id": "req-004", "error": {"code": -32603, "message": "Internal error", "data": {"details": "Stream terminated unexpectedly"}}}
```

### 5. tasks/resubscribe

Reconnects to streaming updates for an existing task.
Requires `capabilities.streaming: true`.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-005",
  "method": "tasks/resubscribe",
  "params": {
    "id": "task-789"
  }
}
```

**Response:** Same SSE format as `message/stream`

### 6. tasks/pushNotificationConfig/set

Configures webhook for asynchronous task updates.
Requires `capabilities.pushNotifications: true`.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-006",
  "method": "tasks/pushNotificationConfig/set",
  "params": {
    "taskId": "task-789",
    "pushNotificationConfig": {
      "url": "https://client.com/webhook",
      "headers": {
        "Authorization": "Bearer webhook-secret",
        "X-Custom-Header": "value"
      }
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-006",
  "result": {
    "success": true
  }
}
```

### 7. agent/authenticatedExtendedCard

Returns an extended AgentCard for authenticated users.
Requires `supportsAuthenticatedExtendedCard: true`.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-007",
  "method": "agent/authenticatedExtendedCard"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "req-007",
  "result": {
    // Full AgentCard with additional skills/details
  }
}
```

## Method Naming Across Transports

| JSON-RPC | gRPC | REST |
|----------|------|------|
| `message/send` | `SendMessage` | `POST /v1/message:send` |
| `message/stream` | `SendStreamingMessage` | `POST /v1/message:stream` |
| `tasks/get` | `GetTask` | `GET /v1/tasks/{id}` |
| `tasks/cancel` | `CancelTask` | `POST /v1/tasks/{id}:cancel` |
| `tasks/resubscribe` | `TaskSubscription` | `POST /v1/tasks/{id}:subscribe` |

## Event Types in Streaming

When using `message/stream` or `tasks/resubscribe`, the following event types can be returned:

### Task Event
Initial task creation or full task state:
```json
{
  "kind": "task",
  "id": "task-789",
  "contextId": "ctx-456",
  "status": { "state": "submitted", "timestamp": "..." },
  "history": [...],
  "artifacts": [...]
}
```

### Status Update Event
Task status changes:
```json
{
  "kind": "status-update",
  "taskId": "task-789",
  "contextId": "ctx-456",
  "status": {
    "state": "working",
    "message": { /* Optional message object */ },
    "timestamp": "..."
  },
  "final": false  // true when this is the last update
}
```

### Artifact Update Event
New or updated artifacts:
```json
{
  "kind": "artifact-update",
  "taskId": "task-789",
  "contextId": "ctx-456",
  "artifact": {
    "artifactId": "art-001",
    "name": "result.txt",
    "parts": [
      { "kind": "text", "text": "Content..." }
    ]
  },
  "append": false,    // Whether to append to existing artifact
  "lastChunk": true   // Whether this is the final chunk
}
```

### Direct Message Event
For simple responses without task creation:
```json
{
  "kind": "message",
  "messageId": "msg-456",
  "role": "agent",
  "parts": [...],
  "contextId": "ctx-456"
}
```

## Implementation Notes

1. **Authentication**: Handled at HTTP transport layer, not in JSON-RPC payload
2. **Content-Type**: Must be `application/json` for JSON-RPC requests
3. **Streaming Content-Type**: Must be `text/event-stream` for SSE responses
4. **Error Handling**: Use standard A2A error codes
5. **Metadata**: All methods support optional metadata fields
6. **Message Parts**: Always use `"kind"` not `"type"` for part types
7. **State Names**: Use lowercase (e.g., "canceled" not "cancelled")
8. **Required Fields**: All result objects must include `"kind"` field