[← Previous: Authentication Guide](./09-authentication-guide.md) | [🏠 Home](./README.md)

---

# API Call Flow Example

This document walks through a complete example of an external API call to Shaman, showing how authentication, authorization, and agent execution work together.

## Scenario

**ACME Corp** (a Shaman customer) has built an order processing system with multiple agents. They want to allow their partner **Widgets Inc** to submit orders through their API.

## Repository Structure

ACME Corp has the following agents in their Git repository:

```
acme-corp-agents/
├── agents.json
├── exposed/
│   ├── ProcessOrder/
│   │   └── prompt.md         # EXPOSED - External partners can call this
│   └── CheckOrderStatus/
│       └── prompt.md         # EXPOSED - External partners can call this
└── internal/
    ├── ValidateInventory/
    │   └── prompt.md         # PRIVATE - Internal only
    ├── CalculatePricing/
    │   └── prompt.md         # PRIVATE - Internal only
    ├── CreateInvoice/
    │   └── prompt.md         # PRIVATE - Internal only
    └── external/
        └── TaxCalculator/    # Alias for external tax service
```

### agents.json Configuration

```json
{
  "TaxCalculator": {
    "url": "https://tax-service.com/a2a/agents/CalculateSalesTax",
    "description": "External tax calculation service"
  },
  "ShippingRates": {
    "url": "https://logistics.shaman.ai/a2a/agents/GetShippingRates",
    "aliases": ["Shipping", "ShipCalc"]
  }
}
```

### Example Agent: ProcessOrder (Exposed)

````markdown
---
name: ProcessOrder
description: Process incoming orders from partners
model: gpt-4
temperature: 0.3
exposed: true
tags: ["order-processing", "partner-api"]
mcpServers:
  database:
    access: "read"
  email:
    access: ["send_email"]
---

# Process Order Agent

You are an order processing agent for ACME Corp. Your job is to validate and process incoming orders from external partners.

## Your workflow:

1. First, validate the order data structure
2. Check inventory availability using the ValidateInventory agent
3. Calculate pricing using the CalculatePricing agent
4. Apply taxes using the TaxCalculator service
5. Create an invoice using the CreateInvoice agent
6. Return the complete order confirmation

## Available tools:

- `call_agent`: Call other agents in the system
- `query_database`: Read from the order database
- `send_email`: Send order confirmations

## Input format:

```json
{
  "customer": {
    "name": "string",
    "email": "string",
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "zip": "string"
    }
  },
  "items": [
    {
      "sku": "string",
      "quantity": "number"
    }
  ],
  "shipping_method": "standard|express|overnight"
}
```
````

Always be helpful and validate all data before processing.

````

### Example Agent: ValidateInventory (Private)

```markdown
---
name: ValidateInventory
description: Check product availability in warehouse
model: gpt-4
temperature: 0.1
exposed: false
tags: ["inventory", "internal"]
mcpServers:
  database:
    access: "*"
---

# Inventory Validation Agent

You validate product availability in ACME Corp's warehouse system.

Given a list of SKUs and quantities, check the inventory database and return availability status for each item.

Return format:
```json
{
  "available": boolean,
  "items": [
    {
      "sku": "string",
      "requested": number,
      "available": number,
      "status": "available|low_stock|out_of_stock"
    }
  ]
}
````

````

## Step-by-Step Flow

### 1. Partner Setup (One-time)

ACME Corp admin creates a service account for Widgets Inc:

```graphql
mutation CreatePartnerAccount {
  createServiceAccount(input: {
    orgId: "acme-corp"
    email: "api@widgets-inc.com"
    name: "Widgets Inc Integration"
    description: "Partner API access for order submission"
    type: SERVICE_ACCOUNT
    role: EXTERNAL_API_CLIENT
    allowedAgents: [
      "/agents/ProcessOrder",
      "/agents/CheckOrderStatus"
    ]
    apiKeyExpiry: "2025-12-31T23:59:59Z"
  }) {
    user {
      id  # "user_widgets_inc"
      email
      type
    }
    apiKey {
      key  # "sk_live_w1dg3t5_4bc123..." (shown only once!)
      keyPrefix
      expiresAt
    }
  }
}
````

ACME Corp shares the API key securely with Widgets Inc.

### 2. External API Call

Widgets Inc submits an order:

```bash
curl -X POST https://acme-corp.shaman.ai/a2a/v1 \
  -H "Authorization: Bearer sk_live_w1dg3t5_4bc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "widgets-order-001",
    "method": "message/send",
    "params": {
      "agentName": "ProcessOrder",
      "message": {
        "role": "user",
        "parts": [{
          "kind": "text",
          "text": "Process order for customer John Doe (john@example.com) at 123 Main St, San Francisco, CA 94105. Items: WIDGET-001 (qty: 5), GADGET-042 (qty: 2). Shipping: express"
        }]
      }
    }
  }'
```

### 3. API Gateway Processing

```typescript
// 1. Extract subdomain and route to correct org
const subdomain = extractSubdomain(req.hostname); // "acme-corp"
const org = await getOrgBySubdomain(subdomain);

