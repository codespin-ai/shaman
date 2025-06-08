# 4. Detailed System Architecture

### 4.1 Component Overview

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

### 4.2 Shaman Server (Control Plane & Gateway)

The `packages/shaman` Node.js application, serving as the system's nerve center.

#### 4.2.1 GraphQL API Engine

- **Technology:** Apollo Server with GraphQL subscriptions over WebSockets
- **Authentication:** JWT-based with role-based access control (RBAC)
- **Authorization:** Field-level permissions based on user roles and git repository access
- **Rate Limiting:** Per-user and per-endpoint limits to prevent abuse
- **Validation:** Comprehensive input validation with detailed error messages

#### 4.2.2 A2A Gateway

- **HTTP Server:** Express.js endpoints implementing A2A JSON-RPC methods
- **Request Routing:** Routes A2A requests to appropriate git-based agents
- **AgentCard Generation:** Dynamic generation from git agent definitions
- **Authentication:** Configurable security schemes per exposed agent path
- **Response Translation:** Git agent completions → A2A task/message format
- **Streaming Support:** A2A SSE streaming for long-running git agent executions

#### 4.2.3 Git Agent Discovery Service

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
  
  // Git metadata
  repositoryName: string;
  filePath: string;
  gitCommit: string;
  lastModified: Date;
  
  // Parsed content
  promptTemplate: string;
  frontmatter: AgentFrontmatter;
}
```

#### 4.2.4 External A2A Registry

```typescript
interface ExternalA2ARegistry {
  registerAgent(config: A2AAgentConfig): Promise<ExternalAgent>;
  discoverAgents(endpoint: string): Promise<ExternalAgent[]>;
  getAgentCard(agentName: string): Promise<A2AAgentCard>;
  healthCheck(agentName: string): Promise<HealthStatus>;
  listExternalAgents(): Promise<ExternalAgent[]>;
}

interface ExternalAgent {
  name: string;
  description: string;
  endpoint: string;
  agentCard: A2AAgentCard;
  authConfig: A2AAuthConfig;
  isActive: boolean;
  lastHealthCheck: Date;
}
```

#### 4.2.5 Real-time Streaming Hub

- **WebSocket Management:** Handles GraphQL subscription connections
- **Redis Pub/Sub:** Subscribes to worker-generated stream events
- **Event Filtering:** Ensures clients only receive authorized events
- **Connection Scaling:** Supports horizontal scaling with Redis clustering
- **Input Request Notifications:** Real-time alerts when agents request user input

#### 4.2.6 Operational Constraints

- **No LLM Calls:** Server never directly calls LLM providers
- **Stateless Design:** All persistent state in PostgreSQL/Redis
- **High Availability:** Designed for multi-instance deployment
- **Git Synchronization:** Periodic syncing of agent repositories

### 4.3 Workflow Engine (Execution Plane)

Pluggable backend for durable workflow execution with git versioning and completion support.

#### 4.3.1 Temporal.io Adapter (Production)

- **Workflows:** `executeAgentStep` workflow with child workflow support
- **Activities:** `callLLM`, `executeTool`, `executeChildAgent`, `saveMemory`, `publishStream`, `resolveGitAgent`
- **Git Version Tracking:** Each execution captures exact git commit for traceability
- **Completion Handling:** Native support for waiting on explicit completion signals
- **Durability:** Automatic state persistence and recovery
- **Scaling:** Horizontal worker scaling with automatic load balancing

#### 4.3.2 BullMQ Adapter (Development)

- **Queue Structure:** Single queue with job prioritization
- **Jobs:** `executeStep` jobs with retry policies and completion detection
- **Git Integration:** Jobs include git commit references for agent resolution
- **Redis Backend:** Requires Redis for job persistence and completion signaling
- **Simplified Logic:** Easier local development and testing

#### 4.3.3 Interface Definition

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
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  confidence: number;
  requiresFollowup: boolean;
  metadata?: any;
}
```

### 4.4 Worker Process (Execution Units)

Scalable Node.js processes performing the actual agent execution with git resolution and completion handling.

#### 4.4.1 Core Responsibilities

- **Job Consumption:** Pull and execute jobs from workflow engine
- **Git Agent Resolution:** Load agent definitions from git repositories at specific commits
- **LLM Interaction:** Only component making direct LLM API calls
- **Tool Execution:** Handle MCP and A2A tool calls
- **Agent Completion:** Process and validate explicit completion tool calls
- **Child Agent Coordination:** Manage agent-to-agent calls with completion waiting
- **External A2A Communication:** Handle calls to external A2A agents
- **Stream Publishing:** Push real-time events to Redis

#### 4.4.2 Git Agent Resolution

