# MCP Security

Security is a fundamental consideration in the Model Context Protocol. This document outlines security considerations, best practices, and implementation guidelines for building secure MCP clients and servers.

## Security Model

MCP's security model is based on several principles:

1. **Least Privilege**: Components only get access to what they need
2. **Defense in Depth**: Multiple layers of security controls
3. **Explicit Consent**: User approval for sensitive operations
4. **Isolation**: Strong boundaries between components
5. **Auditability**: Comprehensive logging of security events

## Trust Boundaries

```
┌─────────────────────────────────────────┐
│           User Trust Zone               │
│  ┌─────────────────────────────────┐    │
│  │      Application Host           │    │
│  │  ┌─────────┐  ┌─────────┐      │    │
│  │  │ Client 1│  │ Client 2│      │    │
│  │  └────┬────┘  └────┬────┘      │    │
│  └───────┼────────────┼────────────┘    │
└──────────┼────────────┼─────────────────┘
           │            │
    ═══════╪════════════╪═══════════ Trust Boundary
           │            │
    ┌──────▼────┐ ┌─────▼─────┐
    │  Server 1 │ │  Server 2  │
    │  (Local)  │ │  (Remote)  │
    └───────────┘ └────────────┘
```

### Trust Levels

1. **Host-Client**: Trusted (same process)
2. **Client-Server**: Untrusted (validate everything)
3. **Server-Resources**: Server's responsibility
4. **User-Host**: Requires explicit consent

## Authentication & Authorization

### Transport-Level Authentication

#### stdio Transport

- Process-based isolation
- Inherit parent process credentials
- No additional authentication needed

#### HTTP+SSE Transport

```typescript
// API Key authentication
{
  "url": "https://api.service.com/mcp",
  "headers": {
    "Authorization": "Bearer ${API_KEY}",
    "X-API-Version": "1.0"
  }
}

// mTLS authentication
{
  "url": "https://api.service.com/mcp",
  "tls": {
    "cert": "/path/to/client.crt",
    "key": "/path/to/client.key",
    "ca": "/path/to/ca.crt"
  }
}
```

### Server Authorization

Servers should implement authorization for:

- Tool access
- Resource access
- Prompt availability
- Operation limits

```typescript
interface AuthContext {
  clientId: string;
  permissions: string[];
  rateLimits: RateLimits;
}

async function authorizeToolCall(
  auth: AuthContext,
  toolName: string,
): Promise<boolean> {
  // Check permissions
  if (!auth.permissions.includes(`tools:${toolName}`)) {
    return false;
  }

  // Check rate limits
  if (!auth.rateLimits.checkLimit(`tool:${toolName}`)) {
    return false;
  }

  return true;
}
```

## Input Validation

### Client-Side Validation

```typescript
function validateServerResponse(response: any): void {
  // Validate JSON-RPC structure
  if (!response.jsonrpc || response.jsonrpc !== "2.0") {
    throw new Error("Invalid JSON-RPC version");
  }

  // Validate response format
  if ("error" in response && "result" in response) {
    throw new Error("Response cannot have both error and result");
  }

  // Validate content types
  if (response.result?.content) {
    validateContent(response.result.content);
  }
}

function validateContent(content: any[]): void {
  for (const item of content) {
    if (!["text", "image", "resource"].includes(item.type)) {
      throw new Error(`Invalid content type: ${item.type}`);
    }

    // Validate text length
    if (item.type === "text" && item.text.length > MAX_TEXT_LENGTH) {
      throw new Error("Text content too large");
    }

    // Validate image size
    if (item.type === "image" && item.data.length > MAX_IMAGE_SIZE) {
      throw new Error("Image content too large");
    }
  }
}
```

### Server-Side Validation

```typescript
function validateToolArguments(
  schema: JsonSchema,
  args: any,
): Result<any, Error> {
  try {
    // Validate against schema
    const valid = ajv.validate(schema, args);
    if (!valid) {
      return {
        success: false,
        error: new Error(ajv.errorsText()),
      };
    }

    // Additional security checks
    const sanitized = sanitizeArguments(args);

    return { success: true, data: sanitized };
  } catch (error) {
    return { success: false, error };
  }
}

function sanitizeArguments(args: any): any {
  // Remove potential security risks
  const cleaned = JSON.parse(JSON.stringify(args));

  // Sanitize strings
  walkObject(cleaned, (value) => {
    if (typeof value === "string") {
      // Remove null bytes
      value = value.replace(/\0/g, "");

      // Limit length
      if (value.length > MAX_STRING_LENGTH) {
        value = value.substring(0, MAX_STRING_LENGTH);
      }
    }
    return value;
  });

  return cleaned;
}
```

## Resource Access Control

### Path Traversal Prevention