// 2. Extract and validate API key
const apiKey = req.headers.authorization?.replace("Bearer ", "");
// "sk_live_w1dg3t5_4bc123..."

// 3. Query Permiso for API key validation
const validation = await permiso.query(
  `
  query ValidateApiKey($key: String!) {
    validateApiKey(key: $key) {
      valid
      apiKey {
        id
        userId      # "user_widgets_inc"
        orgId       # "acme-corp"
        status      # "ACTIVE"
        expiresAt   # "2025-12-31T23:59:59Z"
        user {
          email     # "api@widgets-inc.com"
          type      # "SERVICE_ACCOUNT"
          roles     # ["EXTERNAL_API_CLIENT"]
        }
        permissions {
          resourceId  # "/agents/ProcessOrder"
          action      # "execute"
        }
      }
      error
    }
  }
`,
  { key: apiKey },
);

// 4. Verify permissions for requested agent
const requestedAgent = "/agents/ProcessOrder";
const hasPermission = validation.apiKey.permissions.some(
  (p) => p.resourceId === requestedAgent && p.action === "execute",
);

if (!hasPermission) {
  return res.status(200).json({
    jsonrpc: "2.0",
    id: req.body.id,
    error: {
      code: -32004,
      message: "Unsupported operation",
      data: {
        agent: "ProcessOrder",
        reason: "API key does not have permission to execute this agent",
      },
    },
  });
}

// 5. Forward to Shaman Server with user context
const userContext = {
  userId: "user_widgets_inc",
  orgId: "acme-corp",
  email: "api@widgets-inc.com",
  authMethod: "api-key",
  apiKeyId: validation.apiKey.id,
  roles: ["EXTERNAL_API_CLIENT"],
};
```

### 4. Shaman Server Processing

```typescript
// 1. Create workflow run record
const workflowRun = await createWorkflowRun({
  id: generateId(), // "run_xyz789"
  orgId: userContext.orgId,
  userId: userContext.userId,
  authMethod: userContext.authMethod,
  apiKeyId: userContext.apiKeyId,
  rootAgent: "ProcessOrder",
  input: req.body,
  status: "pending",
  createdAt: new Date(),
});

// 2. Queue job for worker
await workflowQueue.add("execute-agent", {
  runId: workflowRun.id,
  orgId: userContext.orgId,
  userId: userContext.userId,
  agent: "ProcessOrder",
  input: req.body.context,
  prompt: req.body.prompt,
});

// 3. Return task ID to caller
return res.status(200).json({
  jsonrpc: "2.0",
  id: req.body.id,
  result: {
    taskId: `task_${workflowRun.id}`,
    contextId: `ctx_${generateId()}`,
    status: {
      state: "submitted",
      timestamp: new Date().toISOString(),
    },
  },
});
```

### 5. Shaman Worker Execution

The worker picks up the job and begins execution:

```typescript
// 1. Load ProcessOrder agent from Git repository
const agent = await resolveAgent({
  orgId: "acme-corp",
  agentName: "ProcessOrder",
  repository: "acme-corp-agents",
});

// 2. Initialize LLM with agent configuration
const llm = createLLM({
  model: agent.model, // "gpt-4"
  temperature: agent.temperature, // 0.3
});

// 3. Execute agent with tool access
const result = await executeAgent({
  agent,
  input: job.data.input,
  prompt: job.data.prompt,
  tools: {
    call_agent: createAgentCallTool(workflowContext),
    query_database: createDatabaseTool(agent.mcpServers),
    send_email: createEmailTool(agent.mcpServers),
  },
});
```

### 6. Agent-to-Agent Calls

ProcessOrder calls internal agents:

```typescript
// ProcessOrder wants to validate inventory
// This happens inside the LLM execution:

// Tool call 1: Check inventory
const inventoryCheck = await tools.call_agent({
  agent: "ValidateInventory",
  message: {
    role: "user",
    parts: [
      {
        type: "text",
        text: "Check availability for WIDGET-001 (qty: 5) and GADGET-042 (qty: 2)",
      },
    ],
  },
});

// Worker handles this:
// 1. Generate internal JWT token
const internalToken = generateJWT({
  iss: "shaman-worker",
  sub: workflowRun.id,
  aud: "ValidateInventory",
  orgId: "acme-corp",
  parentAgent: "ProcessOrder",
  exp: Date.now() + 300000, // 5 minutes
});

// 2. Execute ValidateInventory agent
// (No user token passed - only workflow context)

// Tool call 2: Calculate pricing
const pricing = await tools.call_agent({
  agent: "CalculatePricing",
  message: {
    role: "user",
    parts: [
      {
        type: "text",
        text: "Calculate total for available items with express shipping to CA 94105",
      },
    ],
  },
});

// Tool call 3: Calculate tax (external service via alias)
const tax = await tools.call_agent({
  agent: "TaxCalculator", // Resolved from agents.json
  message: {
    role: "user",
    parts: [
      {
        type: "text",
        text: "Calculate sales tax for $156.99 in San Francisco, CA 94105",
      },
    ],
  },
});