```typescript
interface GitAgentResolver {
  resolveAgent(agentName: string, requestTime?: Date): Promise<ResolvedAgent>;
  loadAgentDefinition(repo: string, path: string, commit: string): Promise<AgentDefinition>;
  parseAgentFrontmatter(markdown: string): Promise<AgentFrontmatter>;
  validateAgentDefinition(definition: AgentDefinition): ValidationResult;
}

class GitAgentResolverImpl implements GitAgentResolver {
  async resolveAgent(agentName: string): Promise<ResolvedAgent> {
    // 1. Check root repositories first (unnamespaced)
    for (const rootRepo of this.rootRepositories) {
      const agent = await this.findAgentInRepo(rootRepo, agentName);
      if (agent) {
        return {
          agent: agent,
          source: 'git',
          repository: rootRepo.name,
          commit: rootRepo.currentCommit,
          isNamespaced: false
        };
      }
    }
    
    // 2. Check namespaced repositories
    if (agentName.includes('/')) {
      const [namespace, ...pathParts] = agentName.split('/');
      const agentPath = pathParts.join('/');
      
      const namespacedRepo = this.namedRepositories.get(namespace);
      if (namespacedRepo) {
        const agent = await this.findAgentInRepo(namespacedRepo, agentPath);
        if (agent) {
          return {
            agent: agent,
            source: 'git',
            repository: namespacedRepo.name,
            commit: namespacedRepo.currentCommit,
            isNamespaced: true
          };
        }
      }
    }
    
    // 3. Check external A2A agents
    const externalAgent = await this.externalA2ARegistry.findAgent(agentName);
    if (externalAgent) {
      return {
        agent: externalAgent,
        source: 'a2a',
        endpoint: externalAgent.endpoint,
        isNamespaced: false
      };
    }
    
    throw new Error(`Agent ${agentName} not found in any repository or external registry`);
  }
  
  async loadAgentDefinition(repo: string, path: string, commit: string): Promise<AgentDefinition> {
    // Load specific version of agent from git
    const markdown = await this.gitService.getFile(repo, path, commit);
    const parsed = await this.parseAgentFrontmatter(markdown);
    
    return {
      frontmatter: parsed.frontmatter,
      promptTemplate: parsed.content,
      gitMetadata: {
        repository: repo,
        filePath: path,
        commit: commit,
        lastModified: await this.gitService.getFileLastModified(repo, path, commit)
      }
    };
  }
}
```

#### 4.4.3 LLM Integration

- **Vercel AI SDK:** Primary interface for all LLM interactions
- **Provider Abstraction:** Support for OpenAI, Anthropic, Groq, Ollama
- **Streaming Support:** Real-time token streaming with chunk aggregation
- **Error Handling:** Comprehensive retry policies and error categorization
- **Tool Injection:** Automatically provides system tools to all agents
- **Prompt Template Resolution:** Injects available tools and agents into templates


#### 4.4.4 A2A Client Implementation

This implementation now includes logic to handle different authentication strategies for external A2A agents, most importantly the OAuth 2.0 On-Behalf-Of (OBO) flow to propagate end-user identity securely.

```typescript
// NEW: Context must carry the initial user's identity token for OBO flow
interface ExecutionContext {
  currentStep: Step;
  currentAgent: GitAgent;
  callStack: string[];
  user: {
    id: string;
    originalJwt: string; // The validated JWT from the end-user's initial request
  };
}

// NEW: A service dedicated to handling token exchanges
interface TokenExchangeService {
  getOnBehalfOfToken(
    userAssertion: string, 
    oboConfig: OboAuthConfig
  ): Promise<string>;
}

interface A2AClientHandler {
  callExternalAgent(agentName: string, input: string, context: ExecutionContext): Promise<AgentCompletion>;
  discoverExternalAgent(endpoint: string): Promise<A2AAgentCard>;
  translateToA2AMessage(input: string, context: ExecutionContext): A2AMessage;
  translateFromA2ATask(task: A2ATask): AgentCompletion;
}

class A2AClientHandlerImpl implements A2AClientHandler {
  private readonly tokenExchangeService: TokenExchangeService;
  // ... other dependencies

  async callExternalAgent(agentName: string, input: string, context: ExecutionContext): Promise<AgentCompletion> {
    const externalAgent = await this.externalA2ARegistry.findAgent(agentName);
    if (!externalAgent) {
      throw new Error(`External agent ${agentName} not registered`);
    }

    // 1. Determine authentication strategy and acquire token
    let authorizationHeader: string | undefined;
    const authConfig = externalAgent.authConfig;

    if (authConfig.type === 'oauth2-obo') {
      // User-delegated identity flow
      if (!context.user.originalJwt) {
        throw new Error('User identity token not available for On-Behalf-Of flow.');
      }
      const delegatedToken = await this.tokenExchangeService.getOnBehalfOfToken(
        context.user.originalJwt,
        authConfig
      );
      authorizationHeader = `Bearer ${delegatedToken}`;

    } else if (authConfig.type === 'oauth2-client-credentials') {
      // Service-to-service identity flow
      const serviceToken = await this.getServiceToken(authConfig);
      authorizationHeader = `Bearer ${serviceToken}`;

    } else if (authConfig.type === 'apiKey') {
      // Simple API key authentication
      // Note: The specific header name should be part of the authConfig
      // For simplicity, we assume a common header here.
      // headers[authConfig.headerName] = authConfig.apiKey;
    }
    
    // 2. Prepare and send A2A request
    const a2aMessage: A2AMessage = { /* ... */ };
    const headers = { 'Content-Type': 'application/json' };
    if (authorizationHeader) {
      headers['Authorization'] = authorizationHeader;
    }

    const response = await this.sendA2ARequest(externalAgent.endpoint, {
      /* ... A2A request payload ... */
    }, { headers });
    
    // 3. Handle response and translate to AgentCompletion
    // ... (rest of the logic)
  }
}
```

