# Tool Execution Guide

Shaman supports two distinct modes of tool execution: **synchronous** for immediate operations and **asynchronous** for complex workflows requiring approvals, external systems, or long-running processes.

## Overview

Tools in Shaman are defined declaratively and executed based on their configuration. Agents call tools through natural language, and Shaman automatically routes to the appropriate execution mode while maintaining conversation context.

```typescript
// Agent calls tool naturally
const agentResponse = await callLLM({
  messages: [...],
  tools: [
    { name: "check_account", description: "Check customer account status" },
    { name: "process_refund", description: "Process customer refund" }
  ]
});

// Shaman automatically handles sync vs async execution
// - check_account: executes immediately
// - process_refund: may require approval workflow
```

## Synchronous Tools

### Characteristics
- Execute immediately within the conversation flow
- Return results directly to the agent
- No workflow orchestration required
- Ideal for: lookups, calculations, validations, simple API calls

### Configuration

```typescript
const syncToolConfig: SyncToolConfig = {
  name: 'check_account',
  executionType: 'sync',
  description: 'Check customer account status and transaction history',
  parameters: {
    type: 'object',
    properties: {
      customerId: { 
        type: 'string',
        description: 'Customer identifier'
      },
      includeTransactions: { 
        type: 'boolean', 
        default: false,
        description: 'Include recent transaction history'
      }
    },
    required: ['customerId']
  }
};

// Tool implementation
const checkAccountTool = async (
  args: { customerId: string; includeTransactions?: boolean },
  context: ExecutionContext
): Promise<AccountInfo> => {
  
  // Direct execution - no orchestration needed
  const account = await customerService.getAccount(args.customerId);
  
  if (args.includeTransactions) {
    account.transactions = await transactionService.getRecent(args.customerId, 10);
  }
  
  return {
    accountId: account.id,
    status: account.status,
    balance: account.balance,
    lastActivity: account.lastActivity,
    transactions: account.transactions
  };
};
```

### Execution Flow

```
Agent Response → Tool Call Detected → Direct Execution → Result → Continue Conversation
```

```typescript
// Example conversation flow
User: "What's the status of my account?"

Agent: "I'll check your account status for you."
// Agent calls check_account tool

Tool executes immediately:
- Database lookup
- Data formatting
- Result returned

Agent: "Your account is active with a balance of $1,247.50. 
Your last transaction was a $25.00 purchase yesterday."
```

### Best Practices for Sync Tools

```typescript
// ✅ Good sync tool patterns
const syncTools = {
  // Quick calculations
  calculate: (args: { expression: string }) => evaluateExpression(args.expression),
  
  // Database lookups
  lookupCustomer: (args: { id: string }) => customerDb.findById(args.id),
  
  // API calls with timeout
  getWeather: async (args: { location: string }) => {
    const response = await fetch(`https://api.weather.com/v1/current?location=${args.location}`, {
      timeout: 5000 // Short timeout for sync tools
    });
    return response.json();
  },
  
  // Data validation
  validateEmail: (args: { email: string }) => ({
    valid: emailRegex.test(args.email),
    domain: args.email.split('@')[1]
  }),
  
  // Simple transformations
  formatCurrency: (args: { amount: number; currency: string }) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: args.currency })
      .format(args.amount)
};

