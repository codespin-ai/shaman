# Complete A2A and MCP Flow Example

This example demonstrates a real-world scenario where multiple agents collaborate using A2A protocol while leveraging MCP tools, all within Shaman's multi-tenant architecture.

## Scenario Overview

An e-commerce platform needs to process a customer order that requires:
1. Inventory checking (InventoryAgent)
2. Fraud detection (FraudDetectionAgent)
3. Payment processing (PaymentAgent)
4. Order fulfillment (FulfillmentAgent)

The OrderProcessingAgent orchestrates this workflow, delegating tasks to specialized agents.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Customer Tenant                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Public Shaman Server                      │   │
│  │                    (--role public)                          │   │
│  │                                                             │   │
│  │  GraphQL Endpoint: https://api.acme.com/graphql           │   │
│  │  A2A Endpoint: https://api.acme.com/a2a/v1               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                     │
│                               │ HTTPS                               │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Internal Shaman Server                    │   │
│  │                    (--role internal)                        │   │
│  │                                                             │   │
│  │  A2A Endpoint: https://internal.acme.com/a2a/v1           │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │OrderProcessing│  │  Inventory   │  │FraudDetection  │   │   │
│  │  │    Agent     │  │    Agent     │  │     Agent      │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘   │   │
│  │         │                  │                   │            │   │
│  │         │              MCP │               MCP │            │   │
│  │         │                  ▼                   ▼            │   │
│  │         │           ┌──────────┐        ┌──────────┐       │   │
│  │         │           │PostgreSQL│        │Fraud API │       │   │
│  │         │           │  Server  │        │  Server  │       │   │
│  │         └───────────┴──────────┴────────┴──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent Configurations

### OrderProcessingAgent (Internal)

```yaml
---
name: OrderProcessingAgent
description: Orchestrates order processing workflow
model: gpt-4
temperature: 0.3
exposed: false
tools:
  - call_agent
  - workflow_data_write
  - workflow_data_read
---

You are an order processing orchestrator. When given an order, you must:
1. Check inventory for all items
2. Run fraud detection
3. Process payment if approved
4. Create fulfillment request
```

### InventoryAgent (Internal)

```yaml
---
name: InventoryAgent
description: Manages inventory and stock levels
model: gpt-4
temperature: 0.1
exposed: false
mcpServers:
  database:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres", "postgresql://inventory_db:5432/inventory"]
    tools:
      - "query_database"
      - "execute_transaction"
    env:
      POSTGRES_SCHEMA: "inventory"
---

You manage inventory. Use the database tools to check stock levels and manage reservations.
```

### FraudDetectionAgent (Internal)

```yaml
---
name: FraudDetectionAgent
description: Analyzes transactions for fraud patterns
model: gpt-4
temperature: 0.1
exposed: false
mcpServers:
  fraudapi:
    url: "https://fraud-service.internal/mcp"
    transport: "http+sse"
    headers:
      Authorization: "Bearer ${FRAUD_API_KEY}"
    tools:
      - "analyze_transaction"
      - "get_risk_score"
      - "check_blacklist"
---

You detect fraudulent transactions. Use the fraud detection tools to analyze orders.
```

## Complete Flow Example

### Step 1: Client Initiates Order

**GraphQL Request to Public Server:**
```graphql
mutation ProcessOrder {
  executeAgent(
    agentId: "OrderProcessingAgent",
    input: {
      orderId: "ORD-2024-001",
      customerId: "CUST-123",
      items: [
        { productId: "PROD-456", quantity: 2 },
        { productId: "PROD-789", quantity: 1 }
      ],
      paymentMethod: {
        type: "credit_card",
        last4: "1234",
        token: "tok_abc123"
      }
    }
  ) {
    success
    result
    executionId
  }
}
```

### Step 2: Public Server Routes to Internal Server

