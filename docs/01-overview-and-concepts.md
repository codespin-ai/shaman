[🏠 Home](./README.md) | [Next: Use Cases & Agent Model →](./02-use-cases-and-agent-model.md)

---

# Overview and Concepts

## What is Shaman?

Shaman is a **multi-tenant AI agent orchestration platform** that enables organizations to build, deploy, and manage AI agents at scale. It provides enterprise-grade security, complete tenant isolation, and seamless agent collaboration through industry-standard protocols.

Key features:
- **Two-server architecture** separating public API from agent execution
- **A2A protocol** for all agent-to-agent communication over HTTP
- **MCP protocol** for agent-to-tool communication (configured in Git repos)
- **Git-based agent management** with version control
- **Multi-tenant isolation** with subdomain routing
- **Enterprise security** with dual authentication models

## Core Architecture Principles

### 1. Two-Server Deployment Model

Shaman separates concerns with distinct server roles:

```
Public Server (--role public)
├─ Handles external traffic
├─ GraphQL management API
├─ Authentication gateway
├─ A2A public endpoint
└─ Forwards to internal server

Internal Server (--role internal)
├─ Executes agents
├─ Not internet accessible
├─ JWT authentication only
├─ MCP tool orchestration (reads config from Git)
└─ A2A agent communication
```

### 2. Protocol-Based Communication

All communication uses standardized protocols:

- **A2A (Agent-to-Agent)**: HTTP-based protocol with JWT authentication
- **MCP (Model Context Protocol)**: Tool access via stdio or HTTP+SSE (configured in agent YAML)
- **No direct function calls**: Everything goes through protocols

### 3. Git-Centric Agent Management

Agents are:
- Defined as Markdown files with YAML frontmatter
- Stored in Git repositories for version control
- Automatically synced and cached by commit hash
- Support branching and pull request workflows

### 4. True Multi-Tenancy

Each organization operates in complete isolation:
- Unique subdomain (e.g., `acme.shaman.ai`)
- Separate database schemas/instances
- Isolated agent namespaces
- Independent user management
- No shared resources

### 5. Security-First Design

Multiple security layers:
- **External**: API Gateway with Kratos/Permiso
- **Internal**: JWT tokens for A2A calls
- **Execution**: Isolated agent contexts
- **Audit**: Complete operation tracking

## Key Concepts

### Organizations (Tenants)

The primary unit of isolation in Shaman. Each organization:
- Has a unique subdomain for API access
- Maintains separate users and permissions
- Owns repositories containing agents
- Cannot access other organizations' resources

Example:
```
Organization: ACME Corp
Subdomain: acme.shaman.ai
Users: alice@acme.com, bob@acme.com
Repositories: customer-support, internal-tools
```

### Agents

AI-powered services that perform specific tasks. Two types:

**Exposed Agents**
- Accessible via public A2A endpoints
- Entry points for workflows
- Require API key authentication
- Can delegate to other agents

**Internal Agents**
- Only callable by other agents via A2A
- No public endpoints
- Used for workflow decomposition
- Accessed via internal JWT tokens

Example agent definition:
```yaml
---
name: ProcessOrder
description: Handles order processing workflow
exposed: true
model: gpt-4
temperature: 0.7
mcpServers:
  database:
    command: "mcp-postgres-server"
    tools: ["query_database", "update_order"]
  payment:
    url: "https://payment-tools.internal/mcp"
    transport: "http+sse"
    tools: ["charge_card", "refund"]
---

You process orders by validating inventory, charging payment, and creating shipments.

Task: {{prompt}}
```

### Repositories

Git repositories containing agent definitions:

```
customer-support/
├── agents.json          # Agent aliases and config
├── OrderProcessor/
│   └── prompt.md       # Exposed agent
├── InventoryChecker/
│   └── prompt.md       # Internal agent
└── PaymentProcessor/
    └── prompt.md       # Internal agent
```