// ❌ Avoid these patterns in sync tools
const badSyncPatterns = {
  // Don't do long-running operations
  generateReport: async (args) => {
    // This could take minutes - should be async!
    return await generateLargeReport(args.reportType);
  },
  
  // Don't do operations requiring approval
  deleteAccount: async (args) => {
    // This needs approval - should be async!
    return await accountService.delete(args.customerId);
  },
  
  // Don't call unreliable external services
  thirdPartyIntegration: async (args) => {
    // External service might be slow/down - should be async!
    return await unreliableExternalApi.call(args);
  }
};
```

## Asynchronous Tools

### Characteristics
- Execute in separate workflows with full orchestration
- Support approvals, external systems, long-running operations
- Maintain conversation context throughout execution
- Can pause main conversation and resume when complete

### Configuration

```typescript
const asyncToolConfig: AsyncToolConfig = {
  name: 'process_refund',
  executionType: 'async',
  description: 'Process customer refund with approval workflow',
  parameters: {
    type: 'object',
    properties: {
      customerId: { type: 'string' },
      amount: { type: 'number', minimum: 0.01 },
      reason: { type: 'string', minLength: 10 },
      refundMethod: { 
        type: 'string', 
        enum: ['original_payment', 'store_credit', 'bank_transfer'],
        default: 'original_payment'
      }
    },
    required: ['customerId', 'amount', 'reason']
  },
  
  asyncConfig: {
    estimatedDuration: 3600000, // 1 hour
    timeout: 86400000, // 24 hours max
    
    // Approval workflow
    requiresApproval: true,
    approvalConfig: {
      approverRole: 'manager',
      approverEmails: ['manager@company.com', 'supervisor@company.com'],
      approvalThreshold: 100, // Amounts over $100
      approvalTimeout: 14400000, // 4 hours
      escalationTimeout: 28800000, // 8 hours
      escalationRole: 'director',
      customApprovalRules: [
        {
          condition: 'amount > 1000',
          requiredRole: 'director',
          additionalApprovers: ['finance@company.com']
        },
        {
          condition: 'reason.includes("fraud")',
          requiredRole: 'security_manager',
          additionalApprovers: ['security@company.com']
        }
      ]
    },
    
    // External system integration
    requiresExternalSystem: true,
    externalSystemConfig: {
      systemName: 'payment-processor',
      operation: 'process-refund',
      timeout: 300000, // 5 minutes
      retryPolicy: {
        maxRetries: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000
      },
      webhookEndpoint: '/webhooks/payment-processor/refund-status'
    },
    
    // Progress tracking
    progressUpdates: true,
    canCancel: true,
    cancellationPolicy: {
      allowedUntilStep: 'external_system_call',
      cancellationFee: 0,
      notificationRequired: true
    }
  }
};

// Tool implementation (called after approvals/external systems)
const processRefundTool = async (
  args: RefundArgs,
  context: ExecutionContext
): Promise<RefundResult> => {
  
  // This executes only after all approvals and validations
  const refund = await paymentService.processRefund({
    customerId: args.customerId,
    amount: args.amount,
    reason: args.reason,
    method: args.refundMethod,
    approvalId: context.metadata.approvalId,
    externalValidationId: context.metadata.externalValidationId
  });
  
  // Audit trail
  await auditService.logRefund({
    refundId: refund.id,
    processedBy: context.agentId,
    sessionId: context.sessionId,
    approvedBy: context.metadata.approvedBy,
    timestamp: new Date()
  });
  
  return {
    refundId: refund.id,
    status: refund.status,
    estimatedCompletion: refund.estimatedCompletion,
    trackingNumber: refund.trackingNumber
  };
};
```

### Async Tool Execution Flow

```
Agent Calls Tool → Async Workflow Started → Context Preserved → Main Conversation Pauses
     ↓
Approval Workflow → Manager Approval → External System Validation → Tool Execution
     ↓
Completion Notification → Main Conversation Resumes → Agent Continues with Result
```

### Detailed Async Execution Example

```typescript
// 1. User initiates refund request
User: "I want a refund for my $250 purchase last week"

// 2. Agent analyzes and calls async tool
Agent: "I'll process your refund request. Let me gather the details..."
// Agent calls process_refund tool

// 3. Async workflow starts, context preserved
const asyncWorkflow = await workflowAdapter.startRuns([{
  agentId: 'RefundProcessorAgent',
  prompt: JSON.stringify({
    toolName: 'process_refund',
    arguments: { customerId: 'C123', amount: 250, reason: 'Defective product' },
    originalContext: conversationContext // PRESERVED
  }),
  sessionId: 'session-456',
  parentRunId: 'main-conversation-789'
}]);

// 4. User gets immediate feedback
Agent: "Your refund request has been submitted for approval. 
You'll be notified when it's processed. Is there anything else I can help with?"

// 5. Approval workflow runs in background
// - Manager gets email notification
// - Approval form presented
// - Manager approves refund

// 6. External system validation
// - Payment processor validates refund eligibility
// - Fraud check performed
// - Account verification completed

// 7. Tool actually executes
const refundResult = await processRefundTool(args, preservedContext);

