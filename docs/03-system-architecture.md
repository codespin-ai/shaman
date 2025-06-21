[← Previous: Use Cases & Agent Model](./02-use-cases-and-agent-model.md) | [🏠 Home](./README.md) | [Next: API, Config & Deployment →](./04-api-config-and-deployment.md)

---

# System Architecture

## Component Overview

The Shaman system consists of three main tiers: the control plane (Shaman Server), the execution plane (Workflow Engine), and the execution units (Worker Processes). Each tier has distinct responsibilities and can be scaled independently.

```
┌──────────────────────────┐    ┌───────────────────── ──┐    ┌─────────────────────┐
│     GraphQL Client       │    │      A2A Client        │    │      Shaman UI      │
│     (External Apps)      │    │   (External Agent)     │    │ (Admin Dashboard)   │
└──────────┬───────────────┘    └───────┬────────────────┘    └───┬─────────────────┘
           │                            │                         │
           └──────┐                ┌────┘           ┌─────────────┘
                  │                │                │
                ┌─▼────────────────▼────────────────▼─────────────────┐
                │                         Shaman Server               │
                │ ┌───────────────────┐  ┌──────────────────────────┐ │
                │ │    GraphQL API    │  │         A2A Gateway      │ │
                │ │      Engine       │  │      (HTTP Endpoints)    │ │
                │ └───────────────────┘  └──────────────────────────┘ │
                │ ┌───────────────────┐  ┌──────────────────────────┐ │
                │ │    Real-time      │  │    Git Agent Discovery   │ │
                │ │     Streaming     │  │         Service          │ │
                │ └───────────────────┘  └──────────────────────────┘ │
                │ ┌───────────────────┐  ┌───────────────────────── ┐ │
                │ │   External A2A    │  │      Workflow Engine     │ │
                │ │     Registry      │  │         Adapter          │ │
                │ └───────────────────┘  └──────────────────────────┘ │
                └────────────────────────┬────────────────────────────┘
                                         │
                ┌────────────────────────▼────────────────────┐
                │                   Workflow Engine           │
                │ ┌────────────────┐    ┌───────────────────┐ │
                │ │   Temporal.io  │    │   BullMQ + Redis  │ │
                │ │  (Production)  │    │  (Development)    │ │
                │ └────────────────┘    └───────────────────┘ │
                └──────────────────────┬──────────────────────┘
                                       │
                ┌──────────────────────▼───────────────────────────────────┐
                │                      Worker Pool                         │
                │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐ │
                │  │      LLM      │  │      MCP      │  │   A2A Client  │ │
                │  │     Calls     │  │     Tools     │  │     Logic     │ │
                │  └───────────────┘  └───────────────┘  └───────────────┘ │
                │  ┌─────────────────────────────────────────────────────┐ │
                │  │                   Tool Call Router                  │ │
                │  │  ┌───────────┐  ┌───────────────┐  ┌──────────────┐ │ │
                │  │  │    MCP    │  │    System     │  │    Agent     │ │ │
                │  │  │   Handler │  │    Handler    │  │     Call     │ │ │
                │  │  └───────────┘  └───────────────┘  └──────────────┘ │ │
                │  └─────────────────────────────────────────────────────┘ │
                │  ┌─────────────────────────────────────────────────────┐ │
                │  │               Git Agent Resolver                    │ │
                │  │  ┌───────────┐    ┌──────────┐    ┌──────────────┐  │ │
                │  │  │    Root   │    │ Namespd  │    │   External   │  │ │
                │  │  │   Repos   │    │  Repos   │    │ A2A Registry │  │ │
                │  │  └───────────┘    └──────────┘    └──────────────┘  │ │
                │  └─────────────────────────────────────────────────────┘ │
                └────────────────────────┬─────────────────────────────────┘
                                         │
                ┌────────────────────────▼───────────────────────────────────┐
                │                     Infrastructure                         │
                │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ │
                │  │   PostgreSQL  │  │     Redis     │  │ OpenTelemetry   │ │
                │  │     (Data)    │  │   (Streams)   │  │   (Tracing)     │ │
                │  └───────────────┘  └───────────────┘  └─────────────────┘ │
                │  ┌───────────────────────────────────────────────────────┐ │
                │  │                    Git Storage                        │ │
                │  │  ┌──────────┐  ┌───────────┐  ┌─────────────┐         │ │
                │  │  │  Cloned  │  │  Cached   │  │    Sync     │         │ │
                │  │  │  Repos   │  │  Agents   │  │  Metadata   │         │ │
                │  │  └──────────┘  └───────────┘  └─────────────┘         │ │
                │  └───────────────────────────────────────────────────────┘ │
                └────────────────────────────────────────────────────────────┘
```

