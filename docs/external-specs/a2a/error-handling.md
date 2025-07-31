# Error Handling

A2A uses standard JSON-RPC 2.0 error structure with specific error codes for common scenarios.

## Error Response Format

All errors follow the JSON-RPC 2.0 error structure:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32001,
    "message": "Task not found",
    "data": {
      "taskId": "task-123",
      "details": "Task may have expired or been deleted"
    }
  }
}
```

## Standard JSON-RPC Error Codes

| Code | Name | Message | When to Use |
|------|------|---------|-------------|
| -32700 | Parse error | Invalid JSON payload | Malformed JSON |
| -32600 | Invalid Request | Invalid JSON-RPC Request | Missing required fields |
| -32601 | Method not found | Method not found | Unknown method name |
| -32602 | Invalid params | Invalid method parameters | Wrong parameter types/values |
| -32603 | Internal error | Internal server error | Unexpected server errors |

## A2A-Specific Error Codes

| Code | Name | Message | Description |
|------|------|---------|-------------|
| -32001 | TaskNotFoundError | Task not found | Task ID doesn't exist or has expired |
| -32002 | TaskNotCancelableError | Task cannot be canceled | Task is in terminal state |
| -32003 | PushNotificationNotSupportedError | Push notifications not supported | Agent doesn't support webhooks |
| -32004 | UnsupportedOperationError | Operation not supported | Requested feature not available |
| -32005 | ContentTypeNotSupportedError | Incompatible content types | MIME type not supported |
| -32006 | InvalidAgentResponseError | Invalid agent response | Agent returned malformed response |
| -32007 | AuthenticatedExtendedCardNotConfiguredError | Extended card not configured | No extended card available |

## Error Examples

### Task Not Found

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32001,
    "message": "Task not found",
    "data": {
      "taskId": "task-abc-123",
      "suggestion": "Task may have expired. Create a new task."
    }
  }
}
```

### Invalid Parameters

```json
{
  "jsonrpc": "2.0",
  "id": "req-002",
  "error": {
    "code": -32602,
    "message": "Invalid method parameters",
    "data": {
      "field": "message.parts",
      "error": "At least one part is required",
      "received": []
    }
  }
}
```

### Authentication Error

```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "error": {
    "code": -32000,
    "message": "Authentication required",
    "data": {
      "authSchemes": ["bearer", "apiKey"],
      "realm": "A2A API"
    }
  }
}
```

### Task Already in Terminal State

```json
{
  "jsonrpc": "2.0",
  "id": "req-004",
  "error": {
    "code": -32002,
    "message": "Task cannot be canceled",
    "data": {
      "taskId": "task-123",
      "currentState": "completed",
      "reason": "Task has already completed"
    }
  }
}
```

## Transport-Specific Error Mapping

### HTTP Status Codes (REST)

| A2A Error | HTTP Status | Response Body |
|-----------|-------------|---------------|
| Parse error | 400 Bad Request | JSON error object |
| Method not found | 404 Not Found | JSON error object |
| Invalid params | 400 Bad Request | JSON error object |
| Internal error | 500 Internal Server Error | JSON error object |
| TaskNotFound | 404 Not Found | JSON error object |
| Authentication required | 401 Unauthorized | JSON error object |
| Insufficient permissions | 403 Forbidden | JSON error object |

### gRPC Status Codes

| A2A Error | gRPC Status |
|-----------|-------------|
| Parse error | INVALID_ARGUMENT |
| Method not found | UNIMPLEMENTED |
| Invalid params | INVALID_ARGUMENT |
| Internal error | INTERNAL |
| TaskNotFound | NOT_FOUND |
| TaskNotCancelable | FAILED_PRECONDITION |
| Authentication required | UNAUTHENTICATED |
| Insufficient permissions | PERMISSION_DENIED |

## Error Handling Best Practices

### 1. Provide Helpful Error Messages

```json
{
  "error": {
    "code": -32602,
    "message": "Invalid method parameters",
    "data": {
      "field": "configuration.pushNotificationConfig.url",
      "error": "URL must be HTTPS",
      "received": "http://example.com/webhook",
      "suggestion": "Use HTTPS URL for security"
    }
  }
}
```

### 2. Include Actionable Information

```json
{
  "error": {
    "code": -32001,
    "message": "Task not found",
    "data": {
      "taskId": "task-123",
      "lastKnownState": "completed",
      "completedAt": "2024-01-20T10:30:00Z",
      "suggestion": "Task has completed. Use tasks/get to retrieve final state."
    }
  }
}
```

### 3. Validate Early

- Check authentication before processing
- Validate parameters before creating tasks
- Verify capabilities before accepting requests

### 4. Log Errors Appropriately

- Log internal errors with full stack traces
- Log client errors with request context
- Never expose internal details to clients

## Client Error Handling

### Retry Logic

```javascript
async function callA2AMethod(method, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await sendRequest(method, params);
      return response;
    } catch (error) {
      // Retry on temporary failures
      if (error.code === -32603 && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      }
      
      // Don't retry client errors
      if (error.code >= -32099 && error.code <= -32000) {
        throw error;
      }
      
      throw error;
    }
  }
}
```

### Error Recovery

```javascript
async function handleTaskError(error, taskId) {
  switch (error.code) {
    case -32001: // Task not found
      // Create new task
      return createNewTask();
      
    case -32002: // Task not cancelable
      // Task already in terminal state
      return getTaskFinalState(taskId);
      
    case -32003: // Push notifications not supported
      // Fall back to polling
      return pollTaskStatus(taskId);
      
    default:
      throw error;
  }
}
```

## Server Implementation Guidelines

### 1. Consistent Error Codes

Always use the defined A2A error codes for common scenarios.

### 2. Detailed Error Data

Include relevant context in the `data` field:
- Which field failed validation
- What was expected vs received
- Suggestions for fixing the error

### 3. Security Considerations

- Don't expose internal system details
- Sanitize error messages for sensitive data
- Log full errors internally, return safe errors to clients

### 4. Graceful Degradation

When optional features fail, provide alternatives:
- If streaming fails, suggest polling
- If push notifications fail, provide polling instructions
- If extended card unavailable, work with basic card