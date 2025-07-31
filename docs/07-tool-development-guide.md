[← Previous: Multi-Tenancy Guide](./06-multi-tenancy-guide.md) | [🏠 Home](./README.md) | [Next: Workflow Engine Adapters →](./08-workflow-engine-adapters.md)

---

# Tool Development Guide

This guide covers building tools for Shaman agents using the Model Context Protocol (MCP). Tools provide agents with capabilities to interact with external systems, databases, APIs, and more.

## MCP Overview

Shaman uses MCP (Model Context Protocol) for all agent-to-tool communication. MCP provides:
- Standardized tool discovery and invocation
- Multiple transport options (stdio, HTTP+SSE)
- Type-safe tool definitions
- Built-in security and isolation

## Tool Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent (Internal Server)               │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ Agent Logic │  │  MCP Client  │  │ Tool Registry  │ │
│  │   (LLM)     │  │              │  │                │ │
│  └──────┬──────┘  └──────┬───────┘  └────────────────┘ │
│         │                 │                              │
│         └─────────────────┼──────────────────────────────┤
│                           │ MCP Protocol                 │
└───────────────────────────┼──────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  MCP Server   │  │  MCP Server   │  │  MCP Server   │
│  (Database)   │  │    (APIs)     │  │  (FileSystem) │
│               │  │               │  │               │
│  stdio        │  │  HTTP+SSE     │  │  stdio        │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Creating an MCP Server

### Basic Server Structure

```typescript
// database-server.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { Pool } from 'pg';

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create MCP server
const server = new Server({
  name: 'database-tools',
  version: '1.0.0'
});

// Define tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'query_database',
        description: 'Execute a SQL query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute'
            },
            parameters: {
              type: 'array',
              items: { type: ['string', 'number', 'boolean', 'null'] },
              description: 'Query parameters'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'list_tables',
        description: 'List all tables in the database',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'query_database':
      return await executeQuery(args.query, args.parameters);
    
    case 'list_tables':
      return await listTables();
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Tool implementations
async function executeQuery(query: string, parameters?: any[]) {
  try {
    const result = await db.query(query, parameters);
    return {
      content: [{
        type: 'text',
        text: formatQueryResult(result)
      }],
      isError: false
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Query error: ${error.message}`
      }],
      isError: true
    };
  }
}

async function listTables() {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  
  const result = await db.query(query);
  const tables = result.rows.map(row => row.table_name).join('\n');
  
  return {
    content: [{
      type: 'text',
      text: `Tables in database:\n${tables}`
    }],
    isError: false
  };
}

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

### Package Configuration

```json
{
  "name": "@myorg/mcp-database-server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bin": {
    "mcp-database-server": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "pg": "^8.0.0"
  }
}
```

## Advanced Tool Features

### 1. Resource Exposure

Expose data that agents can read and subscribe to:

```typescript
// Expose query results as resources
server.setRequestHandler('resources/list', async () => {
  return {
    resources: [
      {
        uri: 'db://customers/active',
        name: 'Active Customers',
        description: 'List of currently active customers',
        mimeType: 'application/json'
      },
      {
        uri: 'db://orders/recent',
        name: 'Recent Orders',
        description: 'Orders from the last 24 hours',
        mimeType: 'application/json'
      }
    ]
  };
});

server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;
  
  switch (uri) {
    case 'db://customers/active':
      const customers = await db.query(
        'SELECT * FROM customers WHERE active = true'
      );
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(customers.rows, null, 2)
        }]
      };
    
    // Handle other resources...
  }
});
```

### 2. Streaming Responses

For long-running operations:

```typescript
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'analyze_large_dataset') {
    // Return a progress token
    const progressToken = generateProgressToken();
    
    // Start async operation
    analyzeDatasetAsync(args, progressToken);
    
    return {
      content: [{
        type: 'text',
        text: `Analysis started. Progress token: ${progressToken}`
      }],
      isError: false,
      progressToken
    };
  }
});

// Send progress updates
async function analyzeDatasetAsync(args: any, token: string) {
  for (let i = 0; i <= 100; i += 10) {
    await server.sendNotification('notifications/progress', {
      progressToken: token,
      progress: {
        current: i,
        total: 100,
        message: `Analyzing... ${i}% complete`
      }
    });
    await sleep(1000);
  }
}
```

### 3. Tool Composition

Tools that work together:

```typescript
const tools = [
  {
    name: 'start_transaction',
    description: 'Begin a database transaction',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'execute_in_transaction',
    description: 'Execute query within current transaction',
    inputSchema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        query: { type: 'string' },
        parameters: { type: 'array' }
      },
      required: ['transactionId', 'query']
    }
  },
  {
    name: 'commit_transaction',
    description: 'Commit the current transaction',
    inputSchema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' }
      },
      required: ['transactionId']
    }
  }
];

// Transaction management
const transactions = new Map();

async function startTransaction() {
  const client = await db.connect();
  await client.query('BEGIN');
  
  const txId = generateId();
  transactions.set(txId, client);
  
  return {
    content: [{
      type: 'text',
      text: `Transaction started: ${txId}`
    }],
    isError: false
  };
}
```

## HTTP+SSE Server

For remote tools accessed over network:

```typescript
// http-server.ts
import express from 'express';
import { createServer } from '@modelcontextprotocol/sdk/server/http';

const app = express();
const mcp = createServer({
  name: 'remote-api-tools',
  version: '1.0.0'
});

// Configure MCP endpoints
app.post('/mcp/messages', mcp.handleRequest);
app.get('/mcp/sse', mcp.handleSSE);

// Define tools
mcp.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'call_external_api',
        description: 'Call an external REST API',
        inputSchema: {
          type: 'object',
          properties: {
            method: { 
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE']
            },
            url: { type: 'string' },
            headers: { type: 'object' },
            body: { type: 'object' }
          },
          required: ['method', 'url']
        }
      }
    ]
  };
});

// Start server
app.listen(8080, () => {
  console.log('MCP server running on http://localhost:8080');
});
```

## Agent Configuration

### Configuring MCP Servers in Agents

Agents declare which MCP servers they need:

```yaml
---
name: DataAnalyst
description: Analyzes data from multiple sources
mcpServers:
  # Local database server via stdio
  database:
    command: "mcp-database-server"
    args: ["--connection", "postgres://localhost/analytics"]
    env:
      LOG_LEVEL: "info"
    tools:
      - "query_database"
      - "list_tables"
      - "export_csv"
  
  # Remote API server via HTTP+SSE
  external_apis:
    url: "https://api-tools.company.com/mcp"
    transport: "http+sse"
    headers:
      Authorization: "Bearer ${API_TOKEN}"
    tools: "*"  # Allow all tools from this server
  
  # File system access
  filesystem:
    command: "npx"
    args: ["@modelcontextprotocol/server-filesystem", "--root", "/data"]
    resources:
      - "file:///data/reports/**/*.csv"
      - "file:///data/config.json"
---

You are a data analyst with access to databases, APIs, and files.
```

### Tool Access Control

Fine-grained permissions per server:

```yaml
mcpServers:
  production_db:
    command: "mcp-database-server"
    args: ["--connection", "${PROD_DB_URL}"]
    tools:
      # Only allow read operations
      - "query_database"
      - "list_tables"
      # Explicitly exclude dangerous tools
      # - "execute_ddl"     # Not allowed
      # - "drop_table"      # Not allowed
  
  development_db:
    command: "mcp-database-server" 
    args: ["--connection", "${DEV_DB_URL}"]
    tools: "*"  # All tools allowed in dev
```

## Security Best Practices

### 1. Input Validation

Always validate tool inputs:

```typescript
import { z } from 'zod';

const querySchema = z.object({
  query: z.string().max(10000),
  parameters: z.array(z.any()).optional()
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'query_database') {
    // Validate input
    const validated = querySchema.parse(args);
    
    // Check for dangerous patterns
    if (containsSQLInjection(validated.query)) {
      throw new Error('Invalid query pattern detected');
    }
    
    return await executeQuery(validated);
  }
});
```

### 2. Resource Limits

Implement timeouts and limits:

```typescript
async function executeQuery(query: string, parameters?: any[]) {
  // Set statement timeout
  await db.query('SET statement_timeout = 30000'); // 30 seconds
  
  try {
    const result = await db.query(query, parameters);
    
    // Limit result size
    if (result.rows.length > 1000) {
      return {
        content: [{
          type: 'text',
          text: `Query returned ${result.rows.length} rows (showing first 1000)`
        }],
        isError: false
      };
    }
    
    return formatResult(result);
  } finally {
    // Reset timeout
    await db.query('SET statement_timeout = 0');
  }
}
```

### 3. Audit Logging

Log all tool invocations:

```typescript
server.use(async (request, next) => {
  const start = Date.now();
  const { method, params } = request;
  
  try {
    const result = await next();
    
    logger.info('Tool invocation', {
      method,
      tool: params?.name,
      duration: Date.now() - start,
      success: true
    });
    
    return result;
  } catch (error) {
    logger.error('Tool invocation failed', {
      method,
      tool: params?.name,
      duration: Date.now() - start,
      error: error.message
    });
    
    throw error;
  }
});
```

## Testing MCP Servers

### Unit Testing

