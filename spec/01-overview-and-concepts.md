[🏠 Home](./README.md) | [Next: Use Cases & Agent Model →](./02-use-cases-and-agent-model.md)

---

# Overview and Concepts

## What Shaman Is

Shaman is a backend framework that serves as the central orchestration hub in a federated agent ecosystem. The system handles three main responsibilities: managing AI agents as code through git repositories, serving as a fully compliant Agent2Agent (A2A) protocol gateway, and providing enterprise-grade control plane functionality with git synchronization, permissions, and audit trails.

The framework allows organizations to define AI agents in git repositories as markdown files with frontmatter configuration. This approach enables familiar development workflows including version control, collaboration, and deployment processes. At the same time, Shaman can both expose these internal git-based agents to external systems via the A2A protocol and consume external A2A-compliant agents seamlessly.

## Core Design Principles

**Agents as Code**: AI agents live in git repositories as markdown files with YAML frontmatter. This brings software development practices to agent management - version control, branching, pull requests, and deployment pipelines all work naturally.

**Protocol Interoperability**: The system natively supports both MCP (Model Context Protocol) for tools and A2A (Agent2Agent) for agent federation. Internal agents can call external A2A agents, and internal agents can be exposed via A2A to external consumers.

**Bidirectional Federation**: Internal git-based agents can be exposed externally while consuming external A2A agents. This creates a two-way federation where organizations can both share and consume specialized capabilities.

**Dynamic Execution**: Workflows form complex DAGs at runtime based on agent decisions. Agents can call other agents, which can call more agents, creating dynamic execution trees that adapt to the specific requirements of each request.

**Pluggable Infrastructure**: Critical components like workflow engines, LLM providers, and storage systems can be swapped via adapter patterns. Development can use BullMQ while production uses Temporal.io, for example.

**Observable by Design**: OpenTelemetry tracing, structured logging, and comprehensive metrics are built into every component. Every agent call, tool execution, and state transition is tracked and can be analyzed.

**Enterprise Ready**: The system includes git synchronization, agent namespacing, authentication, authorization, and comprehensive audit trails. It's designed for organizations that need governance and compliance.

**Explicit Agent Completion**: Agents must explicitly signal completion using standardized tools. This provides reliable parent-child coordination and eliminates ambiguity about when an agent has finished its work.

**Unified Tool/Agent Interface**: Agents call both tools and other agents through the same mechanism. From an agent's perspective, calling another agent looks identical to calling a tool, which simplifies the programming model.

## Core Entities

**Provider**: A configured LLM service endpoint like OpenAI, Anthropic, or a local Ollama instance. Providers are defined statically in configuration with connection details and authentication credentials.

**Agent Repository**: A git repository containing agent definitions as markdown files with frontmatter. Repositories can be root (unnamespaced) or namespaced. Root repositories allow agents to be called directly by name, while namespaced repositories require a prefix.

**Agent Definition**: A markdown file with YAML frontmatter containing agent configuration (name, description, model, permissions) plus a prompt template. The frontmatter defines what the agent can do, and the markdown content defines how it behaves.

**Directory**: A hierarchical structure within git repositories. Agents can be organized in nested folders like `/sales/pr-agent` or `/support/billing-agent`, enabling logical grouping and navigation.

**Tag**: Keywords defined in agent frontmatter for discovery and categorization. Tags support filtering and search across the agent ecosystem.

**MCP Server**: A service exposing tools via the Model Context Protocol. These can be local processes (STDIO), remote HTTP endpoints, or external A2A-compliant agents. The system abstracts these differences so agents can use tools consistently.

**Tool**: A function exposed by an MCP Server with JSON Schema definition, usage statistics, and permission controls. Tools provide the concrete capabilities that agents use to accomplish tasks.

**External A2A Agent**: An agent from an external system implementing the A2A protocol. These are registered in Shaman for consumption by internal agents, enabling cross-organizational agent collaboration.

