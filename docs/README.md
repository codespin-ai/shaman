# Shaman Documentation

Shaman is a multi-tenant AI agent orchestration platform that enables organizations to build, deploy, and manage AI agents at scale. It provides enterprise-grade security, complete tenant isolation, and seamless agent collaboration through industry-standard protocols.

## 🏗️ Architecture Overview

Shaman uses a **two-server deployment model** for security and scalability:

```
┌─────────────────────────────────────────────────────────────┐
│                    External Traffic                          │
│                                                              │
│  Browser/Apps ──────────► Public Server (--role public)     │
│                          • GraphQL Management API            │
│                          • External A2A Endpoint             │
│                          • Authentication Gateway            │
│                                    │                         │
│                                    │ A2A Protocol (HTTP)    │
│                                    ▼                         │
│                          Internal Server (--role internal)   │
│                          • Agent Execution                   │
│                          • Tool Orchestration (MCP)          │
│                          • Workflow Management               │
└─────────────────────────────────────────────────────────────┘
```

## 📚 Documentation Structure

### Core Documentation

1. **[Overview and Concepts](./01-overview-and-concepts.md)**  
   Core concepts, design principles, and fundamental architecture

2. **[Use Cases and Agent Model](./02-use-cases-and-agent-model.md)**  
   Real-world scenarios, agent patterns, and interaction models

3. **[System Architecture](./03-system-architecture.md)** ⭐ **Updated**  
   Two-server deployment, A2A communication, and component design

4. **[Deployment and Configuration](./04-deployment-and-configuration.md)**  
   Server modes, environment setup, and configuration management

5. **[GraphQL API Reference](./05-graphql-api-reference.md)**  
   Complete API specification for management operations

6. **[Multi-Tenancy Guide](./06-multi-tenancy-guide.md)**  
   Tenant isolation, organization management, and security boundaries

7. **[Tool Development Guide](./07-tool-development-guide.md)**  
   Building MCP-compliant tools for agent capabilities

8. **[Workflow Engine Adapters](./08-workflow-engine-adapters.md)**  
   Pluggable workflow engines (Temporal, BullMQ, custom)

9. **[Database Schema](./09-database-schema.md)**  
   Complete schema documentation with multi-tenant design

10. **[Authentication and Authorization](./10-authentication-and-authorization.md)**  
    Dual auth model, API keys, service accounts, and permissions

### Examples and Tutorials

- **[Complete A2A and MCP Flow](./examples/complete-a2a-mcp-flow.md)**  
  End-to-end example showing agent collaboration and tool usage

- **[API Integration Examples](./examples/api-integration-examples.md)**  
  Common integration patterns and code samples

### External Protocol Specifications

- **[A2A Protocol Specification](./external-specs/a2a/README.md)**  
  Agent-to-Agent communication protocol for federation

- **[MCP Protocol Specification](./external-specs/mcp/README.md)**  
  Model Context Protocol for agent-to-tool communication

### External Dependencies

- **[Permiso RBAC](./external-dependencies/permiso/README.md)**  
  External authorization and user management service

## 🚀 What's New

### Two-Server Architecture
- **Public Server**: Handles external traffic, authentication, and API gateway functions
- **Internal Server**: Executes agents in isolation with full security
- All agent communication uses **A2A protocol over HTTP** (not direct function calls)

### Protocol Compliance
- **A2A Protocol**: Agent-to-agent communication via HTTP with JWT authentication
- **MCP Protocol**: Agent-to-tool communication with multiple transport options
- Both protocols are fully documented in the external specs section

### Enhanced Security
- Service accounts with granular permissions for API access
- Internal JWT tokens for agent-to-agent authentication
- Complete audit trail for all operations
- Zero-trust internal architecture

## 🎯 Quick Start Paths

### For Developers
1. Start with [Overview and Concepts](./01-overview-and-concepts.md)
2. Review [System Architecture](./03-system-architecture.md) to understand the two-server model
3. Follow [Deployment and Configuration](./04-deployment-and-configuration.md) to set up your environment
4. Build your first agent using [Use Cases and Agent Model](./02-use-cases-and-agent-model.md)

### For System Administrators
1. Review [System Architecture](./03-system-architecture.md) for deployment topology
2. Configure servers using [Deployment and Configuration](./04-deployment-and-configuration.md)
3. Set up authentication with [Authentication and Authorization](./10-authentication-and-authorization.md)
4. Implement monitoring as described in the architecture docs

### For API Integrators
1. Understand authentication in [Authentication and Authorization](./10-authentication-and-authorization.md)
2. Review [GraphQL API Reference](./05-graphql-api-reference.md) for management operations
3. See [Complete A2A and MCP Flow](./examples/complete-a2a-mcp-flow.md) for integration examples
4. Check protocol specs for [A2A](./external-specs/a2a/README.md) and [MCP](./external-specs/mcp/README.md)

## 📖 Key Concepts

### Agents
- **Exposed Agents**: Accessible via public API endpoints
- **Internal Agents**: Only callable by other agents via A2A protocol
- Defined as Markdown files with YAML frontmatter in Git repositories

### Multi-Tenancy
- Complete isolation between organizations
- Subdomain-based routing (e.g., `acme.shaman.ai`)
- Separate data, agents, and execution contexts per tenant

### Security Model
- **External Layer**: API Gateway with Ory Kratos (sessions) and API keys
- **Internal Layer**: JWT-based authentication for A2A communication
- Service accounts for external system integration

### Protocols
- **A2A (Agent-to-Agent)**: HTTP-based protocol for agent federation
- **MCP (Model Context Protocol)**: Standardized tool access for agents
- Both protocols ensure interoperability and security

## 🛠️ Technology Stack

- **Languages**: TypeScript/Node.js (functional programming, no classes)
- **API**: GraphQL for management, A2A for agent execution
- **Authentication**: Ory Kratos for sessions, Permiso for authorization
- **Workflow Engines**: Pluggable (Temporal, BullMQ, custom)
- **Databases**: PostgreSQL with Knex migrations
- **Protocols**: A2A v0.3.0, MCP draft specification
- **Observability**: OpenTelemetry for distributed tracing

## 📝 Documentation Standards

- All agent communication must use A2A protocol over HTTP
- Server deployment requires explicit `--role` flag (public or internal)
- Multi-tenant isolation is mandatory, not optional
- Security is enforced at multiple layers
- All operations must be auditable

---

For questions or contributions, please refer to the project repository.