# System Architecture

Shaman's architecture is designed around **pluggable components** and **type-based modules** to provide maximum flexibility while maintaining clean separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHAMAN CORE                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   GraphQL API   │  │  A2A Provider   │  │ Stream Publisher│  │
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
┌─────────────────────────────────▼─────────────────────────────────┐
│                    AGENT RESOLUTION LAYER                         │
│                    (shaman-agents module)                         │
│  ┌─────────────────┐                      ┌─────────────────┐    │
│  │  Git Resolver   │                      │ External Registry│    │
│  │  (with caching) │                      │   (A2A agents)   │    │
│  └─────────────────┘                      └─────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
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

### 1. Agent Resolution Layer (shaman-agents)

Provides unified agent discovery and resolution across all sources.

**Key Features:**
- Unified interface for both Git and External agents
- Intelligent caching for Git repositories (commit-hash based)
- Branch-aware agent resolution
- Search and filtering capabilities

**Core Type:**
```typescript
export type UnifiedAgent = 
  | { source: 'git'; agent: GitAgent }
  | { source: 'external'; agent: ExternalAgent };

export type AgentResolver = {
  getAllAgents: (config: AgentsConfig, options?: AgentSearchOptions) => Promise<Result<UnifiedAgent[]>>;
  resolveAgent: (name: string, config: AgentsConfig, options?: AgentResolveOptions) => Promise<Result<AgentResolution | null>>;
  searchAgents: (query: string, config: AgentsConfig, options?: AgentSearchOptions) => Promise<Result<UnifiedAgent[]>>;
  syncGitRepositories: (config: AgentsConfig) => Promise<Result<SyncResult>>;
};
```

### 2. Agent Orchestrator

The heart of Shaman that manages agent execution, tool calls, and conversation flow.

**Key Responsibilities:**
- LLM provider abstraction and routing
- Tool execution coordination (sync/async)
- Conversation context management
- Real-time event streaming
- Delegates agent resolution to Agent Resolution Layer

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

### 3. Workflow Engine Adapter

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

### 4. Tool Execution System

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

### 5. Pluggable Notification System

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

### 6. A2A Provider (shaman-a2a-provider)

**HTTP server that exposes Shaman's Git agents** to external systems via the standardized A2A protocol.

**Key Features:**
- Express-based REST API server
- Configurable agent exposure (whitelist/blacklist)
- Authentication and rate limiting
- OpenAPI-compliant endpoints
- Health monitoring

**Core Configuration:**
```typescript
export type A2AProviderConfig = {
  port: number;
  basePath: string;
  authentication?: {
    type: 'bearer' | 'api-key' | 'none';
    validateToken?: (token: string) => Promise<boolean>;
    validateApiKey?: (apiKey: string) => Promise<boolean>;
  };
  rateLimiting?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  cors?: {
    enabled: boolean;
    allowedOrigins: string[];
  };
  allowedAgents?: string[];      // Whitelist specific agents
  blockedAgents?: string[];      // Blacklist specific agents
  allowedCategories?: string[];  // Allow by category
  blockedCategories?: string[];  // Block by category
};
```

**API Endpoints:**
```typescript
// Agent Discovery
GET /a2a/v1/agents
Response: {
  agents: [{
    name: string;
    description: string;
    version: string;
    endpoint: string;
    inputSchema: object;
    outputSchema: object;
    metadata: {
      category?: string;
      tags?: string[];
      capabilities?: string[];
    };
  }]
}

// Agent Details
GET /a2a/v1/agents/:name
Response: { /* Single agent details */ }

// Agent Execution
POST /a2a/v1/agents/:name/execute
Body: {
  prompt: string;
  context?: {
    sessionId?: string;
    conversationHistory?: Message[];
    variables?: Record<string, any>;
  };
  parameters?: Record<string, any>;
}
Response: {
  success: boolean;
  result?: {
    response: string;
    metadata?: Record<string, any>;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Health Check
GET /a2a/v1/health
Response: { status: 'healthy' | 'unhealthy', version: string }
```

**Integration Example:**
```typescript
import { createA2AServer } from '@codespin/shaman-a2a-provider';

// Configure which agents to expose
const a2aConfig: A2AProviderConfig = {
  port: 3001,
  basePath: '/a2a/v1',
  authentication: {
    type: 'bearer',
    validateToken: async (token) => {
      // Validate against your auth system
      return await authService.validateToken(token);
    }
  },
  rateLimiting: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000 // 1 minute
  },
  // Only expose specific agents
  allowedAgents: ['CustomerSupport', 'BillingAssistant'],
  // Or expose by category
  allowedCategories: ['support', 'billing']
};

// Create and start the A2A server
const server = createA2AServer(a2aConfig, agentsConfig);
await server.start();
```

This component enables Shaman to act as an agent provider in federated architectures, allowing external systems to discover and execute Shaman's agents through a standardized protocol.

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

Shaman implements the A2A protocol for bidirectional federation with external agent systems:

**Outbound (Consumer):** Shaman agents can call external A2A-compliant agents via `shaman-external-registry`
**Inbound (Provider):** External systems can call Shaman agents via `shaman-a2a-provider`

#### A2A Consumer (shaman-external-registry)
```typescript
// Call external agent
const externalResult = await a2aGateway.callAgent({
  agentEndpoint: 'https://partner.com/agents/legal-expert',
  prompt: 'Review this contract for compliance issues',
  context: currentContext
});
```

#### A2A Provider (shaman-a2a-provider)
```typescript
// Expose Shaman's Git agents via A2A protocol
const a2aConfig: A2AProviderConfig = {
  port: 3001,
  basePath: '/a2a/v1',
  authentication: { type: 'bearer', validateToken },
  rateLimiting: { enabled: true, maxRequests: 100, windowMs: 60000 },
  allowedAgents: ['CustomerSupport', 'BillingAssistant'] // Whitelist
};

const a2aServer = createA2AServer(a2aConfig, agentsConfig);
```

**A2A Provider Endpoints:**
- `GET /a2a/v1/agents` - Discover available Shaman agents
- `GET /a2a/v1/agents/:name` - Get specific agent details
- `POST /a2a/v1/agents/:name/execute` - Execute a Shaman agent
- `GET /a2a/v1/health` - Health check

This bidirectional capability enables Shaman to participate as both a consumer and provider in the federated agent ecosystem.
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