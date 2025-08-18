# MCP Tools

Tools in MCP enable language models to interact with external systems through well-defined interfaces. Each tool is uniquely identified by a name and includes metadata describing its functionality and schema.

## Overview

Tools allow agents to:

- Query databases
- Call APIs
- Perform computations
- Interact with file systems
- Execute commands
- Transform data

## Tool Definition

A tool consists of:

```typescript
interface Tool {
  name: string; // Unique identifier
  title?: string; // Human-readable name
  description: string; // What the tool does
  inputSchema: JsonSchema; // Expected parameters
  outputSchema?: JsonSchema; // Expected output structure
  annotations?: {
    // Additional metadata
    [key: string]: any;
  };
}
```

### Example Tool Definition

```json
{
  "name": "query_database",
  "title": "Database Query Tool",
  "description": "Execute SQL queries against the connected database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "SQL query to execute"
      },
      "parameters": {
        "type": "array",
        "items": {
          "type": ["string", "number", "boolean", "null"]
        },
        "description": "Query parameters for prepared statements"
      }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "rows": {
        "type": "array",
        "items": {
          "type": "object"
        }
      },
      "rowCount": {
        "type": "number"
      }
    }
  }
}
```

## Protocol Messages

### Listing Tools

Discover available tools with pagination support:

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
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
    "tools": [
      {
        "name": "query_database",
        "description": "Execute SQL queries",
        "inputSchema": { ... }
      },
      {
        "name": "list_tables",
        "description": "List all database tables",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

### Calling Tools

Invoke a tool with arguments:

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "query_database",
    "arguments": {
      "query": "SELECT * FROM users WHERE active = ?",
      "parameters": [true]
    }
  }
}
```

**Response (Success):**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Query returned 42 rows:\n\n| id | name | email | active |\n|---|---|---|---|\n| 1 | Alice | alice@example.com | true |\n..."
      }
    ],
    "isError": false
  }
}
```

**Response (Error):**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Error: Table 'users' not found"
      }
    ],
    "isError": true
  }
}
```

### Tool List Changed Notification

When tools are added/removed/modified:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
```

## Tool Capabilities

Servers declare tool support in capabilities:

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true // Can notify of tool changes
    }
  }
}
```

## Tool Result Format

Tool results use a content array that can contain:

### Text Content

```json
{
  "type": "text",
  "text": "Tool execution result as text"
}
```

### Image Content

```json
{
  "type": "image",
  "data": "base64-encoded-image-data",
  "mimeType": "image/png"
}
```

### Embedded Resources

```json
{
  "type": "resource",
  "resource": {
    "uri": "file:///path/to/result.json",
    "mimeType": "application/json",
    "text": "{ \"result\": \"data\" }"
  }
}
```

## Security Considerations

### Trust and Safety

⚠️ **Important**: Tools represent arbitrary code execution and must be treated with caution.

1. **Tool Annotations**: Consider untrusted unless from trusted servers
2. **User Consent**: Always obtain explicit user consent before invoking tools
3. **Clear UI**: Show which tools are exposed to the AI model
4. **Visual Indicators**: Display when tools are being invoked
5. **Confirmation Prompts**: Require user confirmation for sensitive operations

### Best Practices

1. **Validate Inputs**: Always validate tool arguments against schema
2. **Sanitize Outputs**: Ensure tool outputs are safe to display
3. **Rate Limiting**: Implement rate limits for tool calls
4. **Audit Logging**: Log all tool invocations for security auditing
5. **Least Privilege**: Tools should have minimal necessary permissions

## Common Tool Patterns

### 1. Query Tools

```json
{
  "name": "search_documents",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "limit": { "type": "number", "default": 10 }
    }
  }
}
```

### 2. Action Tools

```json
{
  "name": "send_email",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": { "type": "string", "format": "email" },
      "subject": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["to", "subject", "body"]
  }
}
```

### 3. Transformation Tools

```json
{
  "name": "convert_currency",
  "inputSchema": {
    "type": "object",
    "properties": {
      "amount": { "type": "number" },
      "from": { "type": "string", "pattern": "^[A-Z]{3}$" },
      "to": { "type": "string", "pattern": "^[A-Z]{3}$" }
    }
  }
}
```

## Implementation in Shaman

### Agent Configuration

Agents declare which tools they can access:

```yaml
mcpServers:
  database:
    command: "mcp-server-postgres"
    args: ["postgresql://localhost/mydb"]
    tools:
      - "query_database"
      - "list_tables"
    # Or allow all tools:
    # tools: "*"
```

### Tool Discovery Flow

```typescript
// 1. Agent initialization
const dbServer = await connectMCPServer(config.database);

// 2. Discover available tools
const { tools } = await dbServer.request("tools/list");

// 3. Filter allowed tools
const allowedTools = tools.filter(
  (tool) =>
    config.database.tools === "*" || config.database.tools.includes(tool.name),
);

// 4. Make tools available to agent
agent.availableTools = allowedTools;
```

### Tool Invocation

```typescript
// Agent decides to use a tool
async function executeToolCall(toolName: string, args: any) {
  // Find the appropriate server
  const server = findServerWithTool(toolName);

  // Validate arguments against schema
  validateArguments(args, tool.inputSchema);

  // Call the tool
  const result = await server.request("tools/call", {
    name: toolName,
    arguments: args,
  });

  // Handle result
  if (result.isError) {
    throw new Error(result.content[0].text);
  }

  return result.content;
}
```

## Error Handling

Common tool errors:

1. **Tool Not Found**: Return appropriate error to agent
2. **Invalid Arguments**: Validate before sending to server
3. **Execution Error**: Tool failed during execution
4. **Timeout**: Tool took too long to execute
5. **Permission Denied**: Tool requires permissions not granted

Example error handling:

```typescript
try {
  const result = await callTool(name, args);
  return result;
} catch (error) {
  if (error.code === -32003) {
    return { error: "Tool not found: " + name };
  }
  if (error.code === -32602) {
    return { error: "Invalid arguments: " + error.message };
  }
  return { error: "Tool execution failed: " + error.message };
}
```
