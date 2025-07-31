# Workflow Engine Adapters

Shaman's workflow engine adapter system provides a **unified interface** for orchestrating agent conversations across different workflow engines. This allows you to choose the best engine for your use case while maintaining consistent behavior and switching engines without code changes.

## Architecture Overview

The workflow engine adapter acts as a **translation layer** between Shaman's agent orchestration needs and the underlying workflow engine's capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHAMAN AGENT ORCHESTRATOR                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Unified Interface
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                WORKFLOW ENGINE ADAPTER                          │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Temporal      │  │     BullMQ      │  │     Custom      │  │
│  │   Adapter       │  │    Adapter      │  │    Adapter      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ Engine-Specific Implementation
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│              WORKFLOW EXECUTION ENGINES                         │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Temporal      │  │      Redis      │  │   Your Custom   │  │
│  │   Cluster       │  │   + BullMQ      │  │     Engine      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Adapter Interface

All workflow engine adapters implement the ExecutionEngine interface from `@codespin/shaman-workflow-core`:

```typescript
export interface ExecutionEngine {
  // Start a new workflow run
  startRun(request: {
    agentName: string;
    input: string;
    context?: WorkflowContext;
    metadata?: Record<string, unknown>;
  }): Promise<Result<Run>>;

  // Execute an agent within a workflow
  executeAgent(request: AgentExecutionRequest): Promise<Result<AgentExecutionResult>>;

  // Get run status and details
  getRun(runId: string): Promise<Result<Run | null>>;

  // List runs with filtering
  listRuns(options?: {
    status?: ExecutionState[];
    limit?: number;
    offset?: number;
  }): Promise<Result<Run[]>>;

  // Send signals to running workflows
  sendSignal(runId: string, signal: {
    name: string;
    payload: unknown;
  }): Promise<Result<void>>;

  // Query workflow state
  queryWorkflow<T = unknown>(runId: string, query: {
    name: string;
    args?: unknown;
  }): Promise<Result<T>>;

  // Cancel a running workflow
  cancelRun(runId: string, reason: string): Promise<Result<void>>;

  // Get detailed execution history
  getExecutionHistory(runId: string): Promise<Result<Step[]>>;
}
```

## Implementation Status

### ✅ Temporal Adapter (Implemented)

The Temporal adapter provides enterprise-grade workflow orchestration:

```typescript
import { createExecutionEngine } from '@codespin/shaman-workflow-temporal';

const engine = await createExecutionEngine({
  connection: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  },
  namespace: 'default',
  taskQueue: 'shaman-agents',
});
```

Features:
- Durable execution with automatic retries
- Activity-based agent execution
- Signal handling for runtime control
- Query support for workflow introspection
- Full execution history tracking

### 🚧 BullMQ Adapter (Planned)

The BullMQ adapter will provide lightweight queue-based orchestration using Redis.

## Platform Tools Integration

All workflow adapters have access to platform tools for agent collaboration:

```typescript
// Available to all agents via tool router
const platformTools = {
  workflow_data_write: {
    description: 'Write data for other agents to access',
    parameters: {
      key: 'string',
      value: 'any JSON-serializable data',
      metadata: {
        description: 'optional string',
        schema: 'optional JSON schema',
        ttl: 'optional seconds'
      }
    }
  },
  
  workflow_data_read: {
    description: 'Read data written by other agents',
    parameters: {
      key: 'string',
      includeMetadata: 'boolean'
    }
  },
  
  workflow_data_query: {
    description: 'Search for data by pattern',
    parameters: {
      pattern: 'string (supports wildcards)',
      limit: 'number'
    }
  },
  
  workflow_data_list: {
    description: 'List all workflow data',
    parameters: {
      filterByAgent: 'optional agent name',
      prefix: 'optional key prefix',
      limit: 'number'
    }
  }
};
```

All workflow data is:
- **Immutable**: Once written, data cannot be modified
- **Attributed**: Tracked by agent name and step ID
- **Persistent**: Stored in PostgreSQL for durability

## Temporal Adapter

The **Temporal adapter** provides production-grade workflow orchestration with full durability, child workflows, and signal handling.

### Configuration

