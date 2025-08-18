# @codespin/shaman-agent-executor

Core agent execution engine for the Shaman framework. This package provides the runtime for executing AI agents with LLM integration, tool execution, and agent-to-agent communication.

## Overview

The agent executor is responsible for:

- Managing agent conversation state
- Integrating with LLM providers for completions
- Executing tool calls through the tool router
- Handling agent-to-agent delegation
- Tracking token usage and costs

## Installation

```bash
npm install @codespin/shaman-agent-executor
```

## Usage

```typescript
import { executeAgent } from "@codespin/shaman-agent-executor";
import { createVercelLLMProvider } from "@codespin/shaman-llm-vercel";
import { createToolRouter } from "@codespin/shaman-tool-router";

// Set up dependencies
const llmProvider = createVercelLLMProvider({
  models: {
    "gpt-4": { provider: "openai", modelId: "gpt-4" },
  },
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
  },
});

const toolRouter = createToolRouter(
  {
    enablePlatformTools: true,
  },
  dependencies,
);

// Execute an agent
const result = await executeAgent(
  {
    agentName: "example-agent",
    input: "Hello, how can you help me?",
    context: {
      runId: "run-123",
      memory: new Map(),
      createdAt: new Date(),
    },
    contextScope: "FULL",
    agentSource: { type: "GIT", repoUrl: "https://github.com/org/agents.git" },
    depth: 0,
  },
  {
    agentResolver: async (name) => {
      // Your agent resolution logic
      return { success: true, data: agent };
    },
    llmProvider,
    toolRouter,
    workflowEngine, // Optional: for agent-to-agent calls
  },
);
```

## Core Concepts

### Agent Execution Flow

1. **Agent Resolution**: Resolves agent definition from name
2. **Context Setup**: Initializes conversation state with system prompt
3. **LLM Loop**: Iteratively calls LLM and processes responses
4. **Tool Execution**: Executes any tool calls requested by the agent
5. **Result Storage**: Stores final result in workflow context

### Conversation State

The executor maintains conversation state including:

- Message history (system, user, assistant, tool messages)
- Tool call tracking
- Token usage and cost calculation
- Iteration count for loop prevention

### Tool Execution

Tools are executed through the tool router with support for:

- Platform tools (`run_data_*`)
- MCP server tools
- Agent calls (delegated to workflow engine)

### Agent-to-Agent Communication

When an agent calls another agent:

1. Tool call is detected (format: `agent:target-agent-name`)
2. Permission is validated against agent's allowed calls
3. Workflow engine executes child agent
4. Result is incorporated into conversation

## API Reference

### executeAgent

Main execution function for running an agent.

```typescript
function executeAgent(
  request: AgentExecutionRequest,
  dependencies: AgentExecutorDependencies,
): Promise<Result<AgentExecutionResult>>;
```

#### Parameters

- `request`: Agent execution request containing:
  - `agentName`: Name of the agent to execute
  - `input`: User input/prompt
  - `context`: Workflow context with memory
  - `contextScope`: How much context to include ('FULL' or 'NONE')
  - `agentSource`: Source of the agent (Git, registry, etc.)
  - `parentStepId`: Optional parent step for hierarchical tracking
  - `depth`: Current depth in agent call hierarchy

- `dependencies`: Required services:
  - `agentResolver`: Function to resolve agent definitions
  - `llmProvider`: LLM provider for completions
  - `toolRouter`: Tool execution router
  - `workflowEngine`: Optional workflow engine for agent calls

#### Returns

Result containing:

- `stepId`: Unique identifier for this execution step
- `output`: Final agent response
- `status`: Execution status (COMPLETED, FAILED, WORKING)
- `childStepIds`: IDs of any child agent executions
- `metadata`: Token usage, cost, and model information

### Types

```typescript
// Agent definition
type AgentDefinition = {
  name: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxIterations?: number;
  tools?: string[];
  allowedAgentCalls?: string[];
};

// Execution dependencies
type AgentExecutorDependencies = {
  agentResolver: (name: string) => Promise<Result<AgentDefinition>>;
  llmProvider: LLMProvider;
  toolRouter: ToolRouter;
  workflowEngine?: ExecutionEngine;
};

// Conversation state
type ConversationState = {
  messages: Message[];
  toolCalls: Map<string, ToolCall>;
  iterations: number;
  totalTokens: number;
  totalCost: number;
};
```

## Configuration

### Agent Definition

Agents are defined with YAML frontmatter:

```yaml
---
name: example-agent
model: gpt-4
temperature: 0.7
maxIterations: 10
tools:
  - run_data_write
  - run_data_read
allowedAgentCalls:
  - helper-agent
  - validator-agent
---
You are an example agent...
```

### Cost Calculation

The executor includes built-in cost calculation for common models:

- GPT-4: $0.03/1K prompt tokens, $0.06/1K completion tokens
- GPT-3.5-turbo: $0.001/1K prompt tokens, $0.002/1K completion tokens
- Claude-3-opus: $0.015/1K prompt tokens, $0.075/1K completion tokens
- Claude-3-sonnet: $0.003/1K prompt tokens, $0.015/1K completion tokens

## Error Handling

All functions return `Result<T, Error>` types for explicit error handling:

```typescript
const result = await executeAgent(request, dependencies);
if (!result.success) {
  logger.error("Execution failed:", result.error);
  return;
}
logger.info("Agent output:", { output: result.data.output });
```

## Best Practices

1. **Set iteration limits**: Configure `maxIterations` to prevent infinite loops
2. **Monitor costs**: Track token usage and costs through metadata
3. **Handle tool errors**: Tool failures are passed back to the agent for handling
4. **Validate agent calls**: Use `allowedAgentCalls` to control agent delegation
5. **Provide context**: Use workflow memory for inter-agent communication

## License

MIT
