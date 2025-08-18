# MCP Transports

Transports define how MCP clients and servers communicate. MCP supports multiple transport mechanisms to accommodate different deployment scenarios and requirements.

## Overview

MCP transports provide:

- Bidirectional message exchange
- Connection lifecycle management
- Error handling and recovery
- Security boundaries
- Performance optimization

## Supported Transports

### 1. Standard Input/Output (stdio)

The default transport for local processes:

```typescript
// Server configuration
{
  "command": "mcp-server-filesystem",
  "args": ["--root", "/data"],
  "transport": "stdio"  // Default
}
```

**Characteristics:**

- Process spawning by client
- JSON-RPC over stdin/stdout
- stderr for logging
- Automatic process management
- Ideal for local tools

**Message Flow:**

```
Client Process                Server Process
     |                             |
     |-------- stdin -------->     |
     |         (requests)          |
     |                             |
     |<------- stdout --------     |
     |         (responses)         |
     |                             |
     |<------- stderr --------     |
     |         (logs)              |
```

### 2. HTTP with Server-Sent Events (SSE)

For web-based and remote servers:

```typescript
// Server configuration
{
  "url": "https://api.example.com/mcp",
  "transport": "http+sse",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

**Characteristics:**

- RESTful HTTP for requests
- SSE for server-to-client messages
- Supports authentication
- Works through firewalls
- Scalable for cloud deployment

**Endpoints:**

- `POST /messages` - Send requests
- `GET /sse` - Receive notifications

### 3. WebSocket (Planned)

Full-duplex communication:

```typescript
// Future configuration
{
  "url": "wss://api.example.com/mcp",
  "transport": "websocket"
}
```

**Characteristics:**

- Bidirectional streaming
- Low latency
- Persistent connections
- Real-time updates

## Transport Layer Protocol

All transports use JSON-RPC 2.0:

### Message Framing

**stdio Transport:**

- Line-delimited JSON
- Each message on a single line
- `\n` as delimiter

```
{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n
{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}\n
```

**HTTP+SSE Transport:**

- Requests: JSON in POST body
- Responses: JSON in response body
- Notifications: SSE format

```
POST /messages HTTP/1.1
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"tools/list"}

---

HTTP/1.1 200 OK
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}

---

GET /sse HTTP/1.1

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}\n\n
```

## Transport Configuration

### stdio Configuration

```typescript
interface StdioTransportConfig {
  command: string; // Executable to run
  args?: string[]; // Command arguments
  env?: Record<string, string>; // Environment variables
  cwd?: string; // Working directory
}
```

Example:

```yaml
mcpServers:
  filesystem:
    command: "npx"
    args: ["@modelcontextprotocol/server-filesystem", "--root", "/home"]
    env:
      LOG_LEVEL: "debug"
    transport: "stdio"
```

### HTTP+SSE Configuration

```typescript
interface HttpSseTransportConfig {
  url: string; // Server URL
  headers?: Record<string, string>; // HTTP headers
  timeout?: number; // Request timeout (ms)
  retryInterval?: number; // SSE retry interval
}
```

Example:

```yaml
mcpServers:
  remote:
    url: "https://api.service.com/mcp"
    headers:
      Authorization: "Bearer ${API_TOKEN}"
      X-Client-Id: "shaman-agent"
    transport: "http+sse"
```

## Connection Lifecycle

### 1. stdio Lifecycle

```typescript
// Client implementation
class StdioTransport {
  async connect(config: StdioTransportConfig) {
    // 1. Spawn server process
    this.process = spawn(config.command, config.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...config.env },
      cwd: config.cwd,
    });

    // 2. Setup streams
    this.stdin = this.process.stdin;
    this.stdout = this.process.stdout;
    this.stderr = this.process.stderr;

    // 3. Handle process events
    this.process.on("exit", this.handleExit);
    this.process.on("error", this.handleError);

    // 4. Parse stdout messages
    this.stdout.on("data", this.parseMessages);

    // 5. Log stderr
    this.stderr.on("data", this.logError);
  }

  async send(message: any) {
    this.stdin.write(JSON.stringify(message) + "\n");
  }

  async close() {
    this.process.kill("SIGTERM");
    await this.process.waitForExit();
  }
}
```

### 2. HTTP+SSE Lifecycle

```typescript
class HttpSseTransport {
  async connect(config: HttpSseTransportConfig) {
    // 1. Establish SSE connection
    this.eventSource = new EventSource(`${config.url}/sse`, {
      headers: config.headers,
    });

    // 2. Setup event handlers
    this.eventSource.onmessage = this.handleMessage;
    this.eventSource.onerror = this.handleError;

    // 3. Wait for connection
    await this.waitForConnection();
  }

