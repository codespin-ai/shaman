# AgentCard Specification

The AgentCard is a JSON document that describes an agent's identity, capabilities, and how to interact with it. Every A2A-compliant agent MUST provide an AgentCard.

## Required Fields

### Basic Information

```json
{
  "protocolVersion": "0.3.0",        // A2A protocol version
  "name": "ProcessOrder",            // Human-readable name
  "description": "Processes incoming orders from external partners",
  "version": "1.0.0",                // Agent's own version
  "url": "https://api.acme.com/a2a/v1"  // Primary endpoint
}
```

### Transport Declaration

```json
{
  "preferredTransport": "JSONRPC",   // REQUIRED: Transport at main URL
  "additionalInterfaces": [          // Optional: Alternative transports
    {
      "url": "https://api.acme.com/a2a/v1",
      "transport": "JSONRPC"
    },
    {
      "url": "https://grpc.acme.com/a2a",
      "transport": "GRPC"
    }
  ]
}
```

Supported transport values:
- `"JSONRPC"` - JSON-RPC 2.0 over HTTP (default)
- `"GRPC"` - gRPC over HTTP/2
- `"HTTP+JSON"` - REST-style HTTP with JSON

### Capabilities

```json
{
  "capabilities": {
    "streaming": true,              // Supports Server-Sent Events
    "pushNotifications": true,      // Supports webhooks
    "stateTransitionHistory": false // Provides task state history
  }
}
```

### Skills

```json
{
  "skills": [
    {
      "id": "process-order",
      "name": "Order Processing",
      "description": "Validates and processes incoming orders",
      "tags": ["order", "processing", "validation"],
      "inputModes": ["application/json", "text/plain"],
      "outputModes": ["application/json"],
      "examples": [
        "Process order #12345",
        "{\"orderId\": \"12345\", \"items\": [...]}"
      ]
    }
  ]
}
```

### Input/Output Modes

```json
{
  "defaultInputModes": ["application/json", "text/plain"],
  "defaultOutputModes": ["application/json", "text/html"]
}
```

## Optional Fields

### Provider Information

```json
{
  "provider": {
    "organization": "ACME Corporation",
    "url": "https://www.acme.com"
  }
}
```

### Security

```json
{
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    },
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key"
    }
  },
  "security": [
    {"bearer": []},     // Option 1: Bearer token
    {"apiKey": []}      // Option 2: API key
  ]
}
```

### Additional Features

```json
{
  "iconUrl": "https://api.acme.com/icon.png",
  "documentationUrl": "https://docs.acme.com/agents/process-order",
  "supportsAuthenticatedExtendedCard": true,  // Has extended card for auth users
  "signatures": [...]  // Optional: JWS signatures for verification
}
```

## Complete Example

```json
{
  "protocolVersion": "0.3.0",
  "name": "ProcessOrder",
  "description": "Processes incoming orders with inventory validation and pricing",
  "version": "2.1.0",
  "url": "https://api.acme.com/a2a/v1",
  "preferredTransport": "JSONRPC",
  "additionalInterfaces": [
    {
      "url": "https://api.acme.com/a2a/v1",
      "transport": "JSONRPC"
    }
  ],
  "provider": {
    "organization": "ACME Corporation",
    "url": "https://www.acme.com"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": false
  },
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "security": [{"bearer": []}],
  "defaultInputModes": ["application/json", "text/plain"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    {
      "id": "process-standard-order",
      "name": "Standard Order Processing",
      "description": "Processes standard orders with inventory and pricing validation",
      "tags": ["order", "inventory", "pricing"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": [
        "{\"customer_id\": \"CUST-123\", \"items\": [{\"sku\": \"PROD-456\", \"quantity\": 2}]}"
      ]
    }
  ],
  "iconUrl": "https://api.acme.com/agents/process-order/icon.png",
  "documentationUrl": "https://docs.acme.com/agents/process-order"
}
```

## Discovery

AgentCards can be discovered through:

1. **Well-Known URI**: `https://{domain}/.well-known/agent-card.json`
2. **Direct Configuration**: Pre-configured URLs
3. **Registries**: Agent catalogs or directories
4. **Authenticated Endpoint**: Via `agent/authenticatedExtendedCard` method

## Shaman Implementation

In Shaman, AgentCards are:

1. **Auto-generated** from agent YAML frontmatter and repository configuration
2. **Served** at the agent's A2A endpoint
3. **Enhanced** with organization-specific security schemes
4. **Cached** for performance

Example agent YAML that generates an AgentCard:

```yaml
---
name: ProcessOrder
exposed: true
description: Processes incoming orders from external partners
model: gpt-4-turbo
temperature: 0.7
tags: ["order", "processing", "inventory"]
mcpServers:
  order-db:
    - "create_order"
    - "validate_inventory"
---

You are an order processing specialist...
```