## Execution Entities

**Run**: The top-level execution instance with a unique ID. A run represents the complete fulfillment of a user request and contains all the steps, agent calls, and data involved in processing that request.

**Step**: A single agent execution within a run. Each step has its own conversation history, token usage tracking, execution timeline, and parent-child relationships. Steps form the nodes in the execution DAG.

**Memory**: Persistent data saved by agents with structured key-value storage. Memory can be accessed across runs, has namespace isolation by agent, and supports expiration policies for cleanup.

**Message**: Individual conversation turns with role-based typing (system, user, assistant, tool). Messages support extensible part systems for different content types.

**Stream Chunk**: Real-time execution events pushed via WebSocket subscriptions. Clients can subscribe to token streams, tool calls, agent calls, and completion events.

**Input Request**: User input requirements generated by agents using the `request_user_input` tool. These are stored with context and can be resolved later by users or automated systems.

## Agent Management Model

### Git-Based Agent Definitions

Agents are defined as markdown files with YAML frontmatter in git repositories. Here's a complete example:

```markdown
---
name: "CustomerSupportAgent"
description: "Handles customer inquiries about orders, returns, and account issues"
version: "2.1.0"
tags: ["customer-support", "tier-1", "orders"]
model: "gpt-4-turbo"
providers: ["openai_gpt4"]
mcpServers: ["order-management", "customer-db", "refund-processor"]
allowedAgents: ["BillingSpecialist", "EscalationManager"]
examples:
  - "Help customer with order status inquiry"
  - "Process return request for damaged item"
---

You are a Tier 1 Customer Support Agent for an e-commerce platform. Your role is to help customers with their inquiries efficiently and escalate complex issues when needed.

## Available Tools

Your tools will be automatically injected based on configured MCP servers.

## Available Agents

You can delegate to: {{allowed_agents}}

Your task: {{prompt}}
```

### Repository Structure and Namespacing

Root repositories contain unnamespaced agents that can be called directly:

```
main-agents/
├── sales/pr-agent/prompt.md          → "sales/pr-agent"
├── support/billing-agent/prompt.md   → "support/billing-agent"
└── public/demo-agent/prompt.md       → "public/demo-agent"
```

Namespaced repositories require a prefix based on the repository name:

```
experimental-agents/
├── nlp/sentiment/prompt.md           → "experimental/nlp/sentiment"
└── vision/object-detect/prompt.md    → "experimental/vision/object-detect"
```

### Agent Resolution Strategy

When an agent calls another agent, the system resolves the target agent in this order:

1. Check root repositories first for unnamespaced access
2. Parse namespace prefixes and check specific namespaced repositories
3. Check registered external A2A agents
4. Return an error if the agent isn't found anywhere

### Explicit Completion Model

All agent-to-agent calls use explicit completion. Child agents must call a `complete_agent_execution` tool to signal task completion. This provides clear completion semantics, structured results, partial completion support when agents are blocked or uncertain, and reliable parent coordination.

## Standard System Tools

All agents automatically have access to these system tools:

### Agent Coordination Tools

**call_agent**: Delegates a task to another specialized agent (internal or external). Takes the agent name, input description, and context scope. This is how agents compose and delegate work to other agents.

**complete_agent_execution**: Signals completion of the agent's task. This is required to finish execution and provides the final result, status (SUCCESS/PARTIAL/FAILED), confidence level, whether follow-up is needed, and optional metadata.

### User Interaction Tools

**request_user_input**: Requests input from the user and pauses execution until a response is received. Supports different input types (text, choice, file, approval), optional choices for selection, required/optional input, and timeout handling.

These system tools provide the fundamental capabilities every agent needs: calling other agents, completing execution, interacting with users, and managing persistent state. They're injected automatically so agents don't need to configure them explicitly.

---

**Navigation:**

- [🏠 Home](./README.md)
- [Next: Use Cases & Agent Model →](./02-use-cases-and-agent-model.md)