The `agents.json` file maps aliases to agents:
```json
{
  "TaxCalculator": {
    "url": "https://tax-service.com/a2a/v1/agents/CalculateTax",
    "aliases": ["Tax", "TaxCalc"]
  },
  "Inventory": {
    "url": "InventoryChecker",
    "aliases": ["Stock", "InventoryCheck"]
  }
}
```

### Workflows

Dynamic execution graphs created when exposed agents are called:

```
External Call → ProcessOrder (Exposed)
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
InventoryChecker  FraudDetector  (Parallel)
      │              │
      └──────┬───────┘
             ▼
      PaymentProcessor
             │
             ▼
        ShipmentCreator
```

### Tools (via MCP)

External capabilities agents can use:

- **Database access**: Query and update data
- **API calls**: Interact with external services
- **File operations**: Read/write files
- **Custom tools**: Any capability exposed via MCP
- **Platform tools**: Built-in workflow data management

Tools are configured in agent YAML frontmatter (stored in Git):
```yaml
mcpServers:
  production_db:
    command: "mcp-postgres"
    args: ["--connection", "${PROD_DB_URL}"]
    tools:
      - "query_database"    # Read only
      - "list_tables"
      # - "execute_ddl"     # Not allowed
```

## Security Model

### Three-Layer Security

**Layer 1: Perimeter (Public Server)**
- API Gateway validates all requests
- Ory Kratos for session management
- Permiso for RBAC and API keys
- Rate limiting and DDoS protection

**Layer 2: Internal Communication (A2A)**
- JWT tokens for agent-to-agent calls
- Short-lived tokens (5 minutes)
- Workflow context in token claims
- No user credentials in internal calls

**Layer 3: Agent Execution (Internal Server)**
- Isolated execution contexts
- MCP permissions defined in agent YAML
- Resource limits per agent
- Comprehensive audit logging

### Authentication Methods

**Human Users (UI/Management)**
```
Browser → Session Cookie → Kratos → Permiso → GraphQL API
```

**API Access (External Systems)**
```
System → API Key → Permiso (Key→User) → A2A Endpoint
```

**Internal Agent Calls**
```
Agent A → JWT Token → A2A Protocol → Agent B
```

## Communication Flows

### External Agent Invocation

1. External system calls exposed agent with API key
2. Public server validates key and permissions
3. Public server creates workflow and JWT token
4. Public server calls internal server via A2A
5. Internal server executes agent
6. Result returned through chain

### Agent-to-Agent Communication

1. Agent A decides to call Agent B
2. Internal server generates JWT for the call
3. A2A request sent with JWT authentication
4. Agent B executes and returns result
5. Agent A continues with result

### Tool Execution via MCP

1. Agent needs to use a tool
2. MCP client connects to configured server
3. Tool discovery and schema validation
4. Tool execution with parameters
5. Result returned to agent

## Deployment Topology

### Development
```
Docker Compose
├─ PostgreSQL
├─ Redis
├─ Shaman Public (port 3000)
├─ Shaman Internal (port 4000)
└─ MCP Servers (various)
```

### Production
```
Load Balancer
├─ Public Servers (3+)
│   └─ Connect to Internal LB
├─ Internal Load Balancer
│   └─ Internal Servers (5+)
├─ RDS PostgreSQL (Multi-AZ)
├─ ElastiCache Redis
└─ Temporal/BullMQ Workers
```

## Key Benefits

1. **Standards Compliance**: Uses A2A and MCP protocols for interoperability
2. **Security**: Multiple authentication layers and complete isolation
3. **Scalability**: Independent scaling of public and internal tiers
4. **Flexibility**: Pluggable components for different needs
5. **Simplicity**: Agents written in plain English, complexity hidden
6. **Auditability**: Every operation tracked and logged
7. **Multi-Tenancy**: True isolation between organizations

## Next Steps

- Continue to [Use Cases & Agent Model](./02-use-cases-and-agent-model.md) to see practical examples
- Review [System Architecture](./03-system-architecture.md) for detailed technical design
- Follow [Deployment & Configuration](./04-deployment-and-configuration.md) to set up Shaman

---

[🏠 Home](./README.md) | [Next: Use Cases & Agent Model →](./02-use-cases-and-agent-model.md)