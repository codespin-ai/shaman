[🏠 Home](./README.md) | [Next: Use Cases & Agent Model →](./02-use-cases-and-agent-model.md)

---

# Overview and Concepts

## What Shaman Is

Shaman is a multi-tenant backend framework for managing and orchestrating AI agents through a federated ecosystem. Each organization gets its own isolated environment with agents defined as code in git repositories. The system provides enterprise-grade control with authentication, authorization, and comprehensive audit trails while enabling seamless agent-to-agent collaboration both within and across organizations.

The framework allows organizations to define AI agents in git repositories as markdown files with YAML frontmatter. These agents can be exposed as public API endpoints or kept private for internal workflows. Shaman handles the complexity of multi-tenancy, security, and orchestration while keeping agent authoring simple and accessible to non-technical users.

## Core Design Principles

**Multi-Tenant by Design**: Each organization operates in complete isolation with its own subdomain, repositories, and agents. Organizations cannot access each other's resources without explicit API calls.

**Agents as Code**: AI agents live in git repositories as markdown files with YAML frontmatter. This brings software development practices to agent management - version control, branching, pull requests, and deployment pipelines.

**Two-Layer Security**: External API calls are authenticated at the perimeter, while internal agent-to-agent calls use workflow-scoped JWT tokens. This ensures security without exposing complexity to agent authors.

**Dynamic Workflow Execution**: Workflows form Directed Acyclic Graphs (DAGs) at runtime. When an exposed agent is called, it triggers a workflow that can fan out to multiple agents in parallel or sequence.

**Simple Agent Authoring**: Agents are written in plain English with no knowledge of authentication, tokens, or infrastructure. Technical complexity is handled by the Shaman runtime.

**Protocol Interoperability**: Native support for both MCP (Model Context Protocol) for tools and A2A (Agent2Agent) for cross-system agent federation.

**Observable by Design**: OpenTelemetry tracing and structured logging throughout. Every agent call, tool execution, and workflow step is tracked for debugging and compliance.

**Pluggable Infrastructure**: Workflow engines, LLM providers, and storage systems can be swapped via adapter patterns. Use BullMQ in development and Temporal in production.

## Core Entities

### Identity & Multi-Tenancy

**Organization (Tenant)**: The primary unit of isolation. Each organization has its own subdomain (e.g., `acme-corp.shaman.ai`), users, repositories, and agents. Organizations are completely isolated from each other.

**User**: An individual identity belonging to an organization. Authentication is handled by Ory Kratos while authorization and user data are managed by Permiso. Shaman maintains local mirrors of user data for performance.

### Agent Management

**Repository**: A git repository linked to an organization containing agent definitions and configuration. Each repository includes an `agents.json` file for aliasing and configuration.

**Agent**: The fundamental unit of work - a stateless service that performs a specific task using an LLM. Agents are defined as markdown files with YAML frontmatter.

**Exposed Agent**: An agent accessible via public API endpoint at the organization's subdomain. These serve as entry points to workflows and can be called by external systems.

**Private Agent**: An agent that can only be called by other agents within the same repository. Private agents have no public endpoints and are used for internal workflow steps.

### Execution

**Workflow**: A DAG of agent executions triggered when an exposed agent is called. The workflow engine orchestrates parallel and sequential execution of agents.

**Run**: A complete workflow execution with a unique ID, representing the fulfillment of a user request from start to finish.

**Step**: A single agent execution within a run. Steps form the nodes of the workflow DAG and track conversation history, token usage, and timing.

**Tool**: An external capability that agents can use, exposed via MCP (Model Context Protocol). Tools can be databases, APIs, or other services.

## Agent Management Model

### Git-Based Agent Definitions

Agents are markdown files with YAML frontmatter in git repositories:

```markdown
---
name: "ProcessInvoice"
description: "Processes incoming invoices for payment"
version: "1.0.0"
tags: ["finance", "invoicing"]
model: "gpt-4-turbo"
exposed: true  # This makes it an exposed agent
mcpServers:
  invoice-db:
    - "get_invoice"
    - "update_status"
  payment-system: "*"  # Full access to payment tools
---

You are an invoice processing specialist. When given an invoice, you should:

1. Validate the invoice data
2. Check for duplicates
3. Calculate any taxes
4. Prepare for payment processing

Available tools and agents are automatically provided by the system.

Your task: {{prompt}}
```

### Repository Configuration

Each repository includes an `agents.json` file for configuration:

```json
{
  "TaxCalculator": {
    "url": "https://tax-service.com/a2a/agents/CalculateTax",
    "aliases": ["Tax", "TaxCalc"]
  },
  "InternalAuditor": {
    "url": "compliance/audit/InternalAuditor",
    "aliases": ["Auditor"]
  },
  "CurrencyConverter": {
    "url": "https://finance.apis.com/a2a/agents/Convert"
  }
}
```

This allows agents to use simple names when calling other agents, whether they're external services or deeply nested internal agents.

### Agent Calling Rules

**Exposed agents** can:
- Call any private agent in the same repository
- Call external agents via full A2A URLs or aliases

**Private agents** can:
- Call other agents in the same repository by name
- Call external agents only via the external gateway

All agent calling is done through the `call_agent` tool, making it as simple as any other tool call.

## Security Model

### Two-Layer Architecture

**Layer 1: Perimeter Security**
- Applies to exposed agents only
- API Gateway validates user tokens with Ory Kratos
- Authorizes requests with Permiso
- User tokens never enter the internal system

**Layer 2: Internal Security**
- Workflow engine generates short-lived JWT tokens
- Tokens represent the workflow run, not the user
- Each internal call is authenticated with these workflow JWTs
- Original user token is maintained by infrastructure for auditing

### Zero-Trust Internal Calls

When the workflow engine calls agents internally:
1. Generates a workflow-scoped JWT token
2. Token includes: issuer (shaman-worker), audience (target agent), run ID, org ID
3. Target agent's infrastructure validates the token
4. Agent itself never sees or handles authentication

## Standard System Tools

All agents automatically have access to:

**call_agent**: Delegate tasks to other agents (internal or external)
```json
{
  "agent": "TaxCalculator",  // Or full URL for external
  "task": "Calculate tax for $1000 in California"
}
```

**complete_agent_execution**: Signal task completion (required)
```json
{
  "result": "Tax calculated: $87.50",
  "status": "SUCCESS"
}
```

**request_user_input**: Request information from users
```json
{
  "prompt": "Please provide the invoice number",
  "type": "text",
  "required": true
}
```

## Multi-Tenant Architecture

Each organization operates in complete isolation:

- **Dedicated subdomain**: `acme-corp.shaman.ai`
- **Isolated repositories**: Only accessible by the organization
- **Separate agent namespace**: No conflicts between organizations
- **Independent user management**: Via Ory Kratos and Permiso
- **Isolated workflow execution**: Workflows run in org context

External systems interact with organizations through their subdomains, ensuring clear separation and security boundaries.

---

**Navigation:**

- [🏠 Home](./README.md)
- [Next: Use Cases & Agent Model →](./02-use-cases-and-agent-model.md)