```typescript
function validateResourceUri(uri: string): boolean {
  const parsed = new URL(uri);

  // File URIs need special validation
  if (parsed.protocol === "file:") {
    const normalizedPath = path.normalize(parsed.pathname);

    // Check for path traversal
    if (normalizedPath.includes("..")) {
      return false;
    }

    // Check against allowed paths
    if (!isAllowedPath(normalizedPath)) {
      return false;
    }
  }

  return true;
}

function isAllowedPath(filePath: string): boolean {
  const allowedPaths = ["/project/src", "/project/docs", "/tmp/mcp"];

  return allowedPaths.some((allowed) =>
    filePath.startsWith(path.normalize(allowed)),
  );
}
```

### Resource Permissions

```typescript
interface ResourcePermissions {
  read: boolean;
  subscribe: boolean;
  pattern?: string; // Glob pattern for allowed resources
}

function checkResourceAccess(
  uri: string,
  permissions: ResourcePermissions,
): boolean {
  if (!permissions.read) {
    return false;
  }

  if (permissions.pattern) {
    return minimatch(uri, permissions.pattern);
  }

  return true;
}
```

## Tool Execution Safety

### Command Injection Prevention

```typescript
function sanitizeToolCommand(
  command: string,
  args: string[],
): { command: string; args: string[] } {
  // Validate command is in allowlist
  const allowedCommands = ["git", "npm", "node", "python"];

  const cmdName = path.basename(command);
  if (!allowedCommands.includes(cmdName)) {
    throw new Error(`Command not allowed: ${cmdName}`);
  }

  // Sanitize arguments
  const safeArgs = args.map((arg) => {
    // Remove shell metacharacters
    return arg.replace(/[;&|`$()<>]/g, "");
  });

  return { command, args: safeArgs };
}
```

### Sandbox Execution

```typescript
interface SandboxOptions {
  maxMemory: number;
  maxCpu: number;
  timeout: number;
  allowedSyscalls: string[];
}

async function executeInSandbox(
  command: string,
  args: string[],
  options: SandboxOptions,
): Promise<Result<string, Error>> {
  // Use container or VM for isolation
  const sandbox = await createSandbox(options);

  try {
    const result = await sandbox.execute(command, args);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error };
  } finally {
    await sandbox.destroy();
  }
}
```

## Sensitive Data Protection

### Secret Management

```typescript
class SecretManager {
  private secrets = new Map<string, string>();

  setSecret(key: string, value: string): void {
    // Encrypt in memory
    const encrypted = encrypt(value, this.masterKey);
    this.secrets.set(key, encrypted);
  }

  getSecret(key: string): string | undefined {
    const encrypted = this.secrets.get(key);
    if (!encrypted) return undefined;

    // Decrypt on demand
    return decrypt(encrypted, this.masterKey);
  }

  // Clear secrets from memory
  clear(): void {
    // Overwrite memory before clearing
    for (const [key, value] of this.secrets) {
      crypto.randomFillSync(Buffer.from(value));
    }
    this.secrets.clear();
  }
}
```

### Logging Security

```typescript
function sanitizeForLogging(data: any): any {
  const sensitive = ["password", "token", "api_key", "secret", "authorization"];

  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      // Redact sensitive fields
      if (sensitive.some((s) => key.toLowerCase().includes(s))) {
        return "[REDACTED]";
      }

      // Truncate large values
      if (typeof value === "string" && value.length > 1000) {
        return value.substring(0, 100) + "...[TRUNCATED]";
      }

      return value;
    }),
  );
}
```

## Rate Limiting

### Client-Side Rate Limiting

```typescript
class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(private config: RateLimitConfig) {}

  async checkLimit(key: string): Promise<boolean> {
    const bucket = this.buckets.get(key) || this.createBucket(key);

    return bucket.tryConsume(1);
  }

  private createBucket(key: string): TokenBucket {
    const bucket = new TokenBucket({
      capacity: this.config.requestsPerMinute,
      fillRate: this.config.requestsPerMinute / 60,
    });

    this.buckets.set(key, bucket);
    return bucket;
  }
}
```

### Server-Side Rate Limiting

```typescript
async function enforceRateLimit(
  clientId: string,
  operation: string
): Promise<void> {
  const key = `${clientId}:${operation}`;
  const limit = await rateLimiter.checkLimit(key);

  if (!limit.allowed) {
    throw new MCP Error({
      code: -32003,
      message: "Rate limit exceeded",
      data: {
        retryAfter: limit.retryAfter
      }
    });
  }
}
```

## Security Monitoring

### Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  clientId: string;
  operation: string;
  resource?: string;
  result: "success" | "failure";
  error?: string;
  metadata?: Record<string, any>;
}

class AuditLogger {
  async log(entry: AuditLog): Promise<void> {
    // Add security context
    const enriched = {
      ...entry,
      ip: this.getClientIp(),
      userAgent: this.getUserAgent(),
      sessionId: this.getSessionId(),
    };

    // Write to secure audit log
    await this.writeToAuditLog(enriched);

    // Alert on suspicious activity
    if (this.isSuspicious(enriched)) {
      await this.alertSecurity(enriched);
    }
  }

  private isSuspicious(entry: AuditLog): boolean {
    // Multiple failed attempts
    if (entry.result === "failure") {
      const failures = await this.getRecentFailures(entry.clientId);
      if (failures > FAILURE_THRESHOLD) {
        return true;
      }
    }

    // Unusual patterns
    if (this.isUnusualPattern(entry)) {
      return true;
    }

    return false;
  }
}
```

