# MCP Resources

Resources in MCP enable servers to expose data, files, and other content that agents can read and subscribe to. Resources provide a way to share context and information with language models.

## Overview

Resources allow servers to:
- Expose files, documents, and data
- Provide live updates through subscriptions
- Control access to sensitive information
- Support various content types and formats

## Resource Definition

A resource consists of:

```typescript
interface Resource {
  uri: string;              // Unique identifier (URI format)
  name: string;             // Human-readable name
  description?: string;     // What the resource contains
  mimeType?: string;       // Content type
  annotations?: {          // Additional metadata
    [key: string]: any;
  };
}
```

### URI Schemes

Resources use URI schemes to identify content:
- `file:///path/to/file` - Local filesystem
- `git://repo/path` - Git repository content
- `db://database/table` - Database content
- `http://api/endpoint` - Remote resources
- Custom schemes for specialized resources

### Example Resource

```json
{
  "uri": "file:///project/config.json",
  "name": "Application Configuration",
  "description": "Main configuration file for the application",
  "mimeType": "application/json"
}
```

## Protocol Messages

### Listing Resources

Discover available resources with pagination:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "cursor": "optional-cursor"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resources": [
      {
        "uri": "file:///data/users.csv",
        "name": "User Data",
        "mimeType": "text/csv"
      },
      {
        "uri": "git://main/README.md",
        "name": "Project README",
        "mimeType": "text/markdown"
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

### Reading Resources

Read resource content:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "file:///data/config.json"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "file:///data/config.json",
        "mimeType": "application/json",
        "text": "{\n  \"database\": \"postgres://localhost/myapp\",\n  \"port\": 3000\n}"
      }
    ]
  }
}
```

### Resource Templates

Resources can use templates for dynamic URIs:

**List with template:**
```json
{
  "resources": [
    {
      "uri": "file:///logs/{date}.log",
      "name": "Daily Logs",
      "description": "Server logs for a specific date",
      "uriTemplate": {
        "parameters": {
          "date": {
            "type": "string",
            "description": "Date in YYYY-MM-DD format"
          }
        }
      }
    }
  ]
}
```

**Read with template:**
```json
{
  "method": "resources/read",
  "params": {
    "uri": "file:///logs/2024-03-15.log"
  }
}
```

## Subscriptions

### Subscribe to Resources

Monitor resources for changes:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/subscribe",
  "params": {
    "uri": "file:///data/live-metrics.json"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": null
}
```

### Resource Update Notifications

When subscribed resources change:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file:///data/live-metrics.json"
  }
}
```

### Unsubscribe

Stop monitoring a resource:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/unsubscribe",
  "params": {
    "uri": "file:///data/live-metrics.json"
  }
}
```

### Resource List Changed Notification

When resources are added/removed:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/list_changed"
}
```

## Resource Capabilities

Servers declare resource support:

```json
{
  "capabilities": {
    "resources": {
      "subscribe": true,      // Can subscribe to updates
      "listChanged": true     // Can notify of list changes
    }
  }
}
```

## Content Types

Resources can contain various content types:

### Text Content
```json
{
  "uri": "file:///doc.txt",
  "mimeType": "text/plain",
  "text": "Document content here"
}
```

### Binary Content
```json
{
  "uri": "file:///image.png",
  "mimeType": "image/png",
  "blob": "base64-encoded-data"
}
```

### Structured Data
```json
{
  "uri": "db://users/active",
  "mimeType": "application/json",
  "text": "[{\"id\": 1, \"name\": \"Alice\"}, {\"id\": 2, \"name\": \"Bob\"}]"
}
```

## Security Considerations

### Access Control

1. **URI Validation**: Validate all URIs before access
2. **Path Traversal**: Prevent `../` attacks in file URIs
3. **Permissions**: Check read permissions before serving
4. **Sensitive Data**: Filter out sensitive information
5. **Rate Limiting**: Limit resource read frequency

### Best Practices

1. **Explicit Allowlists**: Define which resources can be exposed
2. **Content Filtering**: Sanitize content before serving
3. **Audit Logging**: Log all resource access
4. **Size Limits**: Implement maximum resource size
5. **Timeout Handling**: Set reasonable read timeouts

## Common Resource Patterns

### 1. Configuration Files
```json
{
  "uri": "file:///config/app.yaml",
  "name": "Application Config",
  "mimeType": "application/yaml"
}
```

### 2. Live Data Feeds
```json
{
  "uri": "metrics://cpu/usage",
  "name": "CPU Usage",
  "description": "Real-time CPU metrics"
}
```

### 3. Database Views
```json
{
  "uri": "db://analytics/daily_summary",
  "name": "Daily Analytics",
  "mimeType": "application/json"
}
```

### 4. API Responses
```json
{
  "uri": "http://api.service.com/status",
  "name": "Service Status",
  "mimeType": "application/json"
}
```

## Implementation in Shaman

### Agent Configuration

Agents declare which resources they need:

```yaml
mcpServers:
  filesystem:
    command: "mcp-server-filesystem"
    args: ["--root", "/project"]
    resources:
      - "file:///project/src/**/*.ts"
      - "file:///project/package.json"
    # Or allow all resources:
    # resources: "*"
```

### Resource Access Flow

```typescript
// 1. List available resources
const { resources } = await mcpClient.request('resources/list');

// 2. Filter allowed resources
const allowedResources = resources.filter(r => 
  isAllowedResource(r.uri, agent.config.resources)
);

// 3. Read resource content
const content = await mcpClient.request('resources/read', {
  uri: 'file:///project/config.json'
});

// 4. Subscribe to updates if needed
if (needsLiveUpdates) {
  await mcpClient.request('resources/subscribe', {
    uri: resource.uri
  });
}
```

### Subscription Handling

```typescript
// Handle resource update notifications
mcpClient.on('notification:resources/updated', ({ uri }) => {
  // Re-read the updated resource
  const newContent = await mcpClient.request('resources/read', { uri });
  
  // Update agent's context
  agent.updateContext(uri, newContent);
});
```

## Error Handling

Common resource errors:

1. **Resource Not Found**: URI doesn't exist
2. **Access Denied**: Insufficient permissions
3. **Invalid URI**: Malformed or unsupported scheme
4. **Read Error**: I/O or network failure
5. **Size Exceeded**: Resource too large

Example error handling:
```typescript
try {
  const result = await readResource(uri);
  return result;
} catch (error) {
  if (error.code === -32002) {
    return { error: "Resource not found: " + uri };
  }
  if (error.code === -32003) {
    return { error: "Access denied: " + uri };
  }
  return { error: "Failed to read resource: " + error.message };
}
```