#### 4.4.5 Tool Call Router

```typescript
interface ToolCallRouter {
  routeToolCall(toolCall: ToolCall, context: ExecutionContext): Promise<ToolResult>;
}

class ToolCallRouterImpl implements ToolCallRouter {
  async routeToolCall(toolCall: ToolCall, context: ExecutionContext): Promise<ToolResult> {
    const { name, arguments: args } = toolCall.function;
    
    switch (name) {
      case 'call_agent':
        return await this.agentCallHandler.handleAgentCall(args, context);
        
      case 'complete_agent_execution':
        return await this.systemHandler.handleCompletion(args, context);
        
      case 'request_user_input':
        return await this.systemHandler.handleInputRequest(args, context);
        
      case 'save_memory':
      case 'load_memory':
        return await this.systemHandler.handleMemory(name, args, context);
        
      default:
        // Handle MCP tool
        return await this.mcpHandler.callMcpTool(name, args, context);
    }
  }
}
```

#### 4.4.6 Agent Call Handler Implementation

The Agent Call Handler is responsible for orchestrating calls to other agents. Crucially, it must pass the full `ExecutionContext`, including the end-user's JWT, to downstream handlers like the `A2AClientHandler`.

```typescript
interface AgentCallHandler {
  handleAgentCall(args: AgentCallArgs, context: ExecutionContext): Promise<ToolResult>;
}

class AgentCallHandlerImpl implements AgentCallHandler {
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
      // Critical: The full context, including the user's token, is passed down.
      completion = await this.a2aClientHandler.callExternalAgent(agent_name, input, context);
    } else {
      throw new Error(`Unknown agent source: ${resolvedAgent.source}`);
    }
    
    // 5. Return completion as tool result
    return {
      success: completion.status !== 'FAILED',
      result: completion.result,
      metadata: {
        status: completion.status,
        confidence: completion.confidence,
        requiresFollowup: completion.requiresFollowup,
        agentSource: resolvedAgent.source,
        gitCommit: resolvedAgent.commit,
        executionTime: completion.metadata?.executionTime,
        cost: completion.metadata?.cost
      }
    };
  }
  
  private async executeGitAgent(
    resolvedAgent: ResolvedAgent, 
    input: string, 
    context: ExecutionContext
  ): Promise<AgentCompletion> {
    // Start child agent execution with git version tracking
    const childRun = await this.startChildAgentRun({
      agentName: resolvedAgent.agent.name,
      agentSource: 'git',
      gitRepository: resolvedAgent.repository,
      gitCommit: resolvedAgent.commit,
      input: input,
      contextScope: context_scope,
      parentStepId: context.currentStep.id,
      parentRunId: context.currentStep.runId,
      callStack: [...context.callStack, context.currentAgent.name]
    });
    
    // Wait for explicit completion
    return await this.waitForAgentCompletion(childRun.id);
  }
}
```

#### 4.4.7 Prompt Template Resolution

```typescript
interface PromptTemplateResolver {
  resolvePromptTemplate(agent: GitAgent, userInput: string): Promise<string>;
}

class PromptTemplateResolverImpl implements PromptTemplateResolver {
  async resolvePromptTemplate(agent: GitAgent, userInput: string): Promise<string> {
    const availableTools = await this.getMcpServerTools(agent.mcpServers);
    const allowedAgents = await this.resolveAllowedAgents(agent.allowedAgents);
    
    // Add system tools
    const allTools = [
      ...availableTools,
      ...this.getSystemTools()
    ];
    
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
}
```
