# Shaman Application Flow: Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Complete Request Flow](#complete-request-flow)
4. [Detailed Package Interactions](#detailed-package-interactions)
5. [Data Formats and Examples](#data-formats-and-examples)
6. [Tool Execution Flow](#tool-execution-flow)
7. [Workflow Engine Details](#workflow-engine-details)
8. [Error Handling and Recovery](#error-handling-and-recovery)

## Overview

Shaman is a federated AI agent orchestration system that enables agents to communicate and collaborate through the A2A (Agent-to-Agent) protocol. The system is designed with a two-server architecture:

1. **GraphQL Management Server** (`shaman-gql-server`) - Control plane for configuration and monitoring
2. **A2A Execution Server** (`shaman-a2a-server`) - Handles all agent execution requests

## Architecture Components

### Server Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External Clients                              │
│                   (API Keys for Authentication)                      │
└────────────────────────┬─────────────────────┬──────────────────────┘
                         │                     │
                         ▼                     ▼
              ┌──────────────────┐   ┌──────────────────┐
              │  GraphQL Server  │   │  A2A Server      │
              │  (Management)    │   │  (--role public) │
              │  Port: 4000      │   │  Port: 5000      │
              └──────────────────┘   └────────┬─────────┘
                                              │
                                              ▼
                         ┌────────────────────────────────┐
                         │     BullMQ Job Queue          │
                         │  (Redis-backed workflow queue) │
                         └────────────┬───────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────────────┐
                         │    Worker Process              │
                         │  (shaman-worker)               │
                         └────────────┬───────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────────────┐
                         │    A2A Server                  │
                         │  (--role internal)             │
                         │  Port: 5001                    │
                         └────────────────────────────────┘
```

### Key Packages and Their Roles

1. **Entry Points**
   - `@codespin/shaman-a2a-server` - HTTP server implementing A2A protocol
   - `@codespin/shaman-gql-server` - GraphQL API for management

2. **Protocol & Transport**
   - `@codespin/shaman-a2a-protocol` - A2A protocol type definitions
   - `@codespin/shaman-jsonrpc` - JSON-RPC 2.0 implementation
   - `@codespin/shaman-a2a-transport` - Transport layer abstractions

3. **Agent Management**
   - `@codespin/shaman-agents` - Unified agent resolution
   - `@codespin/shaman-git-resolver` - Git-based agent discovery
   - `@codespin/shaman-external-registry` - External agent registry

4. **Execution Engine**
   - `@codespin/shaman-agent-executor` - Core agent execution logic
   - `@codespin/shaman-tool-router` - Tool execution routing
   - `@codespin/shaman-llm-vercel` - LLM provider implementation
   - `@codespin/shaman-workflow` - BullMQ workflow engine

5. **Infrastructure**
   - `@codespin/shaman-db` - Database with Row Level Security
   - `@codespin/shaman-security` - Authentication & authorization
   - `@codespin/shaman-a2a-client` - Internal A2A HTTP client

## Complete Request Flow

### Step 1: External Client Makes Request

An external client sends a request to execute an agent:

```http
POST https://api.shaman.example.com:5000/
Content-Type: application/json
Authorization: Bearer <API_KEY>

{
  "jsonrpc": "2.0",
  "id": "req-123",
  "method": "message/send",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": "Search for all TypeScript files in the project and analyze their dependencies"
      }
    ],
    "agent": "code-analyzer@git+https://github.com/org/agents.git#main",
    "threadId": "thread-456"
  }
}
```

### Step 2: A2A Server (Public) Receives Request

The public A2A server (`shaman-a2a-server --role public`) processes the request:

```typescript
// In packages/shaman-a2a-server/src/index.ts
const server = express();

// Authentication middleware
server.use(authMiddleware({
  isInternal: false,
  jwtSecret: config.jwtSecret,
}));

// JSON-RPC endpoint
server.post('/', async (req, res) => {
  const transport = createJsonRpcTransport();
  await transport.handle(req, res, {
    'message/send': messageSendHandler,
    'message/stream': messageStreamHandler,
    'tasks/get': tasksGetHandler,
    'tasks/cancel': tasksCancelHandler,
  });
});
```

### Step 3: Message Send Handler Creates Workflow Job

The `messageSendHandler` validates the request and creates a workflow job:

```typescript
// In packages/shaman-a2a-server/src/handlers/message-send.ts
async function messageSendHandler(params: MessageSendParams, context: A2AMethodContext): Promise<MessageSendResult> {
  const { messages, agent, threadId, organizationId } = params;
  
  // Resolve agent from the agent string
  const resolvedAgent = await resolveAgent(agent);
  
  // Create workflow job
  const workflow = getWorkflowEngine();
  const job = await workflow.createJob({
    type: 'agent-execution',
    data: {
      agent: resolvedAgent,
      messages,
      threadId,
      organizationId,
      requestId: context.requestId,
    }
  });
  
  // Return task ID for polling
  return {
    kind: 'task',
    id: job.id,
    status: 'pending',
    href: `/tasks/${job.id}`,
  };
}
```

### Step 4: Worker Picks Up Job

The worker process (`shaman-worker`) monitors the BullMQ queue:

```typescript
// In packages/shaman-worker/src/worker-main.ts
const worker = new Worker('agent-execution', async (job) => {
  const { agent, messages, threadId, organizationId } = job.data;
  
  // Create database connection with RLS
  const db = createRlsDb(organizationId);
  
  // Initialize agent executor
  const executor = createAgentExecutor({
    agent,
    llmProvider: createVercelLLMProvider(config.llm),
    toolRouter: createToolRouter(),
    db,
  });
  
  // Execute agent
  const result = await executor.execute({
    messages,
    threadId,
  });
  
  // Store result
  await db.none(`
    UPDATE step SET 
      status = 'completed',
      result = $(result)
    WHERE id = $(stepId)
  `, { stepId: job.data.stepId, result });
  
  return result;
});
```

### Step 5: Agent Executor Processes Request

The agent executor manages the conversation with the LLM:

```typescript
// In packages/shaman-agent-executor/src/executor.ts
export async function executeAgent({
  agent,
  messages,
  llmProvider,
  toolRouter,
}: ExecuteAgentParams): Promise<AgentExecutionResult> {
  // Build system prompt from agent definition
  const systemPrompt = buildSystemPrompt(agent);
  
  // Prepare messages for LLM
  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
  
  // Get available tools
  const tools = await toolRouter.getTools(agent.tools);
  
  // Call LLM
  const response = await llmProvider.complete({
    model: agent.model || 'gpt-4',
    messages: llmMessages,
    tools,
    temperature: agent.temperature || 0.7,
  });
  
  // Handle tool calls if any
  if (response.tool_calls) {
    const toolResults = await executeToolCalls(response.tool_calls, toolRouter);
    
    // Add tool results to conversation
    llmMessages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.tool_calls,
    });
    
    for (const result of toolResults) {
      llmMessages.push({
        role: 'tool',
        content: JSON.stringify(result.result),
        tool_call_id: result.toolCallId,
      });
    }
    
    // Call LLM again with tool results
    const finalResponse = await llmProvider.complete({
      model: agent.model || 'gpt-4',
      messages: llmMessages,
      temperature: agent.temperature || 0.7,
    });
    
    return {
      content: finalResponse.content,
      messages: llmMessages,
    };
  }
  
  return {
    content: response.content,
    messages: llmMessages,
  };
}
```

### Step 6: Tool Execution

When the LLM requests tool calls, the tool router handles execution:

```typescript
// In packages/shaman-tool-router/src/router.ts
export async function executeToolCall(
  toolCall: ToolCall,
  availableTools: Map<string, Tool>
): Promise<ToolResult> {
  const tool = availableTools.get(toolCall.function.name);
  
  if (!tool) {
    throw new Error(`Tool ${toolCall.function.name} not found`);
  }
  
  // Parse and validate arguments
  const args = JSON.parse(toolCall.function.arguments);
  const validatedArgs = await tool.inputSchema.parseAsync(args);
  
  // Execute tool
  try {
    const result = await tool.execute(validatedArgs);
    return {
      toolCallId: toolCall.id,
      result,
      error: null,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      result: null,
      error: error.message,
    };
  }
}
```

#### Platform Tools Example

Shaman provides built-in platform tools for workflow data management:

```typescript
// Platform tool: workflow_data_write
{
  name: 'workflow_data_write',
  description: 'Store data for agent collaboration',
  inputSchema: z.object({
    key: z.string(),
    value: z.unknown(),
    description: z.string().optional(),
  }),
  execute: async ({ key, value, description }) => {
    await db.none(`
      INSERT INTO workflow_data (workflow_id, key, value, description, agent_id, step_id)
      VALUES ($(workflowId), $(key), $(value), $(description), $(agentId), $(stepId))
    `, {
      workflowId: context.workflowId,
      key,
      value: JSON.stringify(value),
      description,
      agentId: context.agentId,
      stepId: context.stepId,
    });
    
    return { success: true };
  }
}
```

### Step 7: Agent-to-Agent Communication

When an agent needs to call another agent, it uses the A2A client:

```typescript
// In packages/shaman-a2a-client/src/client.ts
export async function callAgent({
  agentUrl,
  messages,
  authToken,
}: CallAgentParams): Promise<AgentResponse> {
  // Generate internal JWT token
  const internalToken = generateInternalToken({
    organizationId: context.organizationId,
    userId: context.userId,
  });
  
  // Make A2A call
  const response = await fetch(`${INTERNAL_A2A_URL}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${internalToken}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: generateId(),
      method: 'message/send',
      params: {
        messages,
        agent: agentUrl,
        threadId: context.threadId,
      },
    }),
  });
  
  const result = await response.json();
  
  // Handle task response (polling)
  if (result.result.kind === 'task') {
    return pollTask(result.result.id);
  }
  
  return result.result;
}
```

### Step 8: Response Streaming (SSE)

For streaming responses, the A2A server uses Server-Sent Events:

```typescript
// In packages/shaman-a2a-server/src/handlers/message-stream.ts
async function messageStreamHandler(params: MessageStreamParams, context: A2AMethodContext): Promise<void> {
  const { response } = context;
  
  // Set SSE headers
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  
  // Create workflow job
  const job = await workflow.createJob({
    type: 'agent-execution-stream',
    data: params,
  });
  
  // Subscribe to job events
  job.on('progress', (data) => {
    // Send SSE event
    response.write(`id: ${Date.now()}\n`);
    response.write(`event: message\n`);
    response.write(`data: ${JSON.stringify({
      jsonrpc: '2.0',
      id: context.requestId,
      result: {
        kind: 'chunk',
        content: data.content,
      },
    })}\n\n`);
  });
  
  job.on('completed', (result) => {
    // Send final event
    response.write(`id: ${Date.now()}\n`);
    response.write(`event: message\n`);
    response.write(`data: ${JSON.stringify({
      jsonrpc: '2.0',
      id: context.requestId,
      result: {
        kind: 'complete',
        content: result.content,
      },
    })}\n\n`);
    
    response.end();
  });
}
```

## Detailed Package Interactions

### Agent Resolution Flow

```
User Request with agent string
    │
    ▼
shaman-agents (resolveAgent)
    │
    ├─→ Check if it's a Git URL
    │   └─→ shaman-git-resolver
    │       ├─→ Clone/pull repository
    │       ├─→ Check cache by commit hash
    │       ├─→ Parse agent Markdown files
    │       └─→ Store in database
    │
    └─→ Check external registries
        └─→ shaman-external-registry
            └─→ Query external agent registries
```

### LLM Provider Flow

```
Agent Executor
    │
    ▼
shaman-llm-vercel (LLM Provider)
    │
    ├─→ Convert messages to AI SDK format
    │   └─→ Filter out tool messages
    │
    ├─→ Create model instance
    │   ├─→ OpenAI provider
    │   └─→ Anthropic provider
    │
    └─→ Call AI SDK functions
        ├─→ generateText (non-streaming)
        └─→ streamText (streaming)
```

### Database with RLS Flow

```
Request with Organization ID
    │
    ▼
shaman-db (createRlsDb)
    │
    ├─→ Create database connection
    │
    └─→ Wrap with RLS
        └─→ Before each query:
            └─→ SET LOCAL app.current_org_id = organizationId
```

## Data Formats and Examples

### Agent Definition (Markdown with YAML Frontmatter)

```markdown
---
name: code-analyzer
version: 1.0.0
description: Analyzes code structure and dependencies
model: gpt-4
temperature: 0.3
tools:
  - file_search
  - code_analysis
  - workflow_data_write
providers:
  file_search:
    type: mcp
    url: http://localhost:3001/mcp
---

# Code Analyzer Agent

You are a code analysis expert. Your role is to:
1. Search for code files based on user queries
2. Analyze code structure and dependencies
3. Provide insights about code quality

Always store your findings using workflow_data_write for other agents to access.
```

### A2A Message Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "message/send",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": "Analyze the authentication module"
      },
      {
        "role": "assistant",
        "content": "I'll analyze the authentication module for you.",
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "file_search",
              "arguments": "{\"query\": \"auth*.ts\", \"path\": \"src/\"}"
            }
          }
        ]
      },
      {
        "role": "tool",
        "tool_call_id": "call_123",
        "content": "[{\"path\": \"src/auth/middleware.ts\", \"size\": 2048}]"
      }
    ],
    "agent": "code-analyzer@git+https://github.com/org/agents.git#main",
    "threadId": "thread-789",
    "organizationId": "org-123"
  }
}
```

### Task Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "kind": "task",
    "id": "task-456",
    "status": "pending",
    "href": "/tasks/task-456"
  }
}
```

