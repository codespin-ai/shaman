# AgentCard Documentation

## Overview

Shaman automatically generates AgentCards compliant with the A2A Protocol v0.3.0 specification. AgentCards provide a standardized way to describe agent capabilities, making them discoverable and interoperable across different A2A-compliant systems.

## AgentCard Generation

### From Agent YAML Frontmatter

When you define an agent in Shaman, the system automatically generates an AgentCard:

**Agent Definition:**

```yaml
---
name: CustomerSupport
description: Handles customer inquiries and support requests
model: gpt-4
temperature: 0.7
exposed: true # Must be true to appear in AgentCard
tools:
  - run_data_read
  - run_data_write
  - call_agent
tags: ["support", "customer-service"]
---
You are a helpful customer support agent...
```

**Generated AgentCard:**

```json
{
  "protocolVersion": "0.3.0",
  "name": "CustomerSupport",
  "description": "Handles customer inquiries and support requests",
  "version": "1.0.0",
  "url": "https://acme.shaman.ai/a2a/v1",
  "preferredTransport": "JSONRPC",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateHistory": true
  },
  "skills": [
    {
      "name": "customer-inquiries",
      "description": "Handle general customer questions and concerns",
      "examples": [
        "What are your business hours?",
        "How do I return a product?"
      ]
    }
  ],
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "description": "API key authentication"
    }
  },
  "provider": {
    "name": "ACME Corp",
    "url": "https://acme.com"
  }
}
```

## Discovery Endpoints

### Well-Known URI

Discover all exposed agents:

```http
GET /.well-known/a2a/agents
Authorization: Bearer {api_key}
```

**Response:**

```json
{
  "protocolVersion": "0.3.0",
  "agents": [
    {
      "name": "CustomerSupport",
      "description": "Handles customer inquiries and support requests",
      "version": "1.0.0",
      "url": "https://acme.shaman.ai/a2a/v1",
      "preferredTransport": "JSONRPC"
    },
    {
      "name": "OrderProcessor",
      "description": "Processes customer orders",
      "version": "1.0.0",
      "url": "https://acme.shaman.ai/a2a/v1",
      "preferredTransport": "JSONRPC"
    }
  ]
}
```

### Individual Agent Details

Get detailed AgentCard for a specific agent:

```http
GET /a2a/v1/agents/{agentName}
Authorization: Bearer {api_key}
```

**Response:**

```json
{
  "protocolVersion": "0.3.0",
  "name": "CustomerSupport",
  "description": "Handles customer inquiries and support requests",
  "version": "1.0.0",
  "url": "https://acme.shaman.ai/a2a/v1",
  "preferredTransport": "JSONRPC",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateHistory": true,
    "multiModal": false,
    "parallelToolCalls": true
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Customer question or concern"
      },
      "customerId": {
        "type": "string",
        "description": "Optional customer identifier"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "response": {
        "type": "string",
        "description": "Agent's response to the customer"
      },
      "followUpRequired": {
        "type": "boolean",
        "description": "Whether human follow-up is needed"
      }
    }
  },
  "skills": [
    {
      "name": "order-tracking",
      "description": "Track order status and shipping information",
      "examples": ["Where is my order #12345?", "When will my package arrive?"]
    },
    {
      "name": "refunds",
      "description": "Process refund requests",
      "examples": ["I want to return this item", "Can I get a refund?"]
    }
  ],
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "description": "API key authentication required"
    }
  }
}
```

## Authenticated Extended Card

For authenticated users, additional capabilities may be exposed:

```http
POST /a2a/v1
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "agent/authenticatedExtendedCard",
  "params": {
    "agentName": "CustomerSupport"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "protocolVersion": "0.3.0",
    "name": "CustomerSupport",
    "description": "Handles customer inquiries and support requests",
    "version": "1.0.0",
    "url": "https://acme.shaman.ai/a2a/v1",
    "preferredTransport": "JSONRPC",
    "capabilities": {
      "streaming": true,
      "pushNotifications": true,
      "stateHistory": true
    },
    "additionalCapabilities": {
      "debugMode": true,
      "internalTools": ["database_query", "admin_override"],
      "maxTokens": 4096,
      "costPerToken": 0.00002
    },
    "rateLimits": {
      "requestsPerMinute": 100,
      "tokensPerDay": 1000000
    }
  }
}
```