## Shaman Server (Control Plane & Gateway)

The Shaman Server serves as the system's nerve center, handling all external interactions while coordinating the underlying execution infrastructure.

### GraphQL API Engine

The GraphQL API provides the primary interface for client applications:

```typescript
interface GraphQLAPIEngine {
  apolloServer: ApolloServer;
  subscriptionManager: SubscriptionManager;
  authenticationMiddleware: AuthMiddleware;
  authorizationResolver: AuthResolver;
  rateLimiter: RateLimiter;
}

interface SubscriptionManager {
  createSubscription(sessionId: string, query: string): Subscription;
  publishToSubscription(subscriptionId: string, data: any): void;
  cleanupExpiredSubscriptions(): void;
  getActiveSubscriptions(): SubscriptionInfo[];
}

interface AuthMiddleware {
  validateJWT(token: string): Promise<UserContext>;
  checkPermissions(user: UserContext, operation: string): Promise<boolean>;
  rateLimit(user: UserContext, operation: string): Promise<RateLimitResult>;
}
```

### A2A Gateway

The A2A Gateway exposes internal git-based agents to external A2A clients:

```typescript
interface A2AGateway {
  agentCardGenerator: A2AAgentCardGenerator;
  requestHandler: A2ARequestHandler;
  authValidator: A2AAuthValidator;
  rateLimiter: A2ARateLimiter;
}

interface A2AAgentCardGenerator {
  generateAgentCard(): Promise<A2AAgentCard>;
  generateSkillsFromGitAgents(allowedAgents: string[]): Promise<A2ASkill[]>;
  updateAgentCard(): Promise<void>;
}

interface A2ARequestHandler {
  handleMessageSend(params: A2AMessageSendParams): Promise<A2AResponse>;
  handleMessageStream(
    params: A2AMessageSendParams
  ): AsyncIterableIterator<A2AStreamEvent>;
  handleTasksGet(params: A2ATaskQueryParams): Promise<A2ATask>;
  handleTasksCancel(params: A2ATaskIdParams): Promise<A2ATask>;
}

interface A2AAuthValidator {
  validateApiKey(apiKey: string): Promise<ClientContext>;
  validateOAuth2Token(token: string): Promise<ClientContext>;
  validateAgentAccess(
    client: ClientContext,
    agentName: string
  ): Promise<boolean>;
}
```

### Git Agent Discovery Service

The discovery service manages git repository synchronization and agent resolution:

```typescript
interface GitAgentDiscoveryService {
  syncRepository(repoName: string): Promise<SyncResult>;
  syncAllRepositories(): Promise<SyncResult[]>;
  findAgent(agentName: string): Promise<GitAgent | null>;
  resolveAgentPath(agentName: string): Promise<AgentResolution>;
  listAgents(filters?: AgentFilters): Promise<GitAgent[]>;
  getAgentHistory(agentName: string): Promise<GitCommit[]>;
}

interface AgentResolution {
  agentName: string;
  repositoryName: string;
  filePath: string;
  isNamespaced: boolean;
  gitCommit: string;
  resolvedAt: Date;
  resolutionPath: string[];
}

interface GitAgent {
  name: string;
  description: string;
  version: string;
  tags: string[];
  model: string;
  providers: string[];
  mcpServers: string[];
  allowedAgents: string[];
  examples: string[];

  // Git metadata
  repositoryName: string;
  filePath: string;
  gitCommit: string;
  lastModified: Date;

  // Parsed content
  promptTemplate: string;
  frontmatter: AgentFrontmatter;
}

interface SyncResult {
  repositoryName: string;
  success: boolean;
  syncedCommit: string;
  previousCommit: string;
  discoveredAgents: GitAgent[];
  syncErrors: SyncError[];
  syncDuration: number;
  changedFiles: string[];
}
```

### External A2A Registry

The registry manages external A2A agent integrations:

```typescript
interface ExternalA2ARegistry {
  registerAgent(config: A2AAgentConfig): Promise<ExternalAgent>;
  discoverAgents(endpoint: string): Promise<ExternalAgent[]>;
  getAgentCard(agentName: string): Promise<A2AAgentCard>;
  healthCheck(agentName: string): Promise<HealthStatus>;
  listExternalAgents(): Promise<ExternalAgent[]>;
  refreshAgentCard(agentId: string): Promise<A2AAgentCard>;
  removeAgent(agentId: string): Promise<boolean>;
}

interface ExternalAgent {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  agentCard: A2AAgentCard;
  authConfig: A2AAuthConfig;
  isActive: boolean;
  lastHealthCheck: Date;
  healthStatus: "healthy" | "unhealthy" | "unknown";
  responseTimeP95: number;
  errorRate: number;
  skills: A2ASkill[];
}

interface A2AAuthConfig {
  type: "apiKey" | "oauth2" | "basic" | "none";
  apiKey?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  basicUsername?: string;
  basicPassword?: string;
}
```

### Real-time Streaming Hub

The streaming hub manages WebSocket connections and event distribution:

```typescript
interface StreamingHub {
  connectionManager: WebSocketConnectionManager;
  eventPublisher: EventPublisher;
  subscriptionRegistry: SubscriptionRegistry;
  eventFilter: EventFilter;
}

interface WebSocketConnectionManager {
  addConnection(connection: WebSocketConnection): void;
  removeConnection(connectionId: string): void;
  getConnection(connectionId: string): WebSocketConnection | null;
  broadcastToSubscribers(event: StreamEvent, filter: EventFilter): void;
}

interface EventPublisher {
  publishStreamChunk(runId: string, chunk: StreamChunk): Promise<void>;
  publishRunUpdate(run: Run): Promise<void>;
  publishInputRequest(inputRequest: InputRequest): Promise<void>;
  publishAgentCall(callEvent: AgentCallEvent): Promise<void>;
}

interface SubscriptionRegistry {
  addSubscription(sub: StreamSubscription): void;
  removeSubscription(subscriptionId: string): void;
  getSubscriptionsForEvent(event: StreamEvent): StreamSubscription[];
  cleanupExpiredSubscriptions(): void;
}
```

## Workflow Engine (Execution Plane)

The workflow engine provides durable execution with pluggable backends:

```typescript
interface WorkflowEngineAdapter {
  startRuns(inputs: RunAgentInput[]): Promise<RunIdentifier[]>;
  getRun(id: RunIdentifier): Promise<Run | null>;
  listRuns(options: ListRunsOptions): Promise<Run[]>;
  getRunHistory(id: RunIdentifier): Promise<Step[]>;
  terminateRun(id: RunIdentifier): Promise<boolean>;
  pauseRun(id: RunIdentifier): Promise<boolean>;
  resumeRun(id: RunIdentifier, userInput?: string): Promise<boolean>;
  handleCompletion(stepId: string, completion: AgentCompletion): Promise<void>;
  getEngineStatus(): Promise<EngineStatus>;
  engineType: string;
}

interface AgentCompletion {
  result: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  confidence: number;
  requiresFollowup: boolean;
  metadata?: any;
  completedAt: Date;
}

interface RunAgentInput {
  agentName: string;
  input: string;
  contextScope?: "FULL" | "NONE" | "SPECIFIC";
  maxCallDepth?: number;
  gitCommit?: string;
  parentStepId?: string;
  parentRunId?: string;
  callStack?: string[];
}
```

### Temporal.io Adapter

Production-grade workflow execution with Temporal.io:

```typescript
interface TemporalAdapter extends WorkflowEngineAdapter {
  workflowClient: WorkflowClient;
  workerManager: WorkerManager;
  activityRegistry: ActivityRegistry;
}

interface WorkerManager {
  startWorkers(count: number): Promise<void>;
  stopWorkers(): Promise<void>;
  getWorkerStatus(): WorkerStatus[];
  scaleWorkers(targetCount: number): Promise<void>;
}

interface ActivityRegistry {
  registerActivity(name: string, handler: ActivityHandler): void;
  getActivity(name: string): ActivityHandler | null;
  listActivities(): string[];
}

// Core Temporal activities
interface TemporalActivities {
  callLLM(params: LLMCallParams): Promise<LLMResponse>;
  executeTool(params: ToolCallParams): Promise<ToolResult>;
  executeChildAgent(params: ChildAgentParams): Promise<AgentCompletion>;
  publishStream(params: StreamEventParams): Promise<void>;
  resolveGitAgent(params: AgentResolveParams): Promise<ResolvedAgent>;
  waitForCompletion(
    stepId: string,
    timeoutMs: number
  ): Promise<AgentCompletion>;
}
```

