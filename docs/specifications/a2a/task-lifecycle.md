# Task Lifecycle

Tasks are the fundamental unit of work in A2A. This document describes task states, transitions, and management rules.

## Task States

### Active States

**submitted**
- Initial state when a task is created
- Agent has acknowledged the request but hasn't started processing

**working**
- Agent is actively processing the task
- May emit status updates and artifact chunks during this state

### Interrupted States

**input-required**
- Agent needs additional information from the client
- Task is paused until client provides required input
- Client continues by sending a new message with the same `taskId`

**auth-required**
- Agent needs additional authentication/credentials
- Not a terminal state - task can continue after auth is provided
- Authentication happens out-of-band

### Terminal States

**completed**
- Task finished successfully
- Final artifacts are available
- **Task CANNOT be restarted**

**failed**
- Task encountered an error and cannot proceed
- Error details in status message
- **Task CANNOT be restarted**

**cancelled**
- Task was cancelled before completion
- May be client-initiated or agent-initiated
- **Task CANNOT be restarted**

**rejected**
- Agent declined to perform the task
- Can happen during initial validation or later
- **Task CANNOT be restarted**

## State Transition Diagram

```
                    ┌─────────────┐
                    │  submitted  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
              ┌─────┤   working   ├─────┐
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              │     │input-required│    │
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              │     │auth-required│     │
              │     └──────┬──────┘     │
              │            │            │
    ┌─────────▼─┐   ┌──────▼──────┐   ┌▼─────────┐   ┌─────────┐
    │ completed │   │   failed    │   │cancelled │   │rejected │
    └───────────┘   └─────────────┘   └──────────┘   └─────────┘
         Terminal States (Cannot be restarted)
```

## Task Object Structure

```json
{
  "id": "task-123",                    // Server-generated unique ID
  "contextId": "ctx-456",              // Groups related tasks/messages
  "status": {
    "state": "working",                // Current state
    "message": {                       // Optional status message
      "role": "agent",
      "parts": [{
        "kind": "text",
        "text": "Processing your request..."
      }]
    },
    "timestamp": "2024-01-20T10:30:00Z"
  },
  "artifacts": [                       // Generated outputs
    {
      "artifactId": "artifact-001",
      "name": "result.json",
      "parts": [...]
    }
  ],
  "history": [                         // Conversation history
    {
      "role": "user",
      "parts": [...],
      "messageId": "msg-001"
    }
  ],
  "metadata": {}                       // Custom metadata
}
```

## Key Rules

### 1. Terminal State Immutability

Once a task reaches a terminal state, it CANNOT be restarted or modified. This ensures:
- **Task Immutability**: Reliable references to tasks and their outputs
- **Clear Units of Work**: Each task represents a distinct, traceable unit
- **Simpler Implementation**: No ambiguity about task boundaries

### 2. Continuing Interrupted Tasks

For `input-required` or `auth-required` states:

```json
{
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Here's the information you requested"}],
      "taskId": "task-123",        // Continue existing task
      "contextId": "ctx-456"       // Same context
    }
  }
}
```

### 3. Follow-up Tasks

To refine or follow up on a completed task, create a NEW task:

```json
{
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"kind": "text", "text": "Make the logo bigger"}],
      "contextId": "ctx-456",              // Same context
      "referenceTaskIds": ["task-123"]    // Reference previous task
    }
  }
}
```

## Context Management

**contextId** groups related tasks and messages:
- Server-generated on first interaction
- Client includes in subsequent messages to maintain context
- Enables conversation continuity across multiple tasks
- Supports parallel task execution within same context

Example parallel tasks in same context:
```
Context: ctx-travel-planning
├── Task 1: Book flight to Helsinki (completed)
├── Task 2: Book hotel (working) - started after Task 1
├── Task 3: Book activities (working) - started after Task 1
└── Task 4: Add spa to hotel (submitted) - started after Task 2
```

## Artifact Management

### During Task Execution

Artifacts can be:
- Created incrementally (via streaming)
- Updated/replaced during execution
- Marked with `append: true/false` for streaming updates

### After Task Completion

- Artifacts are immutable once task is completed
- Follow-up tasks create NEW artifacts
- Agents should maintain same artifact names for refinements
- Clients track artifact lineage/versions

## Error Handling

If a task fails:
1. State transitions to `failed`
2. Error details in `status.message`
3. Partial artifacts may be available
4. Client must create new task to retry

## Best Practices

1. **Use Tasks for Trackable Work**: Anything that takes time or needs tracking
2. **Use Messages for Simple Queries**: Quick responses that don't need state
3. **Maintain Context**: Use `contextId` for related interactions
4. **Handle Interruptions Gracefully**: Implement clear prompts for `input-required`
5. **Fail Fast**: Transition to `rejected` early if task isn't feasible
6. **Provide Clear Status Messages**: Keep users informed during `working` state