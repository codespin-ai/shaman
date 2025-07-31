# Model Context Protocol (MCP) Specification

This directory contains the Model Context Protocol specifications that Shaman uses for agent-to-tool communication. MCP provides a standardized way for AI agents to interact with external tools, data sources, and capabilities.

## Overview

The Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. In Shaman, MCP is used to:

- **Connect agents to tools**: Agents access external capabilities through MCP servers
- **Provide resources**: Share context and data with agents
- **Enable tool execution**: Allow agents to invoke functions and APIs
- **Support prompts**: Provide templated workflows and interactions

## Key Concepts

MCP follows a client-server architecture:

- **MCP Client**: The agent that connects to MCP servers (in Shaman, agents act as clients)
- **MCP Server**: Provides tools, resources, and prompts to clients
- **Transport**: Communication channel (stdio, HTTP SSE, etc.)

## Relationship with A2A

While A2A handles agent-to-agent communication, MCP handles agent-to-tool communication:

- **A2A**: Agents talking to other agents (federation, delegation, collaboration)
- **MCP**: Agents using tools and accessing resources (function calling, data access)

## Key Documents

- [Architecture](./architecture.md) - MCP client-server architecture
- [Core Protocol](./core-protocol.md) - Base protocol and lifecycle
- [Tools](./tools.md) - Tool discovery and invocation
- [Resources](./resources.md) - Resource exposure and access
- [Prompts](./prompts.md) - Prompt templates and workflows
- [Transports](./transports.md) - Communication channels
- [Security](./security.md) - Security considerations

## Implementation in Shaman

Shaman integrates MCP through:

1. **Agent Configuration**: Agents declare MCP servers in their YAML frontmatter
2. **Tool Discovery**: Shaman queries MCP servers for available tools
3. **Tool Invocation**: Agents call tools through the MCP protocol
4. **Resource Access**: Agents read resources from MCP servers

Example agent configuration:
```yaml
---
name: DataAnalyzer
mcpServers:
  database:
    command: "npx"
    args: ["@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    tools:
      - "query_database"
      - "list_tables"
  filesystem:
    command: "mcp-server-filesystem"
    args: ["--root", "/data"]
    resources: "*"
---
```

## Protocol Version

Shaman currently implements **MCP Protocol Version: draft**.

## Additional Resources

- [Official MCP Documentation](https://modelcontextprotocol.io)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)