```typescript
const temporalConfig: TemporalConfig = {
  connection: {
    address: 'temporal.company.com:7233',
    namespace: 'shaman-production',
    tls: {
      clientCertPath: '/etc/certs/client.pem',
      clientKeyPath: '/etc/certs/client.key',
      serverRootCACertPath: '/etc/certs/ca.pem'
    }
  },
  workers: {
    taskQueue: 'shaman-agents',
    maxConcurrentWorkflows: 200,
    maxConcurrentActivities: 500,
    enableLogging: true,
    gracefulShutdownTimeout: 30000
  },
  workflowDefaults: {
    workflowExecutionTimeout: '24h',
    workflowRunTimeout: '2h',
    workflowTaskTimeout: '30s',
    activityTimeout: '10m'
  },
  retryPolicy: {
    initialInterval: '1s',
    backoffCoefficient: 2.0,
    maximumInterval: '60s',
    maximumAttempts: 3
  }
};

// Create Temporal adapter
import { temporal } from '@codespin/shaman-workflow-engine';
const workflowAdapter = temporal.createWorkflowEngineAdapter(temporalConfig);
```

### Temporal Implementation Details

```typescript
// temporal-adapter.ts
export const createTemporalWorkflowEngineAdapter = (config: TemporalConfig): WorkflowEngineAdapter => {
  const client = new WorkflowClient({
    connection: WorkflowClientOptions.getConnection(config.connection)
  });
  
  return {
    
    async startRuns(inputs: RunAgentInput[]): Promise<RunIdentifier[]> {
      const runIds: RunIdentifier[] = [];
      
      for (const input of inputs) {
        // Start Shaman's agent execution workflow
        const handle = await client.start(shamanAgentExecutionWorkflow, {
          taskQueue: config.workers.taskQueue,
          workflowId: `shaman-${input.sessionId}-${Date.now()}`,
          args: [input],
          workflowExecutionTimeout: config.workflowDefaults.workflowExecutionTimeout,
          workflowRunTimeout: config.workflowDefaults.workflowRunTimeout,
          workflowTaskTimeout: config.workflowDefaults.workflowTaskTimeout
        });
        
        runIds.push(handle.workflowId);
      }
      
      return runIds;
    },
    
    async signalRun(id: RunIdentifier, signalName: string, payload: any): Promise<void> {
      const handle = client.getHandle(id);
      await handle.signal(signalName, payload);
    },
    
    async queryRun<T>(id: RunIdentifier, queryName: string): Promise<T> {
      const handle = client.getHandle(id);
      return await handle.query(queryName);
    },
    
    async *streamRunEvents(id: RunIdentifier): AsyncIterable<RunEvent> {
      const handle = client.getHandle(id);
      
      // Poll for workflow events and convert to run events
      let lastEventId = 0;
      
      while (true) {
        try {
          const history = await handle.fetchHistory();
          const newEvents = history.events.slice(lastEventId);
          
          for (const event of newEvents) {
            yield convertTemporalEventToRunEvent(event, id);
          }
          
          lastEventId = history.events.length;
          
          // Check if workflow is complete
          const description = await handle.describe();
          if (description.status.name !== 'RUNNING') {
            break;
          }
          
          await sleep(1000); // Poll every second
        } catch (error) {
          if (error.name === 'WorkflowNotFoundError') {
            break;
          }
          throw error;
        }
      }
    },
    
    async getRunHistory(id: RunIdentifier): Promise<Step[]> {
      const handle = client.getHandle(id);
      const history = await handle.fetchHistory();
      
      return history.events
        .filter(event => event.eventType === 'ActivityTaskCompleted')
        .map(event => convertTemporalEventToStep(event));
    },
    
    async getEngineHealth(): Promise<EngineHealth> {
      try {
        // Check Temporal server health
        const systemInfo = await client.workflowService.getSystemInfo({});
        
        return {
          status: 'healthy',
          version: systemInfo.serverVersion,
          uptime: Date.now() - startTime,
          activeRuns: await getActiveWorkflowCount(),
          capabilities: ['child_workflows', 'signals', 'queries', 'durability', 'retry_logic']
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          capabilities: []
        };
      }
    }
    
    // ... other methods
  };
};

// Shaman's workflow definition for Temporal
export async function shamanAgentExecutionWorkflow(input: RunAgentInput): Promise<AgentCompletion> {
  
  // Set up signal handlers
  const userInputSignal = defineSignal<string>('userInput');
  const asyncToolCompletedSignal = defineSignal<ToolResult>('asyncToolCompleted');
  
  let userInputReceived: string | null = null;
  let asyncToolResults = new Map<string, ToolResult>();
  
  setHandler(userInputSignal, (input) => {
    userInputReceived = input;
  });
  
  setHandler(asyncToolCompletedSignal, (result, metadata) => {
    asyncToolResults.set(metadata.asyncWorkflowId, result);
  });
  
  // Main agent execution loop
  const agent = await activities.shamanResolveAgent(input.agentId);
  let context = await activities.shamanInitializeContext({ agent, input });
  
  let conversationComplete = false;
  
  while (!conversationComplete) {
    // Call LLM
    const llmResponse = await activities.shamanCallLLM({ agent, context });
    
    // Parse agent decisions
    const decisions = await activities.shamanParseDecisions({ llmResponse, agent });
    
    // Process each decision
    for (const decision of decisions) {
      switch (decision.type) {
        
        case 'call_agent':
          // Child workflow for agent delegation
          const childResult = await executeChild(shamanAgentExecutionWorkflow, {
            ...input,
            agentId: decision.targetAgent,
            prompt: decision.prompt,
            parentRunId: workflowInfo().workflowId
          });
          
          context = await activities.shamanMergeContext({ context, childResult });
          break;
          
        case 'execute_tool':
          const toolResult = await activities.shamanExecuteTool({
            toolName: decision.toolName,
            arguments: decision.arguments,
            context
          });
          
          if (toolResult.asyncWorkflowId) {
            // Wait for async tool completion
            await condition(() => asyncToolResults.has(toolResult.asyncWorkflowId), '24h');
            const asyncResult = asyncToolResults.get(toolResult.asyncWorkflowId)!;
            context = await activities.shamanAddToolResult({ context, toolResult: asyncResult });
          } else {
            // Sync tool completed immediately
            context = await activities.shamanAddToolResult({ context, toolResult });
          }
          break;
          
        case 'request_user_input':
          await activities.shamanPublishUserInputRequest({
            sessionId: input.sessionId,
            message: decision.message
          });
          
          // Wait for user input signal
          await condition(() => userInputReceived !== null, '1h');
          
          context = await activities.shamanProcessUserInput({
            context,
            userInput: userInputReceived!
          });
          
          userInputReceived = null; // Reset
          break;
          
        case 'complete':
          conversationComplete = true;
          break;
      }
    }
  }
  
  return await activities.shamanFinalizeConversation({ context });
}
```