```typescript
// __tests__/database-server.test.ts
import { TestClient } from '@modelcontextprotocol/sdk/testing';
import { createServer } from '../src/server';

describe('Database MCP Server', () => {
  let client: TestClient;
  
  beforeEach(() => {
    const server = createServer();
    client = new TestClient(server);
  });
  
  test('lists available tools', async () => {
    const response = await client.request('tools/list');
    
    expect(response.tools).toContainEqual(
      expect.objectContaining({
        name: 'query_database',
        description: expect.any(String)
      })
    );
  });
  
  test('executes queries safely', async () => {
    const response = await client.request('tools/call', {
      name: 'query_database',
      arguments: {
        query: 'SELECT COUNT(*) FROM users',
        parameters: []
      }
    });
    
    expect(response.isError).toBe(false);
    expect(response.content[0].type).toBe('text');
  });
  
  test('rejects dangerous queries', async () => {
    await expect(
      client.request('tools/call', {
        name: 'query_database',
        arguments: {
          query: 'DROP TABLE users; --'
        }
      })
    ).rejects.toThrow('Invalid query pattern');
  });
});
```

### Integration Testing

Test with actual agent execution:

```typescript
// __tests__/integration.test.ts
describe('Agent with MCP Tools', () => {
  test('agent can query database', async () => {
    const agent = await loadAgent('DataAnalyst');
    const executor = createAgentExecutor({
      mcpServers: {
        database: {
          command: 'mcp-database-server',
          args: ['--connection', TEST_DB_URL]
        }
      }
    });
    
    const result = await executor.execute(agent, {
      prompt: 'How many active users do we have?'
    });
    
    expect(result.response).toContain('active users');
    expect(result.toolCalls).toContainEqual(
      expect.objectContaining({
        tool: 'query_database',
        server: 'database'
      })
    );
  });
});
```

## Deployment

### Packaging MCP Servers

```dockerfile
# Dockerfile for MCP server
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### Deployment Configuration

```yaml
# kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-database-server
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: mcp-server
        image: myorg/mcp-database-server:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Common Patterns

### 1. Caching Results

```typescript
const cache = new Map();

async function executeQuery(query: string, parameters?: any[]) {
  const cacheKey = JSON.stringify({ query, parameters });
  
  // Check cache
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 60000) { // 1 minute
      return cached.result;
    }
  }
  
  // Execute query
  const result = await db.query(query, parameters);
  const formatted = formatResult(result);
  
  // Cache result
  cache.set(cacheKey, {
    result: formatted,
    timestamp: Date.now()
  });
  
  return formatted;
}
```

### 2. Batch Operations

```typescript
server.addTool({
  name: 'batch_query',
  description: 'Execute multiple queries in parallel',
  inputSchema: {
    type: 'object',
    properties: {
      queries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            query: { type: 'string' },
            parameters: { type: 'array' }
          }
        }
      }
    }
  },
  handler: async ({ queries }) => {
    const results = await Promise.all(
      queries.map(async (q) => {
        try {
          const result = await db.query(q.query, q.parameters);
          return { id: q.id, success: true, data: result.rows };
        } catch (error) {
          return { id: q.id, success: false, error: error.message };
        }
      })
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2)
      }],
      isError: false
    };
  }
});
```

### 3. Pagination Support

```typescript
server.addTool({
  name: 'paginated_query',
  description: 'Execute query with pagination',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      page: { type: 'number', default: 1 },
      pageSize: { type: 'number', default: 50, maximum: 100 }
    }
  },
  handler: async ({ query, page = 1, pageSize = 50 }) => {
    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS subquery`;
    const countResult = await db.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get page data
    const paginatedQuery = `${query} LIMIT $1 OFFSET $2`;
    const result = await db.query(paginatedQuery, [pageSize, offset]);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: result.rows,
          pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize)
          }
        }, null, 2)
      }],
      isError: false
    };
  }
});
```

## Troubleshooting

### Common Issues

1. **Tool not found**: Ensure the tool is listed in the agent's `mcpServers` configuration
2. **Permission denied**: Check that the tool is in the allowed tools list
3. **Connection timeout**: Verify network connectivity and server availability
4. **Invalid schema**: Ensure tool inputs match the defined schema

### Debug Mode

Enable MCP tracing:

```bash
# Environment variables
MCP_TRACE_ENABLED=true
MCP_TRACE_LEVEL=debug
MCP_LOG_FILE=/var/log/mcp-server.log
```

---

[← Previous: Multi-Tenancy Guide](./06-multi-tenancy-guide.md) | [🏠 Home](./README.md) | [Next: Workflow Engine Adapters →](./08-workflow-engine-adapters.md)