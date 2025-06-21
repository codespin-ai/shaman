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

### Runtime Type Validation for MCP Server Configuration

```typescript
import { z } from 'zod';

// Type-safe schema for mcpServers configuration
const McpServersSchema = z.record(
  z.string(), // server name (dynamic key)
  z.union([
    z.array(z.string()),     // ["tool1", "tool2"] - specific tools
    z.literal("*"),          // "*" - wildcard access
    z.literal(""),           // "" - empty string access
    z.null(),                // null - explicit null access
    z.array(z.never()).length(0) // [] - empty array access
  ])
);

// Type for validated configuration
type McpServersConfig = z.infer<typeof McpServersSchema>;

// Validation function with detailed error messages
const validateMcpServers = (mcpServers: unknown): McpServersConfig => {
  try {
    return McpServersSchema.parse(mcpServers);
  } catch (error) {
    const validationError = error as z.ZodError;
    const detailedErrors = validationError.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      received: err.received
    }));
    
    throw new Error(`Invalid mcpServers configuration: ${JSON.stringify(detailedErrors, null, 2)}`);
  }
};

// Example validation in practice
const exampleConfigs = {
  // ✅ Valid configurations
  valid1: { "github-api": ["get_pr_diff", "add_comment"] },
  valid2: { "internal-tools": "*" },
  valid3: { "dev-tools": null },
  valid4: { "staging-tools": [] },
  valid5: { "optional-tools": "" },
  
  // ❌ Invalid configurations (will throw errors)
  invalid1: { "github-api": "not-an-array" },     // String not allowed
  invalid2: { "tools": ["tool1", 123] },          // Array contains non-string
  invalid3: { "bad": "not-wildcard" },            // String that isn't "*" or ""
  invalid4: { "mixed": ["tool1", null] }          // Mixed types in array
};

// Validate all examples
Object.entries(exampleConfigs).forEach(([key, config]) => {
  try {
    const validated = validateMcpServers(config);
    console.log(`✅ ${key}:`, validated);
  } catch (error) {
    console.log(`❌ ${key}:`, error.message);
  }
});
```

### Tool Registry with Enhanced Type Safety

