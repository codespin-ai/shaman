# MCP Core Protocol

The Model Context Protocol uses JSON-RPC 2.0 as its base communication format, providing a stateful session protocol for context exchange between clients and servers.

## Protocol Basics

### Message Format

All MCP messages follow JSON-RPC 2.0 format:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    // Method-specific result
  }
}
```

**Notification:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
```

**Error:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {}
  }
}
```

## Session Lifecycle

### 1. Initialization

The session begins with capability negotiation:

**Client → Server:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "draft",
    "capabilities": {
      "sampling": {},
      "roots": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "Shaman Agent",
      "version": "1.0.0"
    }
  }
}
```

**Server → Client:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "draft",
    "capabilities": {
      "tools": {
        "listChanged": true
      },
      "resources": {
        "subscribe": true
      }
    },
    "serverInfo": {
      "name": "Database MCP Server",
      "version": "2.0.0"
    }
  }
}
```

### 2. Initialized Notification

After initialization, the client sends:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

### 3. Active Session

During the session, clients and servers exchange:
- Requests/responses
- Notifications
- Progress updates
- Cancellations

### 4. Shutdown

To end a session cleanly:

**Client → Server:**
```json
{
  "jsonrpc": "2.0",
  "id": 999,
  "method": "shutdown"
}
```

The server should clean up resources and respond with `null`.

## Request Types

### Client-Initiated Requests

Methods that clients can call on servers:

- `initialize` - Start session
- `shutdown` - End session
- `tools/list` - List available tools
- `tools/call` - Invoke a tool
- `resources/list` - List available resources
- `resources/read` - Read a resource
- `resources/subscribe` - Subscribe to resource updates
- `resources/unsubscribe` - Unsubscribe from updates
- `prompts/list` - List available prompts
- `prompts/get` - Get a specific prompt
- `completion/complete` - Request completions

### Server-Initiated Requests

Methods that servers can call on clients (if capabilities allow):

- `sampling/createMessage` - Request LLM sampling
- `roots/list` - List available roots
- `elicitation/createDialog` - Request user input

## Notifications

Either party can send notifications (no response expected):

### Server Notifications

- `notifications/tools/list_changed` - Tools list updated
- `notifications/resources/list_changed` - Resources list updated
- `notifications/resources/updated` - Specific resource updated
- `notifications/prompts/list_changed` - Prompts list updated

### Client Notifications

- `notifications/initialized` - Initialization complete
- `notifications/cancelled` - Request cancelled
- `notifications/progress` - Progress update
- `notifications/roots/list_changed` - Roots list updated
- `notifications/elicitation/dialog_opened` - Dialog opened
- `notifications/elicitation/dialog_closed` - Dialog closed

## Error Handling

MCP uses standard JSON-RPC error codes plus custom codes:

### Standard Codes

- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

### Custom MCP Codes

- `-32000` - Request cancelled
- `-32001` - Invalid request (duplicate ID)
- `-32002` - Resource not found
- `-32003` - Tool not found
- `-32004` - Prompt not found

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "failed-request-id",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "location",
      "error": "Required parameter missing"
    }
  }
}
```

## Progress Tracking

Long-running operations support progress notifications:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "requestId": "operation-123",
    "progress": {
      "current": 50,
      "total": 100,
      "message": "Processing records..."
    }
  }
}
```

## Cancellation

Clients can cancel in-flight requests:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": "request-to-cancel"
  }
}
```

Servers should:
1. Stop processing the request
2. Clean up resources
3. Return error code `-32000`

## Message Ordering

- Requests can be sent in parallel
- Responses may arrive out of order
- Use unique IDs to correlate requests/responses
- Notifications have no ordering guarantees

## Best Practices

### 1. ID Generation

Use unique, meaningful IDs:
```typescript
const id = `${methodName}-${timestamp}-${randomId}`;
```

### 2. Timeout Handling

Implement reasonable timeouts:
- Initialization: 30 seconds
- Tool calls: Configurable (default 60s)
- Resource reads: 30 seconds

### 3. Error Recovery

- Retry transient errors with backoff
- Don't retry client errors (4xx equivalent)
- Clean up on permanent failures

### 4. Capability Checking

Always check capabilities before using features:
```typescript
if (server.capabilities.tools?.listChanged) {
  // Can expect list_changed notifications
}
```

## Implementation Example

```typescript
class MCPClient {
  private requestId = 0;
  private pendingRequests = new Map();

  async request(method: string, params?: any): Promise<any> {
    const id = this.requestId++;
    
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.transport.send(message);
      
      // Timeout handling
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 60000);
    });
  }

  handleMessage(message: any) {
    if ('id' in message) {
      // Response to our request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if ('error' in message) {
          pending.reject(message.error);
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      // Notification
      this.emit(`notification:${message.method}`, message.params);
    }
  }
}
```