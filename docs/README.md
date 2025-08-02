# Shaman Documentation

## Overview

Shaman is an AI agent orchestration framework. It lets you:
- Deploy AI agents that can call each other and use tools
- Track every execution step in PostgreSQL
- Handle async operations with webhooks
- Isolate tenants completely

## Quick Example

```bash
# External system calls your agent
POST https://acme.shaman.ai/a2a/v1
{
  "message": {
    "parts": [{"kind": "text", "text": "@CustomerSupport Process refund for order #123"}]
  }
}

# This creates a workflow:
# 1. call_agent tool → CustomerSupport agent
# 2. CustomerSupport → query_database tool
# 3. CustomerSupport → call_agent tool → PaymentProcessor agent
# 4. PaymentProcessor → process_refund tool (async with webhook)
```

## Documentation

1. **[Architecture](./architecture.md)** - How it all works (start here!)
2. **[Getting Started](./getting-started.md)** - Deploy and run Shaman
3. **[Agent Development](./agents.md)** - Write agents and tools
4. **[API Reference](./api.md)** - GraphQL and A2A endpoints

## Key Concepts

- **Step**: Any unit of work (agent execution or tool call)
- **Run**: A complete workflow instance
- **Unified Model**: Everything starts with `call_agent`, even external requests

## Tech Stack

- TypeScript (functional, no classes)
- PostgreSQL + BullMQ
- A2A Protocol (agent communication)
- MCP Protocol (tool communication)