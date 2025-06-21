# System Architecture

Shaman's architecture is designed around **pluggable components** and **type-based modules** to provide maximum flexibility while maintaining clean separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHAMAN CORE                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   GraphQL API   │  │  Git Resolver   │  │ Stream Publisher│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                │                                │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │              AGENT ORCHESTRATOR                         │  │
│  │  ┌─────────────────┐  ┌─────────────────┐              │  │
│  │  │  Tool Executor  │  │ LLM Provider    │              │  │
│  │  │  (Sync/Async)   │  │   Abstraction   │              │  │
│  │  └─────────────────┘  └─────────────────┘              │  │
│  └─────────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                WORKFLOW ENGINE ADAPTER                            │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │    Temporal     │  │     BullMQ      │  │     Custom      │    │
│  │    Adapter      │  │    Adapter      │  │    Adapter      │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
                                  │
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│              PLUGGABLE NOTIFICATION LAYER                         │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │      Redis      │  │    Webhooks     │  │   EventBridge   │    │
│  │   Notifications │  │                 │  │    /Kafka       │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Orchestrator

The heart of Shaman that manages agent execution, tool calls, and conversation flow.

**Key Responsibilities:**
- Agent resolution from git repositories
- LLM provider abstraction and routing
- Tool execution coordination (sync/async)
- Conversation context management
- Real-time event streaming

**Type-based Design:**
```typescript
export type AgentOrchestrator = {
  executeAgent: (input: AgentExecutionInput) => Promise<AgentExecution>;
  resolveAgent: (agentId: string, version?: string) => Promise<ResolvedAgent>;
  callLLM: (params: LLMCallParams) => Promise<LLMResponse>;
  executeTool: (params: ToolExecutionParams) => Promise<ToolResult>;
  parseDecisions: (response: LLMResponse) => Promise<AgentDecision[]>;
};
```

### 2. Workflow Engine Adapter

**Engine-agnostic interface** that allows Shaman to work with any workflow engine (Temporal, BullMQ, custom implementations).

**Core Type:**
```typescript
export type WorkflowEngineAdapter = {
  // Workflow lifecycle
  startRuns: (inputs: RunAgentInput[]) => Promise<RunIdentifier[]>;
  getRun: (id: RunIdentifier) => Promise<Run | null>;
  terminateRun: (id: RunIdentifier) => Promise<boolean>;
  
  // Signal & Query (handles all async scenarios)
  signalRun: (id: RunIdentifier, signalName: string, payload: any) => Promise<void>;
  queryRun: <T>(id: RunIdentifier, queryName: string) => Promise<T>;
  
  // Streaming & monitoring
  streamRunEvents: (id: RunIdentifier) => AsyncIterable<RunEvent>;
  getRunHistory: (id: RunIdentifier) => Promise<Step[]>;
};
```

**Supported Engines:**
- **Temporal**: Production-grade with full child workflows, signals, and durable execution
- **BullMQ**: Development-friendly with Redis-based queuing
- **Custom**: Extensible interface for any workflow engine

### 3. Tool Execution System

**Dual-mode tool execution** supporting both synchronous and asynchronous tools with context retention.

#### Synchronous Tools
```typescript
type SyncToolConfig = {
  name: string;
  executionType: 'sync';
  description: string;
  parameters: Record<string, any>;
};

// Examples: check_account, calculate, get_current_time
```

**Execution Flow:**
1. Agent calls tool via LLM response
2. Shaman executes tool directly
3. Result returned immediately to conversation

#### Asynchronous Tools
```typescript
type AsyncToolConfig = {
  name: string;
  executionType: 'async';
  description: string;
  parameters: Record<string, any>;
  asyncConfig: {
    requiresApproval?: boolean;
    approvalConfig?: ApprovalConfig;
    requiresExternalSystem?: boolean;
    externalSystemConfig?: ExternalSystemConfig;
    estimatedDuration?: number;
    timeout?: number;
  };
};

// Examples: process_refund, generate_report, fraud_check
```