### BullMQ Adapter

Development-friendly queue-based execution:

```typescript
interface BullMQAdapter extends WorkflowEngineAdapter {
  queue: Queue;
  worker: Worker;
  scheduler: QueueScheduler;
  eventBus: EventBus;
}

interface QueueJobData {
  type: "executeStep" | "waitForCompletion" | "handleInput";
  stepId: string;
  runId: string;
  agentName: string;
  input: string;
  contextScope: string;
  gitCommit?: string;
  parentStepId?: string;
  callStack: string[];
  retryCount: number;
  createdAt: Date;
}

interface CompletionWaiter {
  waitForStepCompletion(
    stepId: string,
    timeoutMs: number
  ): Promise<AgentCompletion>;
  notifyCompletion(stepId: string, completion: AgentCompletion): void;
  cleanupExpiredWaiters(): void;
}
```

## Worker Process (Execution Units)

Workers handle the actual agent execution, tool calls, and LLM interactions:

```typescript
interface WorkerProcess {
  gitAgentResolver: GitAgentResolver;
  llmClient: LLMClient;
  toolCallRouter: ToolCallRouter;
  a2aClientHandler: A2AClientHandler;
  streamPublisher: StreamPublisher;
}

interface GitAgentResolver {
  resolveAgent(agentName: string, requestTime?: Date): Promise<ResolvedAgent>;
  loadAgentDefinition(
    repo: string,
    path: string,
    commit: string
  ): Promise<AgentDefinition>;
  parseAgentFrontmatter(markdown: string): Promise<AgentFrontmatter>;
  validateAgentDefinition(definition: AgentDefinition): ValidationResult;
}

interface ResolvedAgent {
  agent: GitAgent | ExternalAgent;
  source: "git" | "a2a";
  repository?: string;
  commit?: string;
  endpoint?: string;
  isNamespaced: boolean;
  resolutionTime: Date;
}

interface AgentDefinition {
  frontmatter: AgentFrontmatter;
  promptTemplate: string;
  gitMetadata: {
    repository: string;
    filePath: string;
    commit: string;
    lastModified: Date;
  };
}
```

### LLM Integration

The LLM client handles all provider interactions:

```typescript
interface LLMClient {
  callLLM(params: LLMCallParams): Promise<LLMResponse>;
  streamLLM(params: LLMCallParams): AsyncIterableIterator<LLMStreamChunk>;
  getAvailableModels(provider: string): Promise<ModelInfo[]>;
  estimateCost(params: LLMCallParams): Promise<CostEstimate>;
}

interface LLMCallParams {
  provider: string;
  model: string;
  messages: Message[];
  tools: Tool[];
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  systemPrompt?: string;
}

interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  cost: number;
  latency: number;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter";
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

### Tool Call Router

The router handles all tool calls and agent calls:

```typescript
interface ToolCallRouter {
  routeToolCall(toolCall: ToolCall, context: ExecutionContext): Promise<ToolResult>;
  validateToolCall(toolCall: ToolCall, availableTools: Tool[]): ValidationResult;
  getSystemTools(): Tool[];
  getMcpTools(serverNames: string[]): Promise<Tool[]>;
}

interface ToolResult {
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
  cost?: number;
  metadata?: any;
}

interface ExecutionContext {
  currentStep: Step;
  currentAgent: GitAgent;
  callStack: string[];
  streamPublisher: StreamPublisher;
  availableTools: Tool[];
  maxCallDepth: number;
}

interface ToolCallRouterImpl extends ToolCallRouter {
  systemHandler: SystemToolHandler;
  mcpHandler: MCPToolHandler;
  agentCallHandler: AgentCallHandler;

  async routeToolCall(toolCall: ToolCall, context: ExecutionContext): Promise<ToolResult> {
    const { name, arguments: args } = toolCall.function;

    switch (name) {
      case 'call_agent':
        return await this.agentCallHandler.handleAgentCall(args, context);

      case 'complete_agent_execution':
        return await this.systemHandler.handleCompletion(args, context);

      case 'request_user_input':
        return await this.systemHandler.handleInputRequest(args, context);

      default:
        return await this.mcpHandler.callMcpTool(name, args, context);
    }
  }
}
```

### Agent Call Handler

Handles calls between agents with completion tracking:

```typescript
interface AgentCallHandler {
  handleAgentCall(args: AgentCallArgs, context: ExecutionContext): Promise<ToolResult>;
  validateAgentCallPermissions(callerAgent: GitAgent, targetAgent: string): Promise<boolean>;
  validateNoCircularCalls(callStack: string[], targetAgent: string): void;
  startChildAgentRun(params: ChildAgentParams): Promise<Run>;
  waitForAgentCompletion(runId: string): Promise<AgentCompletion>;
}