**A2A Request (Public → Internal):**
```http
POST https://internal.acme.com/a2a/v1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "jsonrpc": "2.0",
  "id": "pub-req-001",
  "method": "message/send",
  "params": {
    "agentName": "OrderProcessingAgent",
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Process order ORD-2024-001 for customer CUST-123 with items PROD-456 (qty: 2) and PROD-789 (qty: 1) using credit card ending in 1234"
      }]
    },
    "contextId": "ctx-order-001"
  }
}
```

### Step 3: OrderProcessingAgent Checks Inventory

**A2A Request (Internal → Internal):**
```http
POST https://internal.acme.com/a2a/v1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "jsonrpc": "2.0",
  "id": "order-inv-001",
  "method": "message/send",
  "params": {
    "agentName": "InventoryAgent",
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Check inventory for: PROD-456 (quantity: 2) and PROD-789 (quantity: 1)"
      }]
    },
    "contextId": "ctx-order-001"
  }
}
```

### Step 4: InventoryAgent Uses MCP Database Tool

**MCP Tool Call (stdio transport):**
```json
{
  "jsonrpc": "2.0",
  "id": "mcp-inv-001",
  "method": "tools/call",
  "params": {
    "name": "query_database",
    "arguments": {
      "query": "SELECT product_id, available_quantity FROM inventory WHERE product_id = ANY($1)",
      "parameters": [["PROD-456", "PROD-789"]]
    }
  }
}
```

**MCP Tool Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "mcp-inv-001",
  "result": {
    "content": [
      {
        "kind": "text",
        "text": "Query returned 2 rows:\n\nproduct_id | available_quantity\n-----------+------------------\nPROD-456   | 15\nPROD-789   | 3"
      }
    ],
    "isError": false
  }
}
```

**A2A Response (InventoryAgent → OrderProcessingAgent):**
```json
{
  "jsonrpc": "2.0",
  "id": "order-inv-001",
  "result": {
    "taskId": "task_inv_001",
    "contextId": "ctx-order-001",
    "status": {
      "state": "completed",
      "timestamp": "2024-03-15T10:31:00Z"
    },
    "artifacts": [{
      "type": "application/json",
      "name": "inventory-check",
      "mimeType": "application/json",
      "data": {
        "available": true,
        "items": [
          { "productId": "PROD-456", "available": 15, "requested": 2 },
          { "productId": "PROD-789", "available": 3, "requested": 1 }
        ]
      }
    }]
  }
}
```

### Step 5: OrderProcessingAgent Checks for Fraud

**A2A Request (Internal → Internal):**
```http
POST https://internal.acme.com/a2a/v1
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "jsonrpc": "2.0",
  "id": "order-fraud-001",
  "method": "message/send",
  "params": {
    "agentName": "FraudDetectionAgent",
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Analyze fraud risk for: customer CUST-123, amount $299.97, credit card ending 1234, order ORD-2024-001 with 2 items"
      }]
    },
    "contextId": "ctx-order-001"
  }
}
```

### Step 6: FraudDetectionAgent Uses MCP Fraud API

**MCP Tool Call (HTTP+SSE transport):**
```http
POST https://fraud-service.internal/mcp/messages
Content-Type: application/json
Authorization: Bearer fraud-api-key-123

{
  "jsonrpc": "2.0",
  "id": "mcp-fraud-001",
  "method": "tools/call",
  "params": {
    "name": "analyze_transaction",
    "arguments": {
      "customerId": "CUST-123",
      "amount": 299.97,
      "paymentType": "credit_card",
      "signals": {
        "newCustomer": false,
        "unusualAmount": false,
        "rushDelivery": false
      }
    }
  }
}
```

**MCP Tool Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "mcp-fraud-001",
  "result": {
    "content": [
      {
        "kind": "text",
        "text": "Risk Score: 12/100 (LOW)\nFlags: None\nRecommendation: APPROVE"
      }
    ],
    "isError": false
  }
}
```