### Temporal Capabilities

**✅ What Temporal Provides:**
- **Child Workflows**: Perfect for agent-to-agent calls
- **Signals & Queries**: Real-time communication and status
- **Durable Execution**: Survives crashes, restarts
- **Retry Logic**: Automatic retry with backoff
- **Timeout Handling**: Configurable timeouts at all levels
- **Version Management**: Workflow versioning for deployments
- **Observability**: Rich execution history and metrics

**🎯 Best For:**
- Production environments
- Complex multi-agent workflows
- Long-running conversations
- High reliability requirements
- Enterprise deployments

## BullMQ Adapter

The **BullMQ adapter** provides Redis-based queue orchestration, ideal for development and simpler production scenarios.

### Configuration

```typescript
const bullmqConfig: BullMQConfig = {
  redis: {
    host: 'redis.company.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    lazyConnect: true
  },
  queues: {
    'shaman-agents': {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
          maxDelay: 30000
        }
      },
      settings: {
        stalledInterval: 30000,
        maxStalledCount: 1
      }
    }
  },
  workers: {
    concurrency: 10,
    maxStalledCount: 3,
    stalledInterval: 30000,
    delayedDebounce: 1000
  }
};

// Create BullMQ adapter
import { bullmq } from '@codespin/shaman-workflow-engine';
const workflowAdapter = bullmq.createWorkflowEngineAdapter(bullmqConfig);
```

### BullMQ Implementation Details

