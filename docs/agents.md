# Agent Development

## Creating Agents

Agents are Markdown files with YAML frontmatter in Git repositories.

### Basic Agent

```markdown
---
name: CustomerSupport
exposed: true              # Can be called externally
description: Handles customer inquiries
model: gpt-4              # LLM model to use
temperature: 0.7
tools:                    # Available tools
  - run_data_write
  - run_data_read
  - call_agent
---

You are a helpful customer support agent for ACME Corp.

Your responsibilities:
- Answer customer questions
- Process refunds (delegate to PaymentProcessor)
- Check order status
- Be polite and professional

Current customer: {{customer_name}}
Task: {{task}}
```

### Agent Properties

**Required:**
- `name` - Unique agent identifier
- `model` - LLM model (gpt-4, claude-3, etc.)

**Optional:**
- `exposed` - Whether external systems can call this agent (default: false)
- `description` - Human-readable description
- `temperature` - LLM temperature (0-2)
- `maxTokens` - Maximum response tokens
- `tools` - List of available tools
- `mcpServers` - MCP server configurations

## Tools

### Platform Tools

Built-in tools available to all agents:

**run_data_write**
```yaml
# Store data for other agents
- tool: run_data_write
  args:
    key: "customer_email"
    value: "user@example.com"
```

**run_data_read**
```yaml
# Retrieve stored data
- tool: run_data_read
  args:
    key: "customer_email"
```

**call_agent**
```yaml
# Call another agent (A2A protocol)
- tool: call_agent
  args:
    agent: "PaymentProcessor"
    message:
      role: "user"
      parts:
        - type: "text"
          text: "Refund $50 to customer"
```

### MCP Tools

Configure MCP servers for additional tools:

```yaml
---
name: DatabaseAgent
model: gpt-4
mcpServers:
  postgres-tools:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    tools: ["query", "schema"]  # Limit available tools
---
```

## Agent Patterns

### Delegation Pattern

```markdown
---
name: OrderProcessor
tools: [call_agent]
---

You process orders by delegating to specialized agents:
- For inventory: call InventoryChecker
- For payment: call PaymentProcessor  
- For shipping: call ShippingAgent

Coordinate between agents to complete orders.
```

### Data Sharing Pattern

```markdown
---
name: DataCollector
tools: [run_data_write, call_agent]
---

You collect customer information and share it with other agents.

Always write collected data using run_data_write before calling other agents:
- customer_email
- order_items
- shipping_address
```

### Async Tool Pattern

```markdown
---
name: PaymentProcessor
tools: [process_payment]  # Async tool with webhook
---

You handle payments. The process_payment tool is asynchronous:
1. Call the tool with payment details
2. System will wait for payment provider webhook
3. You'll get the result when complete

Always provide clear status updates.
```

## Repository Structure

```
my-agents/
├── agents.json          # Agent aliases and external A2A mappings
├── CustomerSupport.md   # Exposed agent (appears in AgentCard)
├── internal/
│   ├── DataValidator.md # Internal agent (not in AgentCard)
│   └── FraudChecker.md  # Internal agent (not in AgentCard)
└── mcp-servers/
    └── custom-tools/    # Custom MCP server
        ├── package.json
        └── index.js
```

### agents.json

Map agent names to A2A endpoints for federation:

```json
{
  "ExternalValidator": {
    "url": "https://partner.com/a2a/v1",
    "agentName": "Validator",
    "transport": "JSONRPC",
    "authentication": {
      "type": "bearer",
      "token": "${PARTNER_API_KEY}"
    },
    "aliases": ["Validator", "ExtValidator"]
  },
  "InternalHelper": {
    "url": "internal/DataValidator",
    "aliases": ["Helper"]
  }
}
```

## Testing Agents

### Local Testing

```bash
# Use the CLI (sends A2A message)
shaman-cli agent send CustomerSupport "Help with order #123"

# Check task status
shaman-cli task get task_abc123

# Stream responses
shaman-cli agent stream CustomerSupport "Help with order #123"

# With mock tools
shaman-cli agent send CustomerSupport "Help with order #123" --mock-tools
```

### Test Patterns

```markdown
---
name: TestableAgent
model: gpt-4
tools: [run_data_read, run_data_write]
---

You help test the workflow system.

Test scenarios:
1. Write test data: use run_data_write with key "test_{{timestamp}}"
2. Read test data: use run_data_read
3. Report results clearly
```

## Advanced Features

### Conditional Tool Usage

```markdown
---
name: SmartRouter
tools: [call_agent, run_data_read]
---

Route requests based on context:
- If amount > $1000: call FraudChecker first
- If customer is VIP (check run_data): call VIPHandler
- Otherwise: process normally
```

### Error Handling

```markdown
---
name: ResilientAgent
tools: [call_agent, run_data_write]
---

Handle errors gracefully:
1. If agent call fails, write error to run_data
2. Try alternative agent if available
3. Always provide helpful error messages

Never expose internal errors to users.
```

### Multi-Step Workflows

```markdown
---
name: WorkflowOrchestrator
tools: [call_agent, run_data_write, run_data_read]
---

Orchestrate complex workflows:

1. Validate input (call DataValidator)
2. Store validation result  
3. Process each step sequentially
4. If any step fails, call ErrorHandler
5. Write final status

Always maintain workflow state in run_data.
```

## Best Practices

### 1. Clear Responsibilities
Each agent should have a single, clear purpose.

### 2. Proper Tool Declaration
Only request tools the agent actually needs.

### 3. Error Messages
Provide helpful error messages for debugging.

### 4. Data Validation
Validate inputs before processing or delegating.

### 5. Idempotency
Design agents to handle repeated calls safely.

### 6. Documentation
Document expected inputs/outputs in the prompt.

### 7. Security
- Never log sensitive data
- Validate all inputs
- Use internal agents for sensitive operations

## A2A Protocol Features

### AgentCard Generation

Agents with `exposed: true` automatically appear in the AgentCard:

```http
GET /.well-known/a2a/agents
```

Returns:
```json
{
  "protocolVersion": "0.3.0",
  "agents": [{
    "name": "CustomerSupport",
    "description": "Handles customer inquiries",
    "version": "1.0.0",
    "url": "https://your-domain.shaman.ai/a2a/v1",
    "preferredTransport": "JSONRPC",
    "capabilities": {
      "streaming": true,
      "pushNotifications": true
    }
  }]
}
```

### Task Management

All agent interactions create tasks with proper lifecycle:

```typescript
// Agent execution creates task
const response = await call_agent({
  agent: "Helper",
  message: { role: "user", parts: [{type: "text", text: "Help"}] }
});
// Returns: { taskId: "task_123", status: { state: "submitted" } }

// Task progresses through states
// submitted -> working -> completed/failed
```

## Debugging

### Enable Trace Logging

```bash
export LOG_LEVEL=debug
export A2A_TRACE_ENABLED=true
export A2A_LOG_REQUESTS=true  # Log all A2A requests/responses
```

### Common Issues

**Tool not found**
- Check tool is listed in agent's `tools` array
- Verify MCP server is configured correctly
- Check tool handler is registered

**Agent call fails**
- Verify target agent exists
- Check agent is accessible (exposed vs internal)
- Review logs for auth errors

**Async tool timeout**
- Check webhook URL is correct
- Verify external system can reach webhook endpoint
- Look for webhook_id in logs