### Message Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "kind": "message",
    "messageId": "msg-789",
    "role": "assistant",
    "content": "I found 3 authentication files:\n1. auth/middleware.ts - JWT validation\n2. auth/rbac.ts - Role-based access control\n3. auth/session.ts - Session management\n\nThe authentication module uses JWT tokens with RBAC.",
    "contextId": "ctx-123",
    "status": "complete"
  }
}
```

### Streaming Response Format (SSE)

```
id: 1234567890
event: message
data: {"jsonrpc":"2.0","id":"req-123","result":{"kind":"chunk","content":"I found "}}

id: 1234567891
event: message
data: {"jsonrpc":"2.0","id":"req-123","result":{"kind":"chunk","content":"3 authentication "}}

id: 1234567892
event: message
data: {"jsonrpc":"2.0","id":"req-123","result":{"kind":"chunk","content":"files"}}

id: 1234567893
event: message
data: {"jsonrpc":"2.0","id":"req-123","result":{"kind":"complete","content":"I found 3 authentication files","messageId":"msg-789"}}
```

## Tool Execution Flow

### Tool Definition

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  execute: (input: unknown) => Promise<unknown>;
}
```

### Platform Tools

1. **workflow_data_write** - Store data for agent collaboration
2. **workflow_data_read** - Retrieve specific data by key
3. **workflow_data_query** - Search data by patterns
4. **workflow_data_list** - List all stored data

