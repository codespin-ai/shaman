[← Previous: API, Config & Deployment](./04-api-config-and-deployment.md) | [🏠 Home](./README.md)

---

# GraphQL API Specification

## Overview

The Shaman GraphQL API provides a strongly-typed interface for managing AI agents, executing workflows, and monitoring system operations. This API is designed primarily for internal management tools and UIs that need comprehensive access to system capabilities.

## Design Principles

1. **Strong Typing**: All fields use proper GraphQL types - no JSON escape hatches
2. **Consistent Patterns**: Relay-style connections for all paginated queries
3. **Clear Discrimination**: Agent sources and types are clearly distinguished
4. **Rich Error Types**: Detailed error information for debugging
5. **Comprehensive Coverage**: Full system visibility for management UIs

## Schema Location

The complete GraphQL schema is defined in: [`/node/packages/shaman-server/src/schema.graphql`](../node/packages/shaman-server/src/schema.graphql)

## Key Concepts

### Agent Model

The agent system distinguishes between Git-based agents and external A2A agents through a unified `Agent` type:

```graphql
type Agent {
  name: String!
  description: String!
  source: AgentSource!  # GIT or A2A_EXTERNAL
  tags: [String!]!
  
  # Source-specific details
  gitDetails: GitAgentDetails      # Populated for Git agents
  externalDetails: ExternalAgentDetails  # Populated for A2A agents
  
  # Analytics (common to all agents)
  usageCount: Int!
  lastUsed: DateTime
  averageExecutionTime: Float
  successRate: Float
}
```

### MCP Server Access

Instead of using JSON, MCP server configurations are strongly typed:

```graphql
type McpServerAccess {
  serverName: String!
  accessType: McpAccessType!  # ALL_TOOLS, SPECIFIC_TOOLS, NO_ACCESS
  allowedTools: [String!]     # Only populated when accessType is SPECIFIC_TOOLS
}
```

### Execution Hierarchy

The execution model consists of Runs containing Steps:

```graphql
type Run {
  id: ID!
  status: ExecutionState!
  steps(first: Int, after: String, filter: StepFilter): StepConnection!
  dagStatus: DagStatus!  # Provides DAG analysis
}

type Step {
  id: ID!
  type: StepType!  # AGENT_EXECUTION, LLM_CALL, TOOL_CALL, AGENT_CALL
  parentStep: Step
  childSteps: [Step!]!
  messages: [Message!]!
  completion: AgentCompletion
}
```

### Streaming Events

Real-time updates use a structured event model:

```graphql
type StreamEvent {
  id: ID!
  type: StreamEventType!
  timestamp: DateTime!
  stepId: ID!
  
  # Type-specific data (only one populated based on type)
  tokenData: TokenData
  toolCallStartData: ToolCallStartData
  completionData: CompletionData
  # ... etc
}
```

### Error Handling

Comprehensive error types for debugging:

```graphql
type Error {
  code: ErrorCode!
  message: String!
  timestamp: DateTime!
  context: ErrorContext
}

type ErrorContext {
  gitCommit: String
  agentName: String
  repositoryName: String
  filePath: String
  lineNumber: Int
  validationErrors: [ValidationError!]
}
```

## Query Patterns

### Pagination

All list queries use Relay-style connections:

```graphql
query ListAgents {
  agents(first: 10, after: "cursor123", filter: { source: GIT }) {
    edges {
      node {
        name
        description
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### Agent Discovery

Find agents by various criteria:

```graphql
query SearchAgents {
  agents(
    search: "billing"
    filter: { 
      tags: ["customer-support"], 
      source: GIT 
    }
  ) {
    edges {
      node {
        name
        description
        gitDetails {
          repository {
            name
          }
          version
        }
      }
    }
  }
}
```

### Execution Monitoring

Track run progress with detailed information:

```graphql
query MonitorRun {
  run(id: "run-123") {
    status
    totalCost
    dagStatus {
      activeSteps {
        id
        agentName
        status
      }
      blockedSteps {
        id
        error {
          code
          message
        }
      }
    }
    pendingInputRequests {
      id
      prompt
      inputType
    }
  }
}
```

## Mutation Patterns

### Agent Execution

```graphql
mutation ExecuteAgent {
  executeAgent(input: {
    agentName: "CustomerSupport"
    input: "Help me with order #12345"
    source: GIT
    contextScope: FULL
  }) {
    id
    status
    steps {
      edges {
        node {
          id
          type
        }
      }
    }
  }
}
```

### Repository Management

```graphql
mutation SyncRepository {
  syncRepository(name: "main-agents") {
    name
    lastSyncStatus
    lastSyncErrors {
      code
      message
      context {
        filePath
        validationErrors {
          field
          message
        }
      }
    }
  }
}
```

## Subscription Patterns

### Real-time Execution Updates

```graphql
subscription WatchExecution {
  stepStream(stepId: "step-456") {
    type
    timestamp
    tokenData {
      content
    }
    completionData {
      completion {
        result
        status
      }
    }
  }
}
```

### Input Request Notifications

```graphql
subscription WatchInputRequests {
  inputRequested {
    id
    runId
    stepId
    prompt
    inputType
    choices
  }
}
```

## Type Safety Patterns

### Discriminated Unions

The schema uses proper discrimination for polymorphic data:

```graphql
# Agent details based on source
type Agent {
  source: AgentSource!
  gitDetails: GitAgentDetails      # Check source == GIT
  externalDetails: ExternalAgentDetails  # Check source == A2A_EXTERNAL
}

# Stream events with typed data
type StreamEvent {
  type: StreamEventType!
  tokenData: TokenData              # Check type == TOKEN
  toolCallStartData: ToolCallStartData  # Check type == TOOL_CALL_START
}
```

### Structured Metadata

Instead of arbitrary JSON, metadata is structured:

```graphql
type MetadataField {
  key: String!
  value: String!
}

type AgentCompletion {
  result: String!
  status: CompletionStatus!
  metadata: [MetadataField!]  # Structured, not JSON
}
```

### Tool Schemas

Tool inputs and outputs are fully typed:

```graphql
type Tool {
  schema: ToolSchema!
}

type ToolSchema {
  inputSchema: InputSchema!
  outputSchema: OutputSchema
}

type InputSchema {
  type: String!
  properties: [PropertySchema!]!
  required: [String!]!
}
```

## Analytics Queries

### System Overview

```graphql
query SystemDashboard {
  systemStats(timeRange: { start: "2024-01-01", end: "2024-01-31" }) {
    totalRuns
    activeRuns
    totalAgents
    averageRunDuration
    successRate
  }
  
  costAnalytics(timeRange: { start: "2024-01-01", end: "2024-01-31" }) {
    totalCost
    costByAgent {
      agentName
      totalCost
      percentage
    }
    projectedMonthlyCost
  }
}
```

### Agent Performance

```graphql
query AgentPerformance {
  agentAnalytics(
    agentName: "CustomerSupport"
    timeRange: { start: "2024-01-01", end: "2024-01-31" }
  ) {
    totalRuns
    successRate
    averageExecutionTime
    commonErrors {
      error {
        code
        message
      }
      count
      percentage
    }
  }
}
```

## Error Handling

All mutations return typed results with detailed error information:

```graphql
mutation CreateRepository {
  createRepository(input: {
    name: "new-agents"
    gitUrl: "https://github.com/org/agents.git"
    branch: "main"
    isRoot: false
    authType: "TOKEN"
  }) {
    id
    name
    lastSyncErrors {  # Validation errors from initial sync
      code
      message
      context {
        filePath
        lineNumber
        validationErrors {
          field
          message
        }
      }
    }
  }
}
```

## Client Implementation Notes

1. **Type Generation**: Use GraphQL code generation tools to generate TypeScript types from the schema
2. **Error Handling**: Check error codes and context for detailed debugging information
3. **Pagination**: Always use cursor-based pagination for reliable results
4. **Subscriptions**: Implement reconnection logic for long-running subscriptions
5. **Field Selection**: Request only needed fields to minimize payload size

---

**Navigation:**

- [← Previous: API, Config & Deployment](./04-api-config-and-deployment.md)
- [🏠 Home](./README.md)