### Security Metrics

```typescript
class SecurityMetrics {
  private metrics = {
    authFailures: new Counter("mcp_auth_failures_total"),
    rateLimitHits: new Counter("mcp_rate_limit_hits_total"),
    invalidRequests: new Counter("mcp_invalid_requests_total"),
    suspiciousActivity: new Counter("mcp_suspicious_activity_total"),
  };

  recordAuthFailure(reason: string): void {
    this.metrics.authFailures.inc({ reason });
  }

  recordRateLimitHit(operation: string): void {
    this.metrics.rateLimitHits.inc({ operation });
  }

  getMetrics(): Metrics {
    return this.metrics;
  }
}
```

## Implementation Guidelines

### 1. Secure by Default

```typescript
const defaultConfig: SecurityConfig = {
  // Require authentication
  requireAuth: true,

  // Strict validation
  strictValidation: true,

  // Conservative rate limits
  rateLimits: {
    requestsPerMinute: 60,
    burstSize: 10,
  },

  // Comprehensive logging
  auditLogging: true,

  // Timeout settings
  requestTimeout: 30000,
  connectionTimeout: 10000,
};
```

### 2. Defense in Depth

Layer multiple security controls:

1. Network security (TLS, firewalls)
2. Authentication (API keys, mTLS)
3. Authorization (permissions, ACLs)
4. Input validation (schemas, sanitization)
5. Output filtering (redaction, truncation)
6. Monitoring (logging, alerting)

### 3. Principle of Least Privilege

```typescript
// Grant minimal permissions
const agentPermissions = {
  tools: ["search", "read_file"], // Not 'execute_command'
  resources: {
    pattern: "/project/docs/**", // Not '/**'
    operations: ["read"], // Not ['read', 'write']
  },
  prompts: ["help", "explain"], // Specific prompts only
};
```

### 4. Security Testing

```typescript
describe("Security Tests", () => {
  test("prevents path traversal", async () => {
    const maliciousUris = [
      "file:///../etc/passwd",
      "file:///project/../../../etc/hosts",
      "file:///project/..%2F..%2Fetc/shadow",
    ];

    for (const uri of maliciousUris) {
      await expect(readResource(uri)).rejects.toThrow("Invalid resource URI");
    }
  });

  test("enforces rate limits", async () => {
    // Exhaust rate limit
    for (let i = 0; i < 100; i++) {
      await callTool("search", { query: "test" });
    }

    // Next call should fail
    await expect(callTool("search", { query: "test" })).rejects.toThrow(
      "Rate limit exceeded",
    );
  });
});
```

## Security Checklist

### For MCP Clients

- [ ] Validate all server responses
- [ ] Implement timeout handling
- [ ] Use TLS for remote connections
- [ ] Store credentials securely
- [ ] Log security events
- [ ] Handle errors gracefully
- [ ] Implement rate limiting
- [ ] Validate resource URIs

### For MCP Servers

- [ ] Authenticate all requests
- [ ] Authorize operations
- [ ] Validate all inputs
- [ ] Sanitize outputs
- [ ] Implement rate limiting
- [ ] Use secure defaults
- [ ] Audit all operations
- [ ] Monitor for anomalies
- [ ] Handle errors safely
- [ ] Document security model

## Common Vulnerabilities

### 1. Injection Attacks

- **Risk**: Command/SQL injection through tool arguments
- **Mitigation**: Parameterized queries, argument validation

### 2. Path Traversal

- **Risk**: Access to unauthorized files
- **Mitigation**: Path normalization, allowlists

### 3. Denial of Service

- **Risk**: Resource exhaustion
- **Mitigation**: Rate limiting, timeouts, resource limits

### 4. Information Disclosure

- **Risk**: Leaking sensitive data
- **Mitigation**: Output filtering, error sanitization

### 5. Privilege Escalation

- **Risk**: Gaining unauthorized capabilities
- **Mitigation**: Strict authorization, least privilege
