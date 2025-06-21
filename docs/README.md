# Shaman Documentation

Shaman is a comprehensive backend framework for managing and coordinating AI agents through a federated ecosystem, with **pluggable workflow engines** and **type-based architecture**.

## Table of Contents

1. [**Overview and Concepts**](./01-overview-and-concepts.md) - Core concepts, agents as code, and architectural principles
2. [**Use Cases and Agent Model**](./02-use-cases-and-agent-model.md) - Real-world scenarios and agent interaction patterns  
3. [**System Architecture**](./03-system-architecture.md) - ⭐ **Updated** - Pluggable components, sync/async tools, and data flows
4. [**API Configuration and Deployment**](./04-api-config-and-deployment.md) - ⭐ **Updated** - Type-safe configuration, environment setup, and deployment options
5. [**GraphQL API Specification**](./05-graphql-api-spec.md) - Complete API reference and schema
6. [**Tool Execution Guide**](./06-tool-execution-guide.md) - ⭐ **New** - Comprehensive guide to sync/async tool execution with context retention
7. [**Workflow Engine Adapters**](./07-workflow-engine-adapters.md) - ⭐ **New** - Engine-agnostic adapters for Temporal, BullMQ, and custom engines

## What's New in This Architecture

### 🔧 **Pluggable Workflow Engines**
Shaman now supports **multiple workflow engines** through a unified adapter interface:
- **Temporal**: Production-grade with child workflows and signals
- **BullMQ**: Redis-based for development and simpler deployments  
- **Custom**: Build your own adapter for any workflow engine

### ⚡ **Dual-Mode Tool Execution**
Tools are now categorized into two execution modes:
- **Synchronous Tools**: Execute immediately (database lookups, calculations)
- **Asynchronous Tools**: Complex workflows with approvals and external systems

### 🔗 **Context Retention**
Full conversation context is preserved across async tool execution, ensuring seamless user experience even with long-running workflows.

### 📡 **Pluggable Notifications**
Multiple notification providers for async coordination:
- Redis pub/sub
- Webhooks with retry policies
- AWS EventBridge
- Apache Kafka

### 📐 **Type-Based Architecture**
No classes or inheritance - everything uses **type-safe modules**:
```typescript
import { temporal, notifications, tools } from '@shaman/workflow-engine';

const workflowAdapter = temporal.createWorkflowEngineAdapter(config);
const notificationProvider = notifications.redis(redisConfig);
const toolExecutor = tools.createToolExecutor(toolConfigs);
```

## Quick Architecture Overview

```
User Prompts → Agents (Markdown) → Shaman Intelligence → Workflow Engine → Durable Execution
     ↓                                    ↓                    ↓              ↓
  Natural Language              LLM Calls & Decisions    Orchestration    State Persistence
     ↓                                    ↓                    ↓              ↓
  Agent Responses ← Real-time Streaming ← Tool Execution ← Signal Handling ← Context Retention
```

### **Key Principles:**

1. **Users write prompts, not code** - Agents defined in markdown with YAML frontmatter
2. **Engine-agnostic** - Same Shaman code works with Temporal, BullMQ, or custom engines
3. **Intelligent routing** - Shaman automatically handles sync vs async tool execution  
4. **Context preservation** - Full conversation state maintained across async boundaries
5. **Real-time streaming** - Live updates for all operations via WebSocket
6. **Production ready** - Enterprise security, monitoring, and reliability features

## Architecture Highlights

### **Sync vs Async Tool Flow**

```typescript
// Sync Tool (immediate execution)
User: "What's my account balance?"
Agent calls check_account tool → Database lookup → Immediate response
Agent: "Your balance is $1,247.50"

// Async Tool (workflow orchestration)  
User: "I want a $500 refund"
Agent calls process_refund tool → Async workflow starts → Approval required
Manager approves → External payment system → Tool executes → User notified
Agent: "Your refund has been processed! Refund ID: R-789"
```

### **Multi-Agent Coordination**

```typescript
// Agent-to-agent delegation with async tools
CustomerSupport → delegates to → BillingSpecialist → calls async refund tool
        ↓                              ↓                       ↓
Main conversation pauses    Child workflow runs    Approval workflow runs
        ↓                              ↓                       ↓
All workflows coordinate via signals → Final response to user
```

### **Pluggable Components**

```typescript
// Development setup
const devConfig = {
  workflowEngine: 'bullmq',     // Redis-based
  notifications: 'redis',       // Simple pub/sub
  llmProvider: 'openai'         // GPT-3.5 for cost
};

// Production setup  
const prodConfig = {
  workflowEngine: 'temporal',   // Durable workflows
  notifications: 'kafka',       // Enterprise messaging
  llmProvider: 'azure-openai'   // Enterprise LLM
};

// Same Shaman code, different infrastructure
```

## Getting Started

1. **Start with [Overview and Concepts](./01-overview-and-concepts.md)** to understand core principles
2. **Review [System Architecture](./03-system-architecture.md)** for the big picture
3. **Configure your setup** using [API Configuration and Deployment](./04-api-config-and-deployment.md)
4. **Implement tools** following the [Tool Execution Guide](./06-tool-execution-guide.md)
5. **Choose your workflow engine** with [Workflow Engine Adapters](./07-workflow-engine-adapters.md)

## Example Agent Definition

```markdown
---
name: "CustomerSupportAgent"
description: "Handles customer inquiries with escalation capabilities"
model: "gpt-4-turbo"
temperature: 0.7
allowedAgents: ["BillingSpecialist", "TechnicalSupport"]
tools: ["check_account", "process_refund", "create_ticket"]
---

You are a helpful customer support agent. When handling customer inquiries:

1. Always check the customer's account status first
2. For billing issues, delegate to the BillingSpecialist agent  
3. For technical issues, delegate to TechnicalSupport agent
4. For refunds over $100, the process_refund tool requires manager approval
5. Always create a support ticket for tracking

Use the available tools and agents to resolve issues completely.
```

**That's it!** Shaman handles all the complexity:
- ✅ LLM orchestration and tool routing
- ✅ Sync/async tool execution with approvals
- ✅ Agent-to-agent delegation
- ✅ Real-time streaming and context retention
- ✅ Durable workflow execution
- ✅ Enterprise security and monitoring

## Documentation Updates

### Updated Sections
- **System Architecture**: Complete rewrite with pluggable components
- **API Configuration**: Type-based configuration for all components  

### New Sections
- **Tool Execution Guide**: Comprehensive sync/async tool documentation
- **Workflow Engine Adapters**: Engine selection and implementation guide

### Maintained Sections  
- **Overview and Concepts**: Core principles remain the same
- **Use Cases and Agent Model**: Use cases still apply with new architecture
- **GraphQL API Specification**: API surface remains consistent

The new architecture maintains **full backward compatibility** for agent definitions while providing much more flexibility in deployment and execution.