### Step 7: Progress Notification

**A2A Progress Update (via SSE):**
```
id: 1710504720000
event: message
data: {"jsonrpc": "2.0", "id": "pub-req-001", "result": {"kind": "status-update", "taskId": "task-456", "contextId": "ctx-789", "status": {"state": "working", "message": {"kind": "message", "role": "agent", "messageId": "msg-002", "parts": [{"kind": "text", "text": "Inventory verified. Running fraud analysis..."}], "taskId": "task-456", "contextId": "ctx-789"}, "timestamp": "2024-03-15T10:32:00Z"}, "final": false}}

id: 1710504721000
event: message
data: {"jsonrpc": "2.0", "id": "pub-req-001", "result": {"kind": "status-update", "taskId": "task-456", "contextId": "ctx-789", "status": {"state": "working", "message": {"kind": "message", "role": "agent", "messageId": "msg-003", "parts": [{"kind": "text", "text": "Fraud check passed. Processing payment..."}], "taskId": "task-456", "contextId": "ctx-789"}, "timestamp": "2024-03-15T10:32:10Z"}, "final": false}}
```

### Step 8: Final Response Chain

**A2A Response (OrderProcessingAgent → Public Server):**
```json
{
  "jsonrpc": "2.0",
  "id": "pub-req-001",
  "result": {
    "taskId": "task_order_001",
    "contextId": "ctx-order-001",
    "status": {
      "state": "completed",
      "timestamp": "2024-03-15T10:35:00Z"
    },
    "artifacts": [{
      "type": "application/json",
      "name": "order-result",
      "mimeType": "application/json",
      "data": {
        "orderId": "ORD-2024-001",
        "status": "processing",
        "steps": {
          "inventory": "reserved",
          "fraud": "approved",
          "payment": "pending",
          "fulfillment": "queued"
        },
        "estimatedDelivery": "2024-03-20"
      }
    }],
    "history": [
      {
        "timestamp": "2024-03-15T10:30:00Z",
        "type": "message",
        "message": {
          "role": "user",
          "parts": [{"kind": "text", "text": "Process order ORD-2024-001..."}]
        }
      },
      {
        "timestamp": "2024-03-15T10:31:00Z",
        "type": "message",
        "message": {
          "role": "assistant",
          "parts": [{"kind": "text", "text": "Processing order. Checking inventory..."}]
        }
      },
      {
        "timestamp": "2024-03-15T10:35:00Z",
        "type": "status",
        "status": {"state": "completed"}
      }
    ]
  }
}
```

**GraphQL Response to Client:**
```json
{
  "data": {
    "executeAgent": {
      "success": true,
      "result": {
        "orderId": "ORD-2024-001",
        "status": "processing",
        "estimatedDelivery": "2024-03-20"
      },
      "executionId": "exec-12345"
    }
  }
}
```

## Authentication Flow

### 1. External Client → Public Server
- Uses API key or OAuth token
- Validated by public server's auth middleware

### 2. Public Server → Internal Server
- Uses internal JWT with short expiry
- Contains tenant context and permissions
- Signed with shared secret

### 3. Internal Agent → Internal Agent
- Reuses JWT from incoming request
- Adds agent-specific claims
- Maintains audit trail

### 4. Agent → MCP Server
- stdio: Inherits process credentials
- HTTP+SSE: Uses service-specific API keys

## Error Handling Examples

### MCP Tool Error
```json
{
  "jsonrpc": "2.0",
  "id": "mcp-inv-error",
  "result": {
    "content": [
      {
        "kind": "text",
        "text": "Error: Connection to database failed: ECONNREFUSED"
      }
    ],
    "isError": true
  }
}
```

### A2A Agent Error
```json
{
  "jsonrpc": "2.0",
  "id": "order-inv-001",
  "error": {
    "code": -32006,
    "message": "Invalid agent response",
    "data": {
      "agentName": "InventoryAgent",
      "details": "Database connection failed",
      "suggestion": "Check database connectivity and retry"
    }
  }
}
```