**Execution Flow:**
1. Agent calls async tool via LLM response
2. Shaman starts async workflow in WE, **retains original context**
3. Main conversation workflow pauses, waiting for completion signal
4. Async workflow runs independently (approval, external systems, etc.)
5. Async workflow calls back to Shaman to execute actual tool
6. Completion notification sent via pluggable notification system
7. Main workflow resumes with tool result

#### Context Retention

Critical for maintaining conversation continuity across async operations:

```typescript
type ExecutionContext = {
  runId: RunIdentifier;
  sessionId: string;
  agentId: string;
  parentRunId?: RunIdentifier;
  callStack: string[];
  conversationHistory: Message[];
  stepId: string;
  toolCallId?: string;
  metadata: Record<string, any>;
};
```

**How Context is Preserved:**
- Original context stored when async tool starts
- Passed through async workflow as metadata
- Restored when tool actually executes
- Conversation continues seamlessly

### 4. Pluggable Notification System

**Provider-agnostic notification** for async tool completion, approvals, and external events.

```typescript
type NotificationProvider = {
  send: (notification: Notification) => Promise<void>;
  subscribe: (topic: string, handler: NotificationHandler) => Promise<void>;
  unsubscribe: (topic: string) => Promise<void>;
};
```

**Supported Providers:**

#### Redis Provider
```typescript
const redisNotifications = notifications.redis({
  host: 'localhost',
  port: 6379,
  keyPrefix: 'shaman'
});
```
- Pub/sub messaging
- Reliable delivery
- Development and production ready

#### Webhook Provider
```typescript
const webhookNotifications = notifications.webhook({
  endpoints: ['https://api.company.com/shaman/notifications'],
  retryPolicy: { maxRetries: 3, backoff: 'exponential' },
  authentication: { type: 'bearer', token: 'xxx' }
});
```
- HTTP-based notifications
- Multi-endpoint support
- Retry policies and authentication

#### EventBridge/Kafka Provider
```typescript
const eventBridgeNotifications = notifications.eventbridge({
  eventBusName: 'shaman-events',
  source: 'shaman.agent-execution',
  region: 'us-east-1'
});
```
- Enterprise event streaming
- High throughput and reliability
- Integration with AWS/cloud services

## Agent-to-Agent Communication (A2A)

### Internal A2A Flow

```
Main Agent Workflow
       ↓
Agent decides to delegate
       ↓
Shaman starts child workflow via WE adapter
       ↓
Child workflow runs independently
       ↓
Child signals completion to parent
       ↓
Main workflow continues with child result
```

**Implementation:**
```typescript
// Agent delegates to specialist
const childResult = await workflowAdapter.startRuns([{
  agentId: 'BillingSpecialistAgent',
  prompt: delegationPrompt,
  sessionId: context.sessionId,
  parentRunId: context.runId,
  callStack: [...context.callStack, context.agentId]
}]);

// Parent workflow waits for child completion signal
await workflowAdapter.signalRun(parentRunId, 'childAgentCompleted', childResult);
```

### External A2A Protocol

Shaman implements the A2A protocol for federation with external agent systems:

**Outbound:** Shaman agents can call external A2A-compliant agents
**Inbound:** External systems can call Shaman agents via A2A endpoints

```typescript
// Call external agent
const externalResult = await a2aGateway.callAgent({
  agentEndpoint: 'https://partner.com/agents/legal-expert',
  prompt: 'Review this contract for compliance issues',
  context: currentContext
});
```

## Execution Flow Examples

### Simple Synchronous Flow
```
User: "What's 2 + 2?"
  ↓
Agent calls calculate tool (sync)
  ↓
Tool executes immediately
  ↓
Result: "4"
```