### MCP (Model Context Protocol) Tools

Tools can be provided by external MCP servers:

```typescript
// MCP tool integration
const mcpTool = {
  name: 'file_search',
  description: 'Search for files in the codebase',
  inputSchema: z.object({
    query: z.string(),
    path: z.string().optional(),
  }),
  execute: async (input) => {
    // Forward to MCP server
    const response = await fetch(`${MCP_SERVER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'file_search',
        params: input,
      }),
    });
    
    return response.json();
  }
};
```

## Workflow Engine Details

### BullMQ Job Structure

```typescript
interface AgentExecutionJob {
  type: 'agent-execution' | 'agent-execution-stream';
  data: {
    agent: ResolvedAgent;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    threadId: string;
    organizationId: string;
    requestId: string;
    stepId: number;
  };
}
```

### Job States

1. **pending** - Job created, waiting for worker
2. **active** - Worker processing the job
3. **completed** - Job finished successfully
4. **failed** - Job encountered an error
5. **delayed** - Job scheduled for future execution
6. **waiting** - Job waiting for async task completion

### Async Task Polling

When an agent returns a task ID (for long-running operations):

```typescript
// Worker detects task response
if (result.kind === 'task') {
  // Update step status
  await db.none(`
    UPDATE step SET 
      status = 'waiting',
      async_id = $(taskId)
    WHERE id = $(stepId)
  `, { stepId, taskId: result.id });
  
  // Create polling job
  await workflow.createJob({
    type: 'task-poll',
    data: {
      taskId: result.id,
      stepId,
      retryCount: 0,
    },
    delay: 1000, // Poll after 1 second
  });
}
```

## Error Handling and Recovery

### API Error Responses

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "agent",
      "reason": "Agent not found: code-analyzer@git+..."
    }
  }
}
```