interface AgentCallArgs {
  agent_name: string;
  input: string;
  context_scope?: 'FULL' | 'NONE' | 'SPECIFIC';
}

interface ChildAgentParams {
  agentName: string;
  agentSource: 'git' | 'a2a';
  gitRepository?: string;
  gitCommit?: string;
  input: string;
  contextScope: string;
  parentStepId: string;
  parentRunId: string;
  callStack: string[];
  maxCallDepth: number;
}

interface AgentCallHandlerImpl extends AgentCallHandler {
  async handleAgentCall(args: AgentCallArgs, context: ExecutionContext): Promise<ToolResult> {
    const { agent_name, input, context_scope = 'FULL' } = args;

    // 1. Resolve agent (git or external A2A)
    const resolvedAgent = await this.gitAgentResolver.resolveAgent(agent_name);

    // 2. Validate permissions
    await this.validateAgentCallPermissions(context.currentAgent, agent_name);

    // 3. Prevent circular calls
    this.validateNoCircularCalls(context.callStack, agent_name);

    // 4. Execute based on agent source
    let completion: AgentCompletion;

    if (resolvedAgent.source === 'git') {
      completion = await this.executeGitAgent(resolvedAgent, input, context);
    } else if (resolvedAgent.source === 'a2a') {
      completion = await this.a2aClientHandler.callExternalAgent(agent_name, input, context);
    } else {
      throw new Error(`Unknown agent source: ${resolvedAgent.source}`);
    }

    // 5. Return completion as tool result
    return {
      success: completion.status !== 'FAILED',
      result: completion.result,
      executionTime: completion.metadata?.executionTime || 0,
      metadata: {
        status: completion.status,
        confidence: completion.confidence,
        requiresFollowup: completion.requiresFollowup,
        agentSource: resolvedAgent.source,
        gitCommit: resolvedAgent.commit,
        cost: completion.metadata?.cost
      }
    };
  }
}
```

### A2A Client Implementation

Handles calls to external A2A agents:

```typescript
interface A2AClientHandler {
  callExternalAgent(agentName: string, input: string, context: ExecutionContext): Promise<AgentCompletion>;
  discoverExternalAgent(endpoint: string): Promise<A2AAgentCard>;
  translateToA2AMessage(input: string, context: ExecutionContext): A2AMessage;
  translateFromA2ATask(task: A2ATask): AgentCompletion;
}

interface A2AClientHandlerImpl extends A2AClientHandler {
  async callExternalAgent(agentName: string, input: string, context: ExecutionContext): Promise<AgentCompletion> {
    const externalAgent = await this.externalA2ARegistry.findAgent(agentName);
    if (!externalAgent) {
      throw new Error(`External agent ${agentName} not registered`);
    }

    // 1. Prepare A2A message
    const a2aMessage: A2AMessage = {
      role: 'user',
      parts: [{ kind: 'text', text: input }],
      messageId: generateId(),
      taskId: context.currentStep.runId,
      contextId: context.currentStep.runId
    };

    // 2. Send A2A request
    const response = await this.sendA2ARequest(externalAgent, {
      jsonrpc: '2.0',
      id: generateId(),
      method: 'message/send',
      params: {
        message: a2aMessage,
        configuration: {
          acceptedOutputModes: ['text/plain', 'application/json'],
          blocking: true
        }
      }
    });

    // 3. Handle response
    if (response.result.kind === 'task') {
      return await this.waitForA2ATaskCompletion(externalAgent, response.result);
    } else if (response.result.kind === 'message') {
      return this.translateMessageToCompletion(response.result);
    }

    throw new Error('Invalid A2A response format');
  }

  private async waitForA2ATaskCompletion(agent: ExternalAgent, task: A2ATask): Promise<AgentCompletion> {
    let currentTask = task;

    while (!this.isTerminalState(currentTask.status.state)) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await this.sendA2ARequest(agent, {
        jsonrpc: '2.0',
        id: generateId(),
        method: 'tasks/get',
        params: { id: currentTask.id }
      });

      currentTask = response.result;
    }