// 8. Notification sent, conversation can resume
Notification: "✅ Your $250 refund has been processed! 
Refund ID: R-789. You'll see the credit in 3-5 business days."
```

### Context Retention in Async Tools

```typescript
// Context is preserved across async boundaries
type ExecutionContext = {
  runId: RunIdentifier;           // Main conversation workflow
  sessionId: string;              // User session
  agentId: string;                // Original agent that called tool
  parentRunId?: RunIdentifier;    // Parent workflow if nested
  callStack: string[];            // Agent call hierarchy
  conversationHistory: Message[]; // Full conversation so far  
  stepId: string;                 // Specific step that called tool
  toolCallId?: string;            // LLM tool call identifier
  
  // User context
  userId?: string;
  userMetadata?: Record<string, any>;
  
  // Tool-specific context
  toolMetadata?: {
    approvalId?: string;
    externalSystemId?: string;
    startTime: Date;
    estimatedCompletion?: Date;
  };
  
  // General metadata
  metadata: Record<string, any>;
};

// Context flows through entire async execution
async function executeAsyncTool(params: ToolExecutionParams): Promise<ToolResult> {
  
  // 1. Context captured when tool starts
  const preservedContext: ExecutionContext = {
    ...params.context,
    toolMetadata: {
      startTime: new Date(),
      estimatedCompletion: new Date(Date.now() + toolConfig.estimatedDuration)
    }
  };
  
  // 2. Context passed to async workflow
  const asyncWorkflowId = await workflowAdapter.startRuns([{
    agentId: 'AsyncToolExecutor',
    prompt: JSON.stringify({
      toolName: params.toolName,
      arguments: params.arguments,
      preservedContext // CONTEXT PRESERVED
    }),
    sessionId: preservedContext.sessionId,
    parentRunId: preservedContext.runId
  }]);
  
  // 3. Context available throughout async execution
  // - Approval emails include conversation context
  // - External system calls include session info
  // - Final tool execution has full context
  
  return {
    success: true,
    result: null,
    asyncWorkflowId,
    estimatedCompletion: preservedContext.toolMetadata?.estimatedCompletion
  };
}
```

## Tool Registration and Management

### Tool Registry

```typescript
// Central tool registry
export const toolRegistry = {
  // Sync tools
  sync: new Map<string, SyncToolConfig & { implementation: ToolFunction }>(),
  
  // Async tools
  async: new Map<string, AsyncToolConfig & { implementation: ToolFunction }>(),
  
  // Register tools
  register(config: ToolConfig, implementation: ToolFunction) {
    if (config.executionType === 'sync') {
      this.sync.set(config.name, { ...config, implementation });
    } else {
      this.async.set(config.name, { ...config, implementation });
    }
  },
  
  // Get tool configuration
  getConfig(toolName: string): ToolConfig | null {
    return this.sync.get(toolName) || this.async.get(toolName) || null;
  },
  
  // List available tools for agent
  getToolsForAgent(agentId: string): ToolConfig[] {
    const agent = agentRegistry.get(agentId);
    if (!agent) return [];
    
    return agent.allowedTools
      .map(toolName => this.getConfig(toolName))
      .filter(Boolean) as ToolConfig[];
  }
};

// Register tools at startup
toolRegistry.register(checkAccountConfig, checkAccountTool);
toolRegistry.register(processRefundConfig, processRefundTool);
```

### Dynamic Tool Loading

```typescript
// Load tools from configuration
const loadToolsFromConfig = (toolConfigs: ToolConfig[]) => {
  for (const config of toolConfigs) {
    // Load implementation
    const implementation = require(`./tools/${config.name}`).default;
    
    // Validate tool
    validateToolImplementation(config, implementation);
    
    // Register tool
    toolRegistry.register(config, implementation);
  }
};