```typescript
// bullmq-adapter.ts
export const createBullMQWorkflowEngineAdapter = (config: BullMQConfig): WorkflowEngineAdapter => {
  
  const redis = new Redis(config.redis);
  const queues = new Map<string, Queue>();
  const workers = new Map<string, Worker>();
  const runStatusMap = new Map<string, RunStatus>();
  
  // Initialize queues
  for (const [queueName, queueConfig] of Object.entries(config.queues)) {
    const queue = new Queue(queueName, {
      connection: redis,
      defaultJobOptions: queueConfig.defaultJobOptions
    });
    queues.set(queueName, queue);
  }
  
  return {
    
    async startRuns(inputs: RunAgentInput[]): Promise<RunIdentifier[]> {
      const runIds: RunIdentifier[] = [];
      const queue = queues.get('shaman-agents')!;
      
      for (const input of inputs) {
        const runId = `bullmq-${input.sessionId}-${Date.now()}`;
        
        // Create job for agent execution
        await queue.add('executeAgent', input, {
          jobId: runId,
          attempts: 3,
          backoff: 'exponential'
        });
        
        // Initialize run status
        runStatusMap.set(runId, {
          id: runId,
          status: 'queued',
          startTime: new Date(),
          lastActivity: new Date(),
          childRunIds: [],
          activeChildRuns: 0
        });
        
        runIds.push(runId);
      }
      
      return runIds;
    },
    
    async signalRun(id: RunIdentifier, signalName: string, payload: any): Promise<void> {
      // Use Redis pub/sub for signaling
      const channel = `signal:${id}:${signalName}`;
      await redis.publish(channel, JSON.stringify(payload));
    },
    
    async queryRun<T>(id: RunIdentifier, queryName: string): Promise<T> {
      // Store query results in Redis
      const key = `query:${id}:${queryName}`;
      const result = await redis.get(key);
      return result ? JSON.parse(result) : null;
    },
    
    async *streamRunEvents(id: RunIdentifier): AsyncIterable<RunEvent> {
      // Subscribe to Redis events for this run
      const subscriber = redis.duplicate();
      const channel = `events:${id}`;
      
      await subscriber.subscribe(channel);
      
      const eventQueue: RunEvent[] = [];
      let isComplete = false;
      
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          const event = JSON.parse(message) as RunEvent;
          eventQueue.push(event);
          
          if (event.type === 'run_completed' || event.type === 'run_failed') {
            isComplete = true;
          }
        }
      });
      
      // Yield events as they arrive
      while (!isComplete) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          await sleep(100); // Small delay to prevent busy waiting
        }
      }
      
      // Yield any remaining events
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }
      
      await subscriber.unsubscribe(channel);
      subscriber.disconnect();
    },
    
    async getRunHistory(id: RunIdentifier): Promise<Step[]> {
      // Retrieve stored execution history from Redis
      const key = `history:${id}`;
      const history = await redis.get(key);
      return history ? JSON.parse(history) : [];
    },
    
    async getEngineHealth(): Promise<EngineHealth> {
      try {
        // Check Redis connection and queue status
        const info = await redis.info();
        const queueStats = await Promise.all(
          Array.from(queues.values()).map(q => q.getJobCounts())
        );
        
        const totalActive = queueStats.reduce((sum, stats) => sum + stats.active, 0);
        const totalWaiting = queueStats.reduce((sum, stats) => sum + stats.waiting, 0);
        
        return {
          status: 'healthy',
          version: '1.0.0',
          uptime: Date.now() - startTime,
          activeRuns: totalActive,
          queuedRuns: totalWaiting,
          capabilities: ['queuing', 'retry_logic', 'job_scheduling', 'redis_persistence']
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          capabilities: []
        };
      }
    }
    
    // ... other methods
  };
};

// BullMQ job processor
const createAgentWorker = (config: BullMQConfig) => {
  const worker = new Worker('shaman-agents', async (job) => {
    const input = job.data as RunAgentInput;
    
    // Execute agent workflow using BullMQ job orchestration
    return await executeBullMQAgentWorkflow(input, job);
  }, {
    connection: config.redis,
    concurrency: config.workers.concurrency
  });
  
  return worker;
};

// BullMQ agent workflow implementation
const executeBullMQAgentWorkflow = async (input: RunAgentInput, job: Job): Promise<AgentCompletion> => {
  
  // BullMQ workflow uses job orchestration instead of child workflows
  const runId = job.id!;
  
  // Initialize context
  const agent = await shamanResolveAgent(input.agentId);
  let context = await shamanInitializeContext({ agent, input });
  
  let conversationComplete = false;
  
  while (!conversationComplete) {
    // Update job progress
    await job.updateProgress(25);
    
    // Call LLM
    const llmResponse = await shamanCallLLM({ agent, context });
    
    // Parse decisions
    const decisions = await shamanParseDecisions({ llmResponse, agent });
    
    // Process decisions
    for (const decision of decisions) {
      switch (decision.type) {
        
        case 'call_agent':
          // For BullMQ, create child job instead of child workflow
          const childJobId = await createChildJob(decision.targetAgent, decision.prompt, runId);
          const childResult = await waitForChildJobCompletion(childJobId);
          context = await shamanMergeContext({ context, childResult });
          break;
          
        case 'execute_tool':
          // Tool execution (sync/async handling same as Temporal)
          const toolResult = await shamanExecuteTool({
            toolName: decision.toolName,
            arguments: decision.arguments,
            context
          });
          context = await shamanAddToolResult({ context, toolResult });
          break;
          
        case 'request_user_input':
          // Use Redis pub/sub for user input
          await shamanPublishUserInputRequest({
            sessionId: input.sessionId,
            message: decision.message
          });
          
          const userInput = await waitForUserInputSignal(runId);
          context = await shamanProcessUserInput({ context, userInput });
          break;
          
        case 'complete':
          conversationComplete = true;
          break;
      }
    }
    
    await job.updateProgress(50);
  }
  
  await job.updateProgress(100);
  return await shamanFinalizeConversation({ context });
};
```

