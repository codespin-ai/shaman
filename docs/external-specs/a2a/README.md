# A2A (Agent-to-Agent) Protocol Specification

This directory contains the A2A protocol specifications that Shaman implements for agent-to-agent communication. These specifications ensure that agents built on Shaman can communicate with other A2A-compliant agents across different platforms and implementations.

The most important document in this directory is probably types.ts. Make sure you read that.

## Overview

The Agent-to-Agent (A2A) Protocol is an open standard for communication between independent AI agent systems. Shaman implements this protocol to enable:

- **Interoperability**: Agents can communicate regardless of their underlying implementation
- **Federation**: Agents from different organizations can collaborate
- **Discovery**: Agents can find and understand each other's capabilities
- **Security**: Standardized authentication and authorization mechanisms

## Key Documents

- [AgentCard Specification](./agent-card.md) - How agents describe their capabilities
- [Core Methods](./core-methods.md) - Required A2A protocol methods
- [Task Lifecycle](./task-lifecycle.md) - Task states and management
- [Transport Protocols](./transport-protocols.md) - Supported communication protocols
- [Authentication](./authentication.md) - Security and authentication requirements
- [Error Handling](./error-handling.md) - Standard error codes and handling

## Implementation in Shaman

Shaman implements the A2A protocol with the following architecture:

1. **Two-Server Model**:
   - **Public Server** (`--role public`): Exposes only agents marked as `exposed: true`
   - **Internal Server** (`--role internal`): Exposes all agents for internal communication

2. **Agent Communication**:
   - All agent-to-agent calls use HTTP/A2A protocol
   - External agents are called via their published A2A endpoints
   - Internal agents communicate through the internal server's A2A endpoints

3. **Tool Integration**:
   - `call_agent` tool is injected by Shaman to enable A2A communication
   - Agents use this tool to call other agents (internal or external)
   - The tool handles routing to appropriate A2A endpoints

## Protocol Version

Shaman currently implements **A2A Protocol Version 0.3.0**.

## Additional Resources

- [Official A2A Specification](https://a2a-project.github.io/A2A/)
- [A2A GitHub Repository](https://github.com/a2a-project/A2A)