// Validate tool implementation matches config
const validateToolImplementation = (config: ToolConfig, implementation: ToolFunction) => {
  // Check function signature
  if (typeof implementation !== 'function') {
    throw new Error(`Tool ${config.name} implementation must be a function`);
  }
  
  // Validate parameters match
  const functionParams = getFunctionParameters(implementation);
  const configParams = config.parameters.properties;
  
  // Additional validation logic...
};
```

## Error Handling and Resilience

### Sync Tool Error Handling

```typescript
const executeSyncTool = async (
  params: ToolExecutionParams,
  config: SyncToolConfig,
  implementation: ToolFunction
): Promise<SyncToolResult> => {
  
  const startTime = Date.now();
  
  try {
    // Timeout protection
    const result = await Promise.race([
      implementation(params.arguments, params.context),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tool execution timeout')), 30000)
      )
    ]);
    
    return {
      success: true,
      result,
      metadata: {
        executionType: 'sync',
        duration: Date.now() - startTime,
        toolName: config.name
      }
    };
    
  } catch (error) {
    // Log error with context
    console.error('Sync tool execution failed:', {
      toolName: config.name,
      error: error.message,
      context: params.context,
      duration: Date.now() - startTime
    });
    
    return {
      success: false,
      result: null,
      metadata: {
        executionType: 'sync',
        duration: Date.now() - startTime,
        error: error.message,
        errorType: error.constructor.name
      }
    };
  }
};
```

### Async Tool Error Handling

```typescript
// Async tools have multiple failure points
const asyncToolErrorHandling = {
  
  // 1. Workflow start failure
  workflowStartError: async (error: Error, context: ExecutionContext) => {
    await notificationProvider.send({
      type: 'async_tool_failed',
      targetRunId: context.runId,
      payload: {
        stage: 'workflow_start',
        error: error.message,
        canRetry: true
      },
      context
    });
  },
  
  // 2. Approval timeout
  approvalTimeout: async (toolName: string, context: ExecutionContext) => {
    await notificationProvider.send({
      type: 'async_tool_failed',
      targetRunId: context.runId,
      payload: {
        stage: 'approval_timeout',
        error: `Approval timeout for ${toolName}`,
        canRetry: false,
        escalationRequired: true
      },
      context
    });
  },
  
  // 3. External system failure
  externalSystemError: async (error: Error, retryCount: number, maxRetries: number) => {
    if (retryCount < maxRetries) {
      // Retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return { shouldRetry: true };
    } else {
      // Max retries exceeded
      return { shouldRetry: false, error: 'External system unavailable' };
    }
  },
  
  // 4. Tool execution failure
  toolExecutionError: async (error: Error, context: ExecutionContext) => {
    // Tool execution failed after all validations
    // This is usually unrecoverable
    await auditService.logToolFailure({
      toolName: context.metadata.toolName,
      error: error.message,
      context,
      stage: 'execution'
    });
    
    return {
      success: false,
      error: 'Tool execution failed after approval',
      requiresManualIntervention: true
    };
  }
};
```

## Performance Optimization

### Sync Tool Optimization

```typescript
// Connection pooling for database tools
const connectionPool = new DatabasePool({
  host: 'localhost',
  database: 'customers',
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000
});

