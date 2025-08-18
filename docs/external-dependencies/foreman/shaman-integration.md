# Foreman Integration with Shaman

This document describes how Shaman integrates with Foreman for workflow orchestration.

## Overview

Shaman uses Foreman as an external service for all workflow orchestration needs. Foreman handles:

- Run management
- Task queuing and execution
- Run data storage for inter-agent communication
- Status tracking and monitoring

## Configuration

### Environment Variables

```bash
# Required
FOREMAN_ENDPOINT=http://localhost:3000    # Foreman REST API endpoint
FOREMAN_API_KEY=fmn_dev_default_key      # API key (format: fmn_[env]_[orgId]_[random])

# Optional (override default queue names)
SHAMAN_TASK_QUEUE=shaman:tasks           # Default: shaman:tasks
SHAMAN_RESULT_QUEUE=shaman:results       # Default: shaman:results
```

### Initialization

In `shaman-a2a-server/src/start.ts`:

```typescript
import { initializeForemanClient } from "@codespin/foreman-client";

await initializeForemanClient({
  endpoint: process.env.FOREMAN_ENDPOINT || "http://localhost:3000",
  apiKey: process.env.FOREMAN_API_KEY || "fmn_dev_default_key",
  timeout: 30000,
  queues: {
    taskQueue: process.env.SHAMAN_TASK_QUEUE || "shaman:tasks",
    resultQueue: process.env.SHAMAN_RESULT_QUEUE || "shaman:results",
  },
});
```

## Usage in Shaman

### Creating Workflow Runs

When an agent execution request comes through the A2A server:

```typescript
import { createRun, createTask } from "@codespin/foreman-client";

// Create a run for the agent execution
const runResult = await createRun(config, {
  inputData: {
    agentName: "CustomerSupport",
    input: { message: "Hello" },
    contextId: "ctx-123",
  },
  metadata: {
    source: "a2a",
    organizationId: "org-123",
    userId: "user-456",
  },
});

if (runResult.success) {
  // Create initial task
  const taskResult = await createTask(config, {
    runId: runResult.data.id,
    type: "agent-execution",
    inputData: {
      agentName: "CustomerSupport",
      input: { message: "Hello" },
    },
  });
}
```

### Platform Tools for Run Data

Shaman provides built-in platform tools that agents can use to store and retrieve run data:

#### run_data_write

```typescript
await createRunData(config, runId, {
  taskId: currentTaskId,
  key: "customer-info",
  value: {
    customerId: "123",
    preferences: { theme: "dark" },
  },
  tags: ["customer", "profile"],
});
```

#### run_data_read

```typescript
const result = await queryRunData(config, runId, {
  key: "customer-info",
});

if (result.success && result.data.data.length > 0) {
  const customerInfo = result.data.data[0].value;
}
```

#### run_data_query

```typescript
const result = await queryRunData(config, runId, {
  keyStartsWith: "agent-",
  tags: ["response"],
  sortBy: "created_at",
  sortOrder: "desc",
  limit: 10,
});
```

#### run_data_list

```typescript
const result = await queryRunData(config, runId, {
  includeAll: true,
  sortBy: "created_at",
  sortOrder: "desc",
});
```

### Worker Implementation

The Shaman worker processes tasks from Foreman:

```typescript
import { createWorker } from "@codespin/foreman-client";

const worker = await createWorker(
  {
    "agent-execution": async (task) => {
      const { agentName, input } = task.inputData;

      try {
        // Execute agent
        const result = await executeAgent(agentName, input, {
          runId: task.runId,
          taskId: task.id,
        });

        // Store result
        await createRunData(config, task.runId, {
          taskId: task.id,
          key: `agent-${agentName}-result`,
          value: result,
          tags: ["result", `agent:${agentName}`],
        });

        return result;
      } catch (error) {
        // Store error for debugging
        await createRunData(config, task.runId, {
          taskId: task.id,
          key: `error-${Date.now()}`,
          value: {
            error: error.message,
            stack: error.stack,
            agent: agentName,
          },
          tags: ["error", `agent:${agentName}`],
        });
        throw error;
      }
    },
  },
  {
    concurrency: 5,
    maxRetries: 3,
  },
);

await worker.start();
```

## Data Flow

1. **A2A Request** → Shaman A2A Server
2. **Create Run** → Foreman (stores workflow metadata)
3. **Create Task** → Foreman (stores task in DB)
4. **Enqueue Task ID** → Redis/BullMQ (only ID)
5. **Worker Picks Up** → Gets task ID from queue
6. **Fetch Task Data** → Foreman (gets full task details)
7. **Execute Agent** → Shaman Agent Executor
8. **Store Results** → Foreman Run Data
9. **Update Task Status** → Foreman

## Best Practices

1. **Use Tags**: Tag run data for easy filtering

   ```typescript
   tags: ["response", "agent:CustomerSupport", "v1.0"];
   ```

2. **Store Context**: Save agent conversation context

   ```typescript
   await createRunData(config, runId, {
     key: 'conversation-context',
     value: { messages: [...], contextId: 'ctx-123' },
     tags: ['context']
   });
   ```

3. **Error Tracking**: Store detailed error information

   ```typescript
   await createRunData(config, runId, {
     key: `error-${Date.now()}`,
     value: { error: error.message, stack: error.stack },
     tags: ["error", "debug"],
   });
   ```

4. **Audit Trail**: Use run data for audit logging
   ```typescript
   await createRunData(config, runId, {
     key: `audit-${Date.now()}`,
     value: { action: "agent-called", agent: agentName, user: userId },
     tags: ["audit"],
   });
   ```

## Monitoring

Query Foreman directly to monitor workflow status:

```typescript
// Get run status
const run = await getRun(config, runId);
console.log(`Run ${runId}: ${run.data.status}`);
console.log(`Tasks: ${run.data.completedTasks}/${run.data.totalTasks}`);

// List recent runs
const runs = await listRuns(config, {
  limit: 10,
  sortBy: "created_at",
  sortOrder: "desc",
});

// Get task details
const task = await getTask(config, taskId);
console.log(`Task ${taskId}: ${task.data.status}`);
if (task.data.errorData) {
  console.error("Task error:", task.data.errorData);
}
```