### Standard Error Codes

- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error
- `-32000` - Application error (agent execution failed)

### Retry Strategy

```typescript
// In worker process
const worker = new Worker('agent-execution', async (job) => {
  try {
    return await executeAgent(job.data);
  } catch (error) {
    // Check if retryable
    if (isRetryableError(error)) {
      throw error; // BullMQ will retry
    }
    
    // Non-retryable error
    await db.none(`
      UPDATE step SET 
        status = 'failed',
        error = $(error)
      WHERE id = $(stepId)
    `, { stepId: job.data.stepId, error: error.message });
    
    // Don't retry
    return { error: error.message };
  }
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

### Database Transaction Handling

```typescript
// RLS wrapper ensures organization isolation
export async function executeInTransaction<T>(
  db: Database,
  organizationId: string,
  callback: (t: ITask<{}>) => Promise<T>
): Promise<T> {
  return db.tx(async t => {
    // Set organization context
    await t.none('SET LOCAL app.current_org_id = $1', [organizationId]);
    
    // Execute callback
    return callback(t);
  });
}
```

## Security Considerations

### Authentication Flow

1. **External Requests** - API key validation
2. **Internal Requests** - JWT token validation
3. **Database Access** - Row Level Security by organization

### API Key Validation

```typescript
// In auth middleware
async function validateApiKey(apiKey: string): Promise<AuthContext> {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  const result = await db.oneOrNone<{
    organization_id: string;
    user_id: string;
    permissions: string[];
  }>(`
    SELECT organization_id, user_id, permissions
    FROM api_keys
    WHERE key_hash = $(keyHash)
      AND (expires_at IS NULL OR expires_at > NOW())
      AND is_active = true
  `, { keyHash });
  
  if (!result) {
    throw new UnauthorizedError('Invalid API key');
  }
  
  return {
    organizationId: result.organization_id,
    userId: result.user_id,
    permissions: result.permissions,
  };
}
```

### JWT Token Generation

```typescript
// For internal service-to-service calls
export function generateInternalToken(context: AuthContext): string {
  return jwt.sign({
    organizationId: context.organizationId,
    userId: context.userId,
    permissions: context.permissions,
    internal: true,
  }, JWT_SECRET, {
    expiresIn: '5m', // Short-lived for security
    issuer: 'shaman-internal',
  });
}
```

## Monitoring and Observability

### OpenTelemetry Integration

```typescript
// In packages/shaman-observability
export function initTracing() {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'shaman',
    }),
  });
  
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter())
  );
  
  provider.register();
}