### BullMQ Capabilities

**✅ What BullMQ Provides:**
- **Job Queuing**: Reliable job processing with Redis
- **Retry Logic**: Configurable retry policies
- **Job Scheduling**: Delayed and cron-based jobs
- **Progress Tracking**: Real-time job progress updates
- **Job Priorities**: Priority-based job processing
- **Redis Persistence**: Job state persisted in Redis

**⚠️ Limitations vs Temporal:**
- **No Native Child Workflows**: Requires manual job orchestration
- **Limited Signal Support**: Uses Redis pub/sub instead
- **Manual State Management**: Must manage workflow state manually
- **Less Durability**: Depends on Redis persistence

**🎯 Best For:**
- Development environments
- Simpler production workloads
- Redis-based infrastructure
- Cost-effective deployments
- Quick prototyping

## Custom Adapter Implementation

You can implement custom adapters for any workflow engine:

```typescript
// custom-adapter.ts
export const createCustomWorkflowEngineAdapter = (config: CustomConfig): WorkflowEngineAdapter => {
  
  // Your custom workflow engine client
  const customClient = new CustomWorkflowEngine(config);
  
  return {
    
    async startRuns(inputs: RunAgentInput[]): Promise<RunIdentifier[]> {
      // Implement using your custom engine's workflow start API
      const runIds: RunIdentifier[] = [];
      
      for (const input of inputs) {
        const workflow = await customClient.startWorkflow({
          workflowType: 'shaman-agent-execution',
          input: input,
          options: {
            timeout: '24h',
            retryPolicy: { maxRetries: 3 }
          }
        });
        
        runIds.push(workflow.id);
      }
      
      return runIds;
    },
    
    async signalRun(id: RunIdentifier, signalName: string, payload: any): Promise<void> {
      // Implement using your engine's signaling mechanism
      await customClient.sendSignal(id, signalName, payload);
    },
    
    async queryRun<T>(id: RunIdentifier, queryName: string): Promise<T> {
      // Implement using your engine's query mechanism  
      return await customClient.queryWorkflow(id, queryName);
    },
    
    async *streamRunEvents(id: RunIdentifier): AsyncIterable<RunEvent> {
      // Implement using your engine's event streaming
      const eventStream = customClient.streamEvents(id);
      
      for await (const event of eventStream) {
        yield convertToRunEvent(event);
      }
    },
    
    // ... implement other required methods
    
    async getEngineInfo(): Promise<EngineInfo> {
      return {
        name: 'custom',
        version: '1.0.0',
        features: [
          { name: 'workflows', enabled: true },
          { name: 'signals', enabled: true },
          { name: 'queries', enabled: customClient.supportsQueries() }
        ],
        limits: {
          maxConcurrentRuns: 1000,
          maxRunDuration: 86400000 // 24 hours
        }
      };
    }
  };
};
```

## Adapter Selection Guide

### When to Choose Temporal

**✅ Choose Temporal if you need:**
- Production-grade reliability and durability
- Complex multi-agent workflows with child workflows
- Long-running conversations (hours to days)
- Rich signal and query capabilities
- Automatic retry and recovery
- Workflow versioning and migration
- Enterprise-scale deployments

**Example Use Cases:**
- Customer support with multiple agent handoffs
- Complex approval workflows
- Long-running data processing pipelines
- Mission-critical business processes

### When to Choose BullMQ

**✅ Choose BullMQ if you need:**
- Simple job-based workflow orchestration
- Redis-based infrastructure
- Development and testing environments
- Cost-effective deployments
- Quick prototyping and iteration
- Simpler agent interactions

**Example Use Cases:**
- Single-agent conversations
- Simple tool execution workflows
- Development environments
- Cost-sensitive deployments