const optimizedSyncTool = async (args: any, context: ExecutionContext) => {
  // Use connection pool
  const client = await connectionPool.connect();
  
  try {
    // Optimized query with indexes
    const result = await client.query(
      'SELECT * FROM customers WHERE id = $1',
      [args.customerId]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Caching for frequently called tools
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

const cachedSyncTool = async (args: any, context: ExecutionContext) => {
  const cacheKey = `${context.agentId}:${JSON.stringify(args)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const result = await expensiveOperation(args);
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  
  return result;
};
```

### Async Tool Optimization

```typescript
// Batch processing for similar async tools
const batchAsyncTools = async (toolCalls: ToolCall[]) => {
  // Group similar tools
  const grouped = groupBy(toolCalls, call => call.function.name);
  
  // Process each group in parallel
  const results = await Promise.all(
    Object.entries(grouped).map(async ([toolName, calls]) => {
      if (calls.length > 1 && supportsBatching(toolName)) {
        // Batch process
        return processBatchTool(toolName, calls);
      } else {
        // Process individually
        return Promise.all(calls.map(call => processAsyncTool(call)));
      }
    })
  );
  
  return results.flat();
};

// Preemptive workflow warming
const preemptiveWorkflowWarming = async (agentId: string) => {
  const agent = await agentRegistry.get(agentId);
  const asyncTools = agent.allowedTools.filter(isAsyncTool);
  
  // Pre-start common async workflows
  for (const toolName of asyncTools) {
    if (isHighFrequencyTool(toolName)) {
      await workflowAdapter.startRuns([{
        agentId: 'AsyncToolWarmup',
        prompt: JSON.stringify({ toolName, mode: 'warmup' }),
        sessionId: 'warmup'
      }]);
    }
  }
};
```

## Monitoring and Observability

### Tool Execution Metrics

```typescript
// Metrics collection for tools
const toolMetrics = {
  // Sync tool metrics
  syncToolExecuted: (toolName: string, duration: number, success: boolean) => {
    metrics.histogram('tool_execution_duration', duration, { tool: toolName, type: 'sync' });
    metrics.increment('tool_executions_total', { tool: toolName, type: 'sync', success });
  },
  
  // Async tool metrics
  asyncToolStarted: (toolName: string) => {
    metrics.increment('async_tool_started', { tool: toolName });
  },
  
  asyncToolCompleted: (toolName: string, duration: number, success: boolean) => {
    metrics.histogram('async_tool_duration', duration, { tool: toolName });
    metrics.increment('async_tool_completed', { tool: toolName, success });
  },
  
  approvalMetrics: (toolName: string, approvalTime: number, approved: boolean) => {
    metrics.histogram('approval_time', approvalTime, { tool: toolName });
    metrics.increment('approvals_total', { tool: toolName, approved });
  }
};

// Tool execution tracing
const traceToolExecution = async (
  toolName: string,
  args: any,
  context: ExecutionContext,
  execution: () => Promise<any>
) => {
  const span = tracer.startSpan(`tool.${toolName}`);
  
  span.setAttributes({
    'tool.name': toolName,
    'tool.type': getToolType(toolName),
    'session.id': context.sessionId,
    'agent.id': context.agentId,
    'tool.args': JSON.stringify(args)
  });
  
  try {
    const result = await execution();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
};
```

### Tool Performance Dashboard

```typescript
// Dashboard queries for tool performance
const toolDashboard = {
  // Most used tools
  getMostUsedTools: async (timeRange: string) => {
    return await metricsDb.query(`
      SELECT tool_name, COUNT(*) as usage_count
      FROM tool_executions 
      WHERE timestamp >= NOW() - INTERVAL '${timeRange}'
      GROUP BY tool_name
      ORDER BY usage_count DESC
      LIMIT 10
    `);
  },
  
  // Slowest tools
  getSlowestTools: async (timeRange: string) => {
    return await metricsDb.query(`
      SELECT tool_name, AVG(duration) as avg_duration
      FROM tool_executions 
      WHERE timestamp >= NOW() - INTERVAL '${timeRange}'
      GROUP BY tool_name
      ORDER BY avg_duration DESC
      LIMIT 10
    `);
  },
  
  // Tool error rates
  getToolErrorRates: async (timeRange: string) => {
    return await metricsDb.query(`
      SELECT 
        tool_name,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_executions,
        (COUNT(CASE WHEN success = false THEN 1 END) * 100.0 / COUNT(*)) as error_rate
      FROM tool_executions 
      WHERE timestamp >= NOW() - INTERVAL '${timeRange}'
      GROUP BY tool_name
      ORDER BY error_rate DESC
      LIMIT 10
    `);
  },
  
  // Async tool completion times
  getAsyncToolMetrics: async (timeRange: string) => {
    return await metricsDb.query(`
      SELECT 
        tool_name,
        AVG(approval_time) as avg_approval_time,
        AVG(external_system_time) as avg_external_time,
        AVG(total_time) as avg_total_time
      FROM async_tool_executions 
      WHERE timestamp >= NOW() - INTERVAL '${timeRange}'
      GROUP BY tool_name
      ORDER BY avg_total_time DESC
    `);
  }
};
```

This comprehensive tool execution system provides:
- ✅ **Flexible execution modes**: Sync for immediate operations, async for complex workflows
- ✅ **Context preservation**: Full conversation context maintained across async boundaries
- ✅ **Robust error handling**: Multiple failure points handled gracefully
- ✅ **Performance optimization**: Caching, connection pooling, batch processing
- ✅ **Complete observability**: Metrics, tracing, and performance dashboards
- ✅ **Type safety**: Compile-time validation of tool configurations and implementations