// Usage in agent executor
const tracer = trace.getTracer('shaman-agent-executor');

export async function executeAgent(params: ExecuteAgentParams) {
  return tracer.startActiveSpan('agent.execute', async (span) => {
    span.setAttributes({
      'agent.name': params.agent.name,
      'agent.version': params.agent.version,
      'thread.id': params.threadId,
    });
    
    try {
      const result = await doExecute(params);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Metrics Collection

```typescript
// Key metrics tracked
const metrics = {
  // Request metrics
  'a2a.requests.total': new Counter(),
  'a2a.requests.duration': new Histogram(),
  
  // Agent execution metrics
  'agent.executions.total': new Counter(),
  'agent.executions.duration': new Histogram(),
  'agent.tool_calls.total': new Counter(),
  
  // Workflow metrics
  'workflow.jobs.created': new Counter(),
  'workflow.jobs.completed': new Counter(),
  'workflow.jobs.failed': new Counter(),
  'workflow.queue.size': new Gauge(),
};
```

## Summary

The Shaman system provides a complete agent orchestration platform with:

1. **Standards-based Communication** - A2A protocol with JSON-RPC
2. **Flexible Agent Sources** - Git repositories and external registries
3. **Powerful Execution Engine** - LLM integration with tool support
4. **Scalable Architecture** - Queue-based processing with workers
5. **Multi-tenant Security** - Organization isolation with RLS
6. **Production Ready** - Monitoring, error handling, and recovery

The system is designed to handle complex agent interactions while maintaining security, scalability, and observability throughout the entire flow.