// This resolves to external A2A call:
// POST https://tax-service.com/a2a/v1
// {
//   "jsonrpc": "2.0",
//   "id": "tax-calc-001",
//   "method": "message/send",
//   "params": {
//     "agentName": "CalculateSalesTax",
//     "message": {...}
//   }
// }
```

### 7. Task Status Check

Widgets Inc polls for the result:

```bash
curl -X POST https://acme-corp.shaman.ai/a2a/v1 \
  -H "Authorization: Bearer sk_live_w1dg3t5_4bc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "widgets-poll-001",
    "method": "tasks/get",
    "params": {
      "ids": ["task_run_xyz789"]
    }
  }'
```

### 8. Audit Trail

Every action is logged:

```typescript
// Workflow run audit entry
{
  id: "audit_001",
  orgId: "acme-corp",
  userId: "user_widgets_inc",
  userEmail: "api@widgets-inc.com",
  runId: "run_xyz789",
  taskId: "task_run_xyz789",
  action: "workflow_started",
  resource: "ProcessOrder",
  authMethod: "api-key",
  apiKeyId: "key_abc123",
  timestamp: "2024-01-15T10:00:00Z",
  metadata: {
    ip: "203.0.113.42",
    userAgent: "WidgetsInc-OrderSystem/1.0"
  }
}

// Agent execution audit entries
{
  id: "audit_002",
  orgId: "acme-corp",
  userId: "user_widgets_inc",  // Original caller tracked
  runId: "run_xyz789",
  action: "agent_executed",
  resource: "ValidateInventory",
  authMethod: "internal-jwt",   // But executed with internal auth
  timestamp: "2024-01-15T10:00:05Z",
  metadata: {
    parentAgent: "ProcessOrder",
    duration: 523,
    tokenUsage: { prompt: 245, completion: 89 }
  }
}
```

### 9. Response to Partner

After all agents complete:

```json
{
  "jsonrpc": "2.0",
  "id": "widgets-poll-001",
  "result": {
    "tasks": [
      {
        "id": "task_run_xyz789",
        "contextId": "ctx_abc123",
        "status": {
          "state": "completed",
          "timestamp": "2024-01-15T10:05:00Z"
        },
        "artifacts": [
          {
            "type": "application/json",
            "name": "order-confirmation",
            "mimeType": "application/json",
            "data": {
              "orderId": "ORD-2024-0142",
              "status": "confirmed",
              "items": [
                {
                  "sku": "WIDGET-001",
                  "quantity": 5,
                  "unitPrice": 19.99,
                  "total": 99.95
                },
                {
                  "sku": "GADGET-042",
                  "quantity": 2,
                  "unitPrice": 28.52,
                  "total": 57.04
                }
              ],
              "subtotal": 156.99,
              "shipping": 15.0,
              "tax": 14.92,
              "total": 186.91,
              "estimatedDelivery": "2024-01-18",
              "invoiceNumber": "INV-2024-0142"
            }
          }
        ],
        "history": [
          {
            "timestamp": "2024-01-15T10:00:00Z",
            "type": "message",
            "message": {
              "role": "user",
              "parts": [
                {
                  "kind": "text",
                  "text": "Process order for customer John Doe..."
                }
              ]
            }
          },
          {
            "timestamp": "2024-01-15T10:00:05Z",
            "type": "message",
            "message": {
              "role": "assistant",
              "parts": [
                {
                  "kind": "text",
                  "text": "Processing your order. Validating inventory..."
                }
              ]
            }
          },
          {
            "timestamp": "2024-01-15T10:05:00Z",
            "type": "status",
            "status": { "state": "completed" }
          }
        ]
      }
    ]
  }
}
```

## Security Boundaries

### What Widgets Inc CAN do:

- ✅ Call `/agents/ProcessOrder`
- ✅ Call `/agents/CheckOrderStatus`
- ✅ View their own workflow runs
- ✅ Get results from their API calls

### What Widgets Inc CANNOT do:

- ❌ Call `/agents/ValidateInventory` directly (private)
- ❌ Call `/agents/CalculatePricing` directly (private)
- ❌ Access other organizations' agents
- ❌ See internal agent execution details
- ❌ Access the GraphQL management API
- ❌ Create or modify agents

### Internal Security:

- Internal agents don't see external API keys
- Each agent call gets a fresh JWT token
- Workflow context maintains audit trail
- No user credentials passed between agents

## Key Takeaways

1. **Two-layer security**: External API keys for perimeter, internal JWTs for agent-to-agent
2. **Service accounts**: No Kratos identity needed for API-only access
3. **Fine-grained permissions**: Partners can only call specific exposed agents
4. **Complete audit trail**: Every action tracked back to original caller
5. **Agent isolation**: Internal agents remain private and secure
6. **Seamless integration**: External services callable via agents.json aliases

---

**Navigation:**

- [← Previous: Authentication Guide](./09-authentication-guide.md)
- [🏠 Home](./README.md)
