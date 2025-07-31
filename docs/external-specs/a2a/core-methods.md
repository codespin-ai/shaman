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
    "messageId": "msg-agent-456",
    "contextId": "ctx-456",
    "kind": "message"
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

```
data: {"jsonrpc": "2.0", "id": "req-004", "result": {"id": "task-789", "status": {"state": "submitted"}, "kind": "task"}}

data: {"jsonrpc": "2.0", "id": "req-004", "result": {"taskId": "task-789", "status": {"state": "working"}, "kind": "status-update"}}

data: {"jsonrpc": "2.0", "id": "req-004", "result": {"taskId": "task-789", "artifact": {"artifactId": "a-001", "parts": [{"kind": "text", "text": "Processing..."}]}, "append": false, "kind": "artifact-update"}}

data: {"jsonrpc": "2.0", "id": "req-004", "result": {"taskId": "task-789", "status": {"state": "completed"}, "final": true, "kind": "status-update"}}
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
    "config": {
      "url": "https://client.com/webhook",
      "token": "webhook-secret",
      "authentication": {
        "schemes": ["Bearer"]
      }
    }
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

## Implementation Notes

1. **Authentication**: Handled at HTTP transport layer, not in JSON-RPC payload
2. **Content-Type**: Must be `application/json` for JSON-RPC
3. **Error Handling**: Use standard A2A error codes
4. **Metadata**: All methods support optional metadata fields