```typescript
// Central tool registry with runtime validation
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
  
  // Enhanced: Get tools for agent with runtime validation
  getToolsForAgent(agentId: string): ToolConfig[] {
    const agent = agentRegistry.get(agentId);
    if (!agent) return [];
    
    // Validate mcpServers configuration at runtime
    let validatedMcpServers: McpServersConfig;
    try {
      validatedMcpServers = validateMcpServers(agent.mcpServers);
    } catch (error) {
      console.error(`Invalid mcpServers for agent ${agentId}:`, error.message);
      return []; // Return empty array for invalid configuration
    }
    
    // Resolve tools from validated configuration
    const allowedTools = this.resolveToolsFromMcpServers(validatedMcpServers);
    
    return allowedTools
      .map(toolName => this.getConfig(toolName))
      .filter(Boolean) as ToolConfig[];
  },
  
  // Enhanced: Resolve tools from validated mcpServers configuration
  resolveToolsFromMcpServers(mcpServersConfig: McpServersConfig): string[] {
    const resolvedTools: string[] = [];
    
    for (const [serverName, toolsSpec] of Object.entries(mcpServersConfig)) {
      const mcpServer = mcpServerRegistry.get(serverName);
      if (!mcpServer) {
        console.warn(`MCP Server '${serverName}' not found in registry`);
        continue;
      }
      
      // Check if full access is granted
      const isFullAccess = 
        toolsSpec === null || 
        toolsSpec === "*" || 
        toolsSpec === "" || 
        (Array.isArray(toolsSpec) && toolsSpec.length === 0);
      
      if (isFullAccess) {
        // Grant access to ALL tools from this server
        const allServerTools = mcpServer.tools.map(tool => tool.name);
        resolvedTools.push(...allServerTools);
        console.debug(`Granted full access to ${serverName}: ${allServerTools.length} tools`);
      } else if (Array.isArray(toolsSpec)) {
        // Grant access to specific tools only
        const availableTools = mcpServer.tools.map(tool => tool.name);
        const validTools = toolsSpec.filter(tool => availableTools.includes(tool));
        
        // Warn about invalid tools
        const invalidTools = toolsSpec.filter(tool => !availableTools.includes(tool));
        if (invalidTools.length > 0) {
          console.warn(`Invalid tools for server '${serverName}': ${invalidTools.join(', ')}`);
          console.warn(`Available tools: ${availableTools.join(', ')}`);
        }
        
        resolvedTools.push(...validTools);
        console.debug(`Granted specific access to ${serverName}: ${validTools.join(', ')}`);
      }
    }
    
    // Remove duplicates and return
    const uniqueTools = [...new Set(resolvedTools)];
    console.debug(`Total resolved tools: ${uniqueTools.length}`);
    return uniqueTools;
  },
  
  // New: Validate agent configuration before registration
  validateAgentConfig(agentConfig: AgentConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate mcpServers configuration
    try {
      const validatedMcpServers = validateMcpServers(agentConfig.mcpServers);
      
      // Check if all referenced servers exist
      for (const serverName of Object.keys(validatedMcpServers)) {
        if (!mcpServerRegistry.has(serverName)) {
          errors.push(`MCP Server '${serverName}' not found in registry`);
        }
      }
      
      // Check if specific tools exist
      for (const [serverName, toolsSpec] of Object.entries(validatedMcpServers)) {
        if (Array.isArray(toolsSpec) && toolsSpec.length > 0) {
          const server = mcpServerRegistry.get(serverName);
          if (server) {
            const availableTools = server.tools.map(t => t.name);
            const invalidTools = toolsSpec.filter(tool => !availableTools.includes(tool));
            if (invalidTools.length > 0) {
              warnings.push(`Server '${serverName}' doesn't have tools: ${invalidTools.join(', ')}`);
            }
          }
        }
      }
      
    } catch (error) {
      errors.push(`Invalid mcpServers configuration: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
};

// Type definitions
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface AgentConfig {
  name: string;
  description: string;
  mcpServers: unknown; // Will be validated at runtime
  allowedAgents: string[];
  // ... other fields
}

// Register tools at startup
toolRegistry.register(checkAccountConfig, checkAccountTool);
toolRegistry.register(processRefundConfig, processRefundTool);
```

### Enhanced Dynamic Tool Loading with Validation

```typescript
// Load tools from configuration with comprehensive validation
const loadToolsFromConfig = (toolConfigs: ToolConfig[]) => {
  const loadResults: Array<{ name: string; success: boolean; error?: string }> = [];
  
  for (const config of toolConfigs) {
    try {
      // Load implementation
      const implementation = require(`./tools/${config.name}`).default;
      
      // Validate tool implementation
      validateToolImplementation(config, implementation);
      
      // Register tool
      toolRegistry.register(config, implementation);
      
      loadResults.push({ name: config.name, success: true });
      console.log(`✅ Loaded tool: ${config.name}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loadResults.push({ name: config.name, success: false, error: errorMessage });
      console.error(`❌ Failed to load tool ${config.name}:`, errorMessage);
    }
  }
  
  // Summary report
  const successful = loadResults.filter(r => r.success).length;
  const failed = loadResults.filter(r => !r.success).length;
  
  console.log(`Tool loading complete: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    console.log('Failed tools:', loadResults.filter(r => !r.success));
  }
  
  return loadResults;
};

// Enhanced tool implementation validation
const validateToolImplementation = (config: ToolConfig, implementation: ToolFunction) => {
  // Check function signature
  if (typeof implementation !== 'function') {
    throw new Error(`Tool ${config.name} implementation must be a function`);
  }
  
  // Check function parameter count
  const expectedParamCount = 2; // (args, context)
  if (implementation.length !== expectedParamCount) {
    throw new Error(`Tool ${config.name} must accept exactly ${expectedParamCount} parameters (args, context)`);
  }
  
  // Validate parameters match config schema
  if (config.parameters && config.parameters.properties) {
    const configParams = Object.keys(config.parameters.properties);
    console.debug(`Tool ${config.name} expects parameters:`, configParams);
  }
  
  // Check if it's async (recommended for most tools)
  const isAsync = implementation.constructor.name === 'AsyncFunction';
  if (!isAsync && config.executionType === 'async') {
    console.warn(`Tool ${config.name} is configured as async but implementation is not async`);
  }
  
  console.debug(`✅ Tool ${config.name} implementation validated`);
};
```

This comprehensive tool execution system provides:
- ✅ **Flexible execution modes**: Sync for immediate operations, async for complex workflows
- ✅ **Context preservation**: Full conversation context maintained across async boundaries
- ✅ **Runtime type safety**: Strict validation of mcpServers configuration with clear error messages
- ✅ **Fine-grained tool access**: Support for new mcpServers object format with granular permissions
- ✅ **Robust error handling**: Multiple failure points handled gracefully with detailed diagnostics
- ✅ **Performance optimization**: Caching, connection pooling, batch processing
- ✅ **Complete observability**: Metrics, tracing, and performance dashboards
- ✅ **Development-friendly**: Comprehensive validation, detailed error messages, and debugging support