## AgentCard Fields

### Required Fields

- `protocolVersion`: Always "0.3.0" for current A2A spec
- `name`: Unique agent identifier
- `description`: Human-readable description
- `version`: Agent version (semantic versioning)
- `url`: Base URL for A2A endpoint

### Optional Fields

- `preferredTransport`: "JSONRPC" (default), "GRPC", or "HTTP+JSON"
- `capabilities`: Feature support flags
- `skills`: Specific capabilities with examples
- `inputSchema`: JSON Schema for expected inputs
- `outputSchema`: JSON Schema for outputs
- `securitySchemes`: Authentication requirements
- `provider`: Organization information
- `tags`: Searchable tags
- `icon`: Agent icon URL
- `supportUrl`: Where to get help

## Capability Flags

```typescript
interface Capabilities {
  streaming?: boolean; // Supports message/stream
  pushNotifications?: boolean; // Supports webhook callbacks
  stateHistory?: boolean; // Maintains conversation history
  multiModal?: boolean; // Accepts images/audio/video
  parallelToolCalls?: boolean; // Can execute multiple tools at once
  authentication?: boolean; // Requires authentication
  rateLimit?: boolean; // Has rate limiting
}
```

## Security Schemes

Shaman supports standard A2A security schemes:

```json
{
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "description": "API key in Authorization header"
    },
    "oauth2": {
      "type": "oauth2",
      "flows": {
        "authorizationCode": {
          "authorizationUrl": "https://acme.shaman.ai/oauth/authorize",
          "tokenUrl": "https://acme.shaman.ai/oauth/token",
          "scopes": {
            "agent:read": "Read agent information",
            "agent:execute": "Execute agents"
          }
        }
      }
    }
  }
}
```

## Controlling AgentCard Visibility

### Public vs Internal Agents

Only agents with `exposed: true` appear in public AgentCards:

```yaml
---
name: PublicAgent
exposed: true # Appears in /.well-known/a2a/agents
---

---
name: InternalAgent
exposed: false # Only accessible internally
---
```

### Server Roles

- **Public A2A Server** (`--role public`): Only shows exposed agents
- **Internal A2A Server** (`--role internal`): Shows all agents

### Custom AgentCard Fields

Add custom fields via frontmatter:

```yaml
---
name: SpecializedAgent
description: Advanced data analysis
exposed: true
agentcard:
  skills:
    - name: "data-visualization"
      description: "Create charts and graphs"
      examples: ["Create a bar chart", "Show trend analysis"]
  customFields:
    supportedFormats: ["csv", "json", "excel"]
    maxFileSize: "10MB"
---
```

## Federation and External Agents

Define external agents in `agents.json`:

```json
{
  "PartnerAgent": {
    "url": "https://partner.com/a2a/v1",
    "agentName": "DataProcessor",
    "agentCard": {
      "protocolVersion": "0.3.0",
      "name": "DataProcessor",
      "description": "External data processing service",
      "capabilities": {
        "streaming": false,
        "pushNotifications": true
      }
    }
  }
}
```

## Best Practices

1. **Clear Descriptions**: Write descriptive agent descriptions
2. **Version Management**: Use semantic versioning for agents
3. **Skill Examples**: Provide realistic examples for each skill
4. **Schema Definition**: Define clear input/output schemas
5. **Security**: Only expose necessary agents publicly
6. **Documentation**: Link to detailed docs in supportUrl

## Troubleshooting

### Agent Not Appearing in AgentCard

Check:

1. `exposed: true` in frontmatter
2. Agent file is in Git repository
3. Repository has been synced
4. Using public A2A server for external access

### Invalid AgentCard

Validate:

1. Required fields present
2. Valid protocol version (0.3.0)
3. Proper JSON structure
4. URL is accessible

### Authentication Issues

Ensure:

1. API key has agent discovery permissions
2. Security schemes properly configured
3. Bearer token format is correct