### When to Build Custom

**✅ Build Custom if you need:**
- Integration with existing workflow systems
- Specific performance requirements
- Custom durability guarantees
- Legacy system integration
- Specialized orchestration logic

**Example Use Cases:**
- Integration with enterprise workflow platforms
- Existing Kubernetes-based orchestration
- Custom database-backed workflow engines
- Specialized industry requirements

## Migration Between Adapters

Shaman's unified interface makes it easy to migrate between workflow engines:

```typescript
// Development configuration with BullMQ
const developmentConfig = {
  workflowEngine: {
    type: 'bullmq',
    config: {
      redis: { host: 'localhost', port: 6379 }
    }
  }
};

// Production configuration with Temporal
const productionConfig = {
  workflowEngine: {
    type: 'temporal',
    config: {
      connection: { address: 'temporal-cluster:7233' },
      workers: { taskQueue: 'shaman-agents' }
    }
  }
};

// Same Shaman code works with both engines
const createShamanInstance = (config: ShamanConfig) => {
  const workflowAdapter = createWorkflowEngineAdapter(config.workflowEngine);
  
  return new ShamanOrchestrator({
    workflowAdapter,
    // ... other config
  });
};

// Switch engines by changing config
const shaman = createShamanInstance(
  process.env.NODE_ENV === 'production' 
    ? productionConfig 
    : developmentConfig
);
```

## Performance Considerations

### Temporal Performance

```typescript
// Temporal optimization configuration
const highPerformanceTemporalConfig: TemporalConfig = {
  workers: {
    taskQueue: 'shaman-agents',
    maxConcurrentWorkflows: 500,      // High concurrency
    maxConcurrentActivities: 1000,    // High activity parallelism
    workerOptions: {
      maxCachedWorkflows: 1000,       // Cache workflows
      enableLogging: false           // Disable verbose logging
    }
  },
  workflowDefaults: {
    workflowTaskTimeout: '10s',       // Fast task processing
    activityTimeout: '30s',           // Reasonable activity timeout
    retryPolicy: {
      maximumAttempts: 2              // Reduce retry overhead
    }
  }
};
```

### BullMQ Performance

```typescript
// BullMQ optimization configuration
const highPerformanceBullMQConfig: BullMQConfig = {
  redis: {
    host: 'redis-cluster',
    port: 6379,
    maxRetriesPerRequest: 1,          // Reduce connection overhead
    lazyConnect: true,                // Connect on demand
    keepAlive: 30000                  // Keep connections alive
  },
  workers: {
    concurrency: 20,                  // High job concurrency
    maxStalledCount: 1,               // Reduce stalled job checks
    stalledInterval: 60000,           // Less frequent stall checks
    settings: {
      backoffStrategy: exponentialBackoff, // Efficient backoff
      removeOnComplete: 10,           // Keep fewer completed jobs
      removeOnFail: 5                 // Keep fewer failed jobs
    }
  }
};
```

## Monitoring and Observability

All adapters provide consistent monitoring capabilities:

```typescript
// Universal monitoring across all adapters
const monitorWorkflowEngine = async (adapter: WorkflowEngineAdapter) => {
  
  // Health monitoring
  const health = await adapter.getEngineHealth();
  logger.debug(`Engine status: ${health.status}`);
  logger.debug(`Active runs: ${health.activeRuns}`);
  
  // Performance metrics
  const metrics = await adapter.getRunMetrics('run-123');
  logger.debug(`Duration: ${metrics.totalDuration}ms`);
  logger.debug(`Steps: ${metrics.stepCount}`);
  logger.debug(`LLM calls: ${metrics.llmCallCount}`);
  
  // Real-time monitoring
  for await (const event of adapter.streamRunEvents('run-123')) {
    logger.debug(`Event: ${event.type} at ${event.timestamp}`);
    
    // Send to monitoring system
    await sendToMonitoring({
      metric: 'workflow.event',
      tags: { type: event.type, runId: event.runId },
      timestamp: event.timestamp
    });
  }
};
```

This adapter system provides:
- ✅ **Engine flexibility**: Choose the right engine for your needs
- ✅ **Consistent interface**: Same Shaman code works across engines
- ✅ **Easy migration**: Switch engines by changing configuration
- ✅ **Production ready**: Both Temporal and BullMQ adapters battle-tested
- ✅ **Extensible**: Build custom adapters for specialized needs
- ✅ **Observable**: Consistent monitoring across all engines