  async send(message: any) {
    const response = await fetch(`${this.config.url}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
      body: JSON.stringify(message),
    });

    return response.json();
  }

  async close() {
    this.eventSource.close();
  }
}
```

## Error Handling

### Transport Errors

1. **Connection Failed**: Unable to establish connection
2. **Connection Lost**: Unexpected disconnection
3. **Timeout**: Request exceeded time limit
4. **Process Crashed**: Server process terminated
5. **Network Error**: HTTP/SSE communication failed

### Error Recovery

```typescript
class TransportWithRetry {
  async connectWithRetry(maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.connect();
        return;
      } catch (error) {
        if (attempt === maxAttempts) throw error;

        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(delay);
      }
    }
  }

  async sendWithRetry(message: any, maxAttempts = 2) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.send(message);
      } catch (error) {
        if (!this.isRetryable(error) || attempt === maxAttempts) {
          throw error;
        }
        await sleep(1000);
      }
    }
  }
}
```

## Security Considerations

### stdio Security

1. **Process Isolation**: Each server runs in separate process
2. **Command Validation**: Validate executable paths
3. **Argument Sanitization**: Escape shell arguments
4. **Environment Variables**: Filter sensitive vars
5. **Resource Limits**: Set memory/CPU limits

```typescript
// Secure process spawning
function spawnSecurely(config: StdioTransportConfig) {
  // Validate command path
  if (!isAllowedCommand(config.command)) {
    throw new Error("Unauthorized command");
  }

  // Sanitize arguments
  const safeArgs = config.args?.map(sanitizeArg) || [];

  // Filter environment
  const safeEnv = filterEnv(config.env);

  return spawn(config.command, safeArgs, {
    env: safeEnv,
    uid: processUid, // Drop privileges
    gid: processGid,
  });
}
```

### HTTP+SSE Security

1. **TLS Required**: Always use HTTPS
2. **Authentication**: Include auth headers
3. **CORS Policy**: Configure appropriately
4. **Rate Limiting**: Prevent abuse
5. **Input Validation**: Validate all data

```typescript
// Secure HTTP client
class SecureHttpTransport {
  constructor(config: HttpSseTransportConfig) {
    // Require HTTPS
    if (!config.url.startsWith("https://")) {
      throw new Error("HTTPS required");
    }

    // Validate headers
    this.headers = this.sanitizeHeaders(config.headers);
  }

  async send(message: any) {
    // Rate limiting
    await this.rateLimiter.check();

    // Size limit
    const body = JSON.stringify(message);
    if (body.length > MAX_MESSAGE_SIZE) {
      throw new Error("Message too large");
    }

    return this.sendSecurely(body);
  }
}
```

## Performance Optimization

### stdio Optimization

1. **Message Batching**: Group multiple messages
2. **Stream Buffering**: Optimize buffer sizes
3. **Process Pooling**: Reuse server processes
4. **Compression**: For large messages

```typescript
class OptimizedStdioTransport {
  private messageQueue: any[] = [];
  private flushTimer?: NodeJS.Timeout;

  async send(message: any) {
    this.messageQueue.push(message);

    if (this.messageQueue.length >= BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), BATCH_DELAY);
    }
  }

  private flush() {
    if (this.messageQueue.length === 0) return;

    const batch = this.messageQueue.splice(0);
    const batchMessage = {
      jsonrpc: "2.0",
      method: "batch",
      params: { messages: batch },
    };

    this.stdin.write(JSON.stringify(batchMessage) + "\n");

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}
```

### HTTP+SSE Optimization

1. **Connection Pooling**: Reuse HTTP connections
2. **Request Pipelining**: Send multiple requests
3. **Compression**: Enable gzip/brotli
4. **CDN Support**: For distributed servers

## Implementation in Shaman

### Transport Selection

```typescript
function createTransport(config: MCPServerConfig): Transport {
  const transportType = config.transport || "stdio";

  switch (transportType) {
    case "stdio":
      return new StdioTransport({
        command: config.command!,
        args: config.args,
        env: config.env,
      });

    case "http+sse":
      return new HttpSseTransport({
        url: config.url!,
        headers: config.headers,
        timeout: config.timeout,
      });

    default:
      throw new Error(`Unknown transport: ${transportType}`);
  }
}
```

### Multi-Transport Support

```yaml
mcpServers:
  # Local tool via stdio
  local_db:
    command: "mcp-server-sqlite"
    args: ["--db", "local.db"]

  # Remote service via HTTP+SSE
  cloud_api:
    url: "https://api.service.com/mcp"
    transport: "http+sse"
    headers:
      Authorization: "Bearer ${API_KEY}"

  # Another local tool
  filesystem:
    command: "npx"
    args: ["@modelcontextprotocol/server-filesystem"]
```

## Best Practices

1. **Choose Appropriate Transport**:
   - stdio for local tools
   - HTTP+SSE for remote/web services
2. **Handle Disconnections Gracefully**:
   - Implement reconnection logic
   - Queue messages during outages
3. **Monitor Transport Health**:
   - Track connection status
   - Log transport errors
   - Alert on failures
4. **Secure All Transports**:
   - Validate all inputs
   - Use encryption where possible
   - Implement authentication
5. **Optimize for Use Case**:
   - Batch for throughput
   - Stream for real-time
   - Compress large payloads