### Complex Asynchronous Flow
```
User: "I want a $500 refund"
  ↓
CustomerSupport agent analyzes request
  ↓
Agent calls process_refund tool (async)
  ↓
Async workflow starts, requires manager approval
  ↓
Main conversation pauses
  ↓
Approval request sent via notification provider
  ↓
Manager approves via external system
  ↓
Async workflow executes actual refund
  ↓
Completion notification sent
  ↓
Main conversation resumes: "Refund processed!"
```

### Multi-Agent with Async Tools
```
User: "Billing issue with my account"
  ↓
CustomerSupport agent → delegates to BillingSpecialist
  ↓
BillingSpecialist → calls process_refund (async)
  ↓
Multiple concurrent flows:
  - Child agent workflow (BillingSpecialist)
  - Async tool workflow (refund processing)
  - Approval workflow (manager approval)
  ↓
All complete and signal back to main workflow
  ↓
Coordinated response to user
```

## Data Flow Architecture

### Streaming Data Flow (Real-time UX)
```
Shaman Activities → Stream Publisher → WebSocket → Client UI
```
- Real-time typing indicators
- Live agent responses
- Tool execution status
- Delegation notifications
- Error alerts

### Workflow Data Flow (Execution Control)
```
Workflow Engine → WE Adapter → Shaman Activities → Return Values → Engine
```
- Agent decisions and routing
- Tool execution results
- Context management
- State persistence

### Notification Data Flow (Async Coordination)
```
Async Workflow → Notification Provider → Main Workflow
```
- Tool completion events
- Approval responses
- External system callbacks
- Error notifications

## Scalability and Reliability

### Horizontal Scaling
- **Shaman instances**: Stateless, can be load balanced
- **Workflow engines**: Handle their own scaling (Temporal clusters, BullMQ workers)
- **Notification providers**: Redis clustering, webhook load balancing

### Fault Tolerance
- **Workflow durability**: Engine handles crash recovery
- **Context retention**: Async operations preserve full context
- **Notification reliability**: Retry policies and multiple delivery mechanisms
- **Circuit breakers**: Prevent cascade failures

### Performance Optimization
- **Sync tools**: Zero overhead execution
- **Async tools**: Non-blocking with efficient context switching
- **Streaming**: Real-time updates without polling
- **Caching**: Agent definitions, tool configurations, LLM responses

## Security Architecture

### Authentication & Authorization
- **User authentication**: JWT, OAuth2, API keys
- **Agent permissions**: RBAC for tool access
- **A2A security**: Mutual TLS, signed requests
- **Async tool security**: Approval workflows, audit trails

### Data Protection
- **Context encryption**: Sensitive data in async workflows
- **Network security**: TLS for all communications
- **Audit logging**: Complete execution history
- **Data retention**: Configurable cleanup policies

## Configuration and Deployment

All components are configured via type-safe configuration objects:

```typescript
type ShamanConfig = {
  agents: {
    gitRepos: GitRepoConfig[];
    syncInterval: number;
  };
  
  workflowEngine: {
    type: 'temporal' | 'bullmq' | 'custom';
    config: TemporalConfig | BullMQConfig | CustomConfig;
  };
  
  notifications: {
    provider: 'redis' | 'webhook' | 'eventbridge' | 'kafka';
    config: NotificationConfig;
  };
  
  tools: {
    syncTools: ToolConfig[];
    asyncTools: ToolConfig[];
  };
  
  llmProviders: LLMProviderConfig[];
  streaming: StreamingConfig;
  security: SecurityConfig;
};
```

This architecture provides:
- ✅ **Engine flexibility**: Swap workflow engines without code changes
- ✅ **Tool scalability**: Handle both simple and complex operations
- ✅ **Notification reliability**: Multiple delivery mechanisms
- ✅ **Context preservation**: Seamless async operations
- ✅ **Type safety**: Compile-time validation of all configurations
- ✅ **Production readiness**: Built for scale, reliability, and security