    return this.translateTaskToCompletion(currentTask);
  }

  private translateTaskToCompletion(task: A2ATask): AgentCompletion {
    const isSuccess = task.status.state === 'completed';
    const result = task.artifacts?.length > 0
      ? this.extractTextFromArtifacts(task.artifacts)
      : task.status.message?.parts?.map(p => p.kind === 'text' ? p.text : '').join('') || 'No result';

    return {
      result: result,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      confidence: isSuccess ? 0.9 : 0.0,
      requiresFollowup: task.status.state === 'input-required' || task.status.state === 'auth-required',
      metadata: {
        externalTaskId: task.id,
        finalState: task.status.state,
        artifacts: task.artifacts?.length || 0
      }
    };
  }
}
```

### Prompt Template Resolution

Handles agent prompt template processing:

```typescript
interface PromptTemplateResolver {
  resolvePromptTemplate(agent: GitAgent, userInput: string): Promise<string>;
  getSystemTools(): Tool[];
  getMcpServerTools(serverNames: string[]): Promise<Tool[]>;
  resolveAllowedAgents(allowedAgentNames: string[]): Promise<AgentSummary[]>;
}

interface PromptTemplateResolverImpl extends PromptTemplateResolver {
  async resolvePromptTemplate(agent: GitAgent, userInput: string): Promise<string> {
    const availableTools = await this.getMcpServerTools(agent.mcpServers);
    const allowedAgents = await this.resolveAllowedAgents(agent.allowedAgents);

    // Add system tools
    const allTools = [...availableTools, ...this.getSystemTools()];

    // Resolve template variables
    return agent.promptTemplate
      .replace('{{agent_name}}', agent.name)
      .replace('{{agent_description}}', agent.description)
      .replace('{{prompt}}', userInput)
      .replace('{{available_tools}}', this.formatToolsForPrompt(allTools))
      .replace('{{allowed_agents}}', this.formatAgentsForPrompt(allowedAgents));
  }

  private async resolveAllowedAgents(allowedAgentNames: string[]): Promise<AgentSummary[]> {
    const agents: AgentSummary[] = [];

    for (const agentName of allowedAgentNames) {
      try {
        const resolved = await this.gitAgentResolver.resolveAgent(agentName);
        agents.push({
          name: agentName,
          description: resolved.agent.description,
          examples: resolved.agent.examples || [],
          source: resolved.source
        });
      } catch (error) {
        console.warn(`Could not resolve allowed agent: ${agentName}`, error);
      }
    }

    return agents;
  }

  private formatAgentsForPrompt(agents: AgentSummary[]): string {
    return agents.map(agent => {
      const sourceIndicator = agent.source === 'a2a' ? ' (external)' : '';
      return `- **${agent.name}${sourceIndicator}**: ${agent.description}\n  Examples: ${agent.examples.join(', ') || 'General tasks'}`;
    }).join('\n');
  }

  private formatToolsForPrompt(tools: Tool[]): string {
    return tools.map(tool => {
      return `- **${tool.name}**: ${tool.description}`;
    }).join('\n');
  }
}

interface AgentSummary {
  name: string;
  description: string;
  examples: string[];
  source: 'git' | 'a2a';
}
```

## Infrastructure Components

### Stream Publisher

Manages real-time event streaming:

```typescript
interface StreamPublisher {
  publishTokenChunk(
    runId: string,
    stepId: string,
    chunk: TokenChunk
  ): Promise<void>;
  publishToolCall(
    runId: string,
    stepId: string,
    toolCall: ToolCallStartChunk
  ): Promise<void>;
  publishToolResult(
    runId: string,
    stepId: string,
    result: ToolResultChunk
  ): Promise<void>;
  publishCompletion(
    runId: string,
    stepId: string,
    completion: CompletionChunk
  ): Promise<void>;
  publishInputRequest(
    runId: string,
    inputRequest: InputRequestChunk
  ): Promise<void>;
  publishAgentCall(
    runId: string,
    agentCall: AgentCallStartChunk
  ): Promise<void>;
}

interface StreamChunk {
  runId: string;
  stepId: string;
  timestamp: Date;
  sequenceNumber: number;
  type: string;
  payload: any;
}
```

This architecture provides a scalable, observable, and maintainable system for managing AI agents as code while supporting both internal git-based agents and external A2A federation.

---

**Navigation:**

- [← Previous: Use Cases & Agent Model](./02-use-cases-and-agent-model.md)
- [🏠 Home](./README.md)
- [Next: API, Config & Deployment →](./04-api-config-and-deployment.md)