### Cascading Error Handling
```typescript
// In OrderProcessingAgent
try {
  const inventoryResult = await callAgent('InventoryAgent', checkRequest);
  if (!inventoryResult.success) {
    // Compensate - no reservation was made
    return {
      success: false,
      error: "Inventory check failed",
      rollback: []
    };
  }
  
  const fraudResult = await callAgent('FraudDetectionAgent', fraudRequest);
  if (!fraudResult.success) {
    // Compensate - release inventory reservation
    await callAgent('InventoryAgent', {
      action: 'release',
      items: reservedItems
    });
    return {
      success: false,
      error: "Fraud check failed",
      rollback: ['inventory_released']
    };
  }
} catch (error) {
  // System error - ensure cleanup
  await performEmergencyRollback();
  throw error;
}
```

## Security Implementation

### JWT Token Structure
```json
{
  "iss": "shaman-public-server",
  "sub": "tenant-acme",
  "aud": "shaman-internal-server",
  "exp": 1234567890,
  "iat": 1234567800,
  "jti": "unique-request-id",
  "tenant": {
    "id": "tenant-acme",
    "permissions": ["order.process", "inventory.read", "fraud.check"]
  },
  "agent": {
    "caller": "PublicGateway",
    "chain": ["OrderProcessingAgent"]
  }
}
```

### Resource Isolation
```yaml
# Each agent's MCP configuration is tenant-scoped
mcpServers:
  database:
    command: "npx"
    args: [
      "@modelcontextprotocol/server-postgres",
      "postgresql://localhost/tenant_${TENANT_ID}_inventory"
    ]
    env:
      TENANT_ID: "${context.tenantId}"
      POSTGRES_SCHEMA: "tenant_${TENANT_ID}"
```

## Monitoring and Observability

### Distributed Tracing
```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spans": [
    {
      "spanId": "00f067aa0ba902b7",
      "operationName": "GraphQL.executeAgent",
      "duration": 450
    },
    {
      "spanId": "00f067aa0ba902b8",
      "parentSpanId": "00f067aa0ba902b7",
      "operationName": "A2A.OrderProcessingAgent",
      "duration": 420
    },
    {
      "spanId": "00f067aa0ba902b9",
      "parentSpanId": "00f067aa0ba902b8",
      "operationName": "A2A.InventoryAgent",
      "duration": 150
    },
    {
      "spanId": "00f067aa0ba902ba",
      "parentSpanId": "00f067aa0ba902b9",
      "operationName": "MCP.query_database",
      "duration": 45
    }
  ]
}
```

### Audit Log Entry
```json
{
  "timestamp": "2024-03-15T10:30:00Z",
  "tenantId": "tenant-acme",
  "userId": "user-456",
  "action": "order.process",
  "resource": "ORD-2024-001",
  "agents": [
    {
      "name": "OrderProcessingAgent",
      "duration": 420,
      "delegatedTo": ["InventoryAgent", "FraudDetectionAgent"]
    }
  ],
  "mcpTools": [
    {
      "tool": "query_database",
      "server": "postgres",
      "duration": 45
    },
    {
      "tool": "analyze_transaction",
      "server": "fraudapi",
      "duration": 120
    }
  ],
  "result": "success"
}
```

## Key Takeaways

1. **Protocol Separation**: A2A handles agent-to-agent communication, MCP handles agent-to-tool communication
2. **Multi-Tenant Isolation**: Each tenant's data and operations are completely isolated
3. **Two-Server Architecture**: Public server for external access, internal server for agent execution
4. **Security Layers**: JWT for A2A auth, API keys for MCP auth, tenant isolation throughout
5. **Error Handling**: Graceful degradation with compensation actions
6. **Observability**: Full distributed tracing across protocols and services