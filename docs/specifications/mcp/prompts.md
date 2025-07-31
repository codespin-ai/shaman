# MCP Prompts

Prompts in MCP enable servers to expose reusable prompt templates and interactive workflows that can be customized with arguments. This allows servers to provide structured interactions beyond simple tool calling.

## Overview

Prompts allow servers to:
- Define reusable prompt templates
- Create interactive workflows
- Guide model behavior for specific tasks
- Provide domain-specific interaction patterns
- Enable complex multi-step operations

## Prompt Definition

A prompt consists of:

```typescript
interface Prompt {
  name: string;              // Unique identifier
  title?: string;            // Human-readable name
  description?: string;      // What the prompt does
  arguments?: [              // Required parameters
    {
      name: string;
      description?: string;
      type?: "string" | "number" | "boolean";
      required?: boolean;
      default?: any;
    }
  ];
  annotations?: {            // Additional metadata
    [key: string]: any;
  };
}
```

### Example Prompt Definition

```json
{
  "name": "analyze_database",
  "title": "Database Analysis",
  "description": "Analyze database schema and suggest optimizations",
  "arguments": [
    {
      "name": "tables",
      "description": "Comma-separated list of tables to analyze",
      "type": "string",
      "required": true
    },
    {
      "name": "include_indexes",
      "description": "Include index analysis",
      "type": "boolean",
      "default": true
    }
  ]
}
```

## Protocol Messages

### Listing Prompts

Discover available prompts:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "prompts": [
      {
        "name": "code_review",
        "description": "Review code for best practices and issues"
      },
      {
        "name": "generate_tests",
        "description": "Generate unit tests for code",
        "arguments": [
          {
            "name": "framework",
            "description": "Testing framework to use",
            "default": "jest"
          }
        ]
      }
    ]
  }
}
```

### Getting a Prompt

Retrieve a specific prompt with arguments:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "prompts/get",
  "params": {
    "name": "analyze_database",
    "arguments": {
      "tables": "users,orders,products",
      "include_indexes": true
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "prompt": {
      "name": "analyze_database",
      "description": "Analyze database schema",
      "messages": [
        {
          "role": "system",
          "content": "You are a database optimization expert. Analyze the following tables and provide recommendations."
        },
        {
          "role": "user",
          "content": "Please analyze these tables: users, orders, products\n\nInclude index analysis: true\n\nProvide recommendations for:\n1. Schema optimization\n2. Index improvements\n3. Query performance\n4. Data integrity"
        }
      ]
    }
  }
}
```

### Prompt List Changed Notification

When prompts are added/removed/modified:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/prompts/list_changed"
}
```

## Prompt Capabilities

Servers declare prompt support:

```json
{
  "capabilities": {
    "prompts": {
      "listChanged": true  // Can notify of prompt changes
    }
  }
}
```

## Message Format

Prompts return messages in conversation format:

```typescript
interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;      // For images
  mimeType?: string;
  resource?: {        // For embedded resources
    uri: string;
    mimeType?: string;
    text?: string;
  };
}
```

## Common Prompt Patterns

### 1. Analysis Prompts

```json
{
  "name": "security_audit",
  "description": "Audit code for security vulnerabilities",
  "arguments": [
    {
      "name": "severity_level",
      "type": "string",
      "default": "medium"
    }
  ]
}
```

### 2. Generation Prompts

```json
{
  "name": "generate_documentation",
  "description": "Generate documentation from code",
  "arguments": [
    {
      "name": "format",
      "description": "Output format (markdown, html, pdf)",
      "type": "string",
      "required": true
    },
    {
      "name": "include_examples",
      "type": "boolean",
      "default": true
    }
  ]
}
```

### 3. Interactive Workflows

```json
{
  "name": "refactor_assistant",
  "description": "Guide through code refactoring",
  "arguments": [
    {
      "name": "target_pattern",
      "description": "Design pattern to apply",
      "required": true
    }
  ]
}
```

### 4. Domain-Specific Prompts

```json
{
  "name": "sql_optimization",
  "description": "Optimize SQL queries",
  "arguments": [
    {
      "name": "query",
      "type": "string",
      "required": true
    },
    {
      "name": "database_type",
      "default": "postgresql"
    }
  ]
}
```

## Dynamic Prompts

Prompts can include dynamic content:

### Embedded Resources

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Analyze this configuration:"
        },
        {
          "type": "resource",
          "resource": {
            "uri": "file:///config/app.yaml",
            "mimeType": "application/yaml"
          }
        }
      ]
    }
  ]
}
```

### Embedded Tool Results

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Based on these metrics:"
        },
        {
          "type": "text",
          "text": "CPU: 85%, Memory: 72%, Disk: 45%"
        },
        {
          "type": "text",
          "text": "What optimizations do you recommend?"
        }
      ]
    }
  ]
}
```

## Implementation in Shaman

### Agent Configuration

Agents can use prompts from MCP servers:

```yaml
mcpServers:
  devtools:
    command: "mcp-server-devtools"
    prompts:
      - "code_review"
      - "generate_tests"
      - "refactor_assistant"
```

### Prompt Invocation Flow

```typescript
// 1. Discover available prompts
const { prompts } = await mcpClient.request('prompts/list');

// 2. Get prompt with arguments
const { prompt } = await mcpClient.request('prompts/get', {
  name: 'code_review',
  arguments: {
    language: 'typescript',
    focus: 'performance'
  }
});

// 3. Use prompt messages in conversation
const messages = prompt.messages;
const response = await llm.complete(messages);

// 4. Continue interaction based on response
```

### Dynamic Prompt Building

```typescript
async function buildPromptWithContext(
  promptName: string,
  args: Record<string, any>,
  context: AgentContext
) {
  // Get base prompt
  const { prompt } = await mcpClient.request('prompts/get', {
    name: promptName,
    arguments: args
  });
  
  // Enhance with current context
  const enhancedMessages = [
    ...prompt.messages,
    {
      role: 'user',
      content: `Current context: ${JSON.stringify(context)}`
    }
  ];
  
  return enhancedMessages;
}
```

## Best Practices

### 1. Prompt Design

- Keep prompts focused on specific tasks
- Provide clear descriptions and argument documentation
- Use sensible defaults for optional arguments
- Make prompts composable and reusable

### 2. Argument Validation

```typescript
function validatePromptArguments(
  prompt: Prompt,
  provided: Record<string, any>
): Result<Record<string, any>, Error> {
  const validated: Record<string, any> = {};
  
  for (const arg of prompt.arguments || []) {
    if (arg.required && !(arg.name in provided)) {
      return { 
        success: false, 
        error: new Error(`Missing required argument: ${arg.name}`) 
      };
    }
    
    const value = provided[arg.name] ?? arg.default;
    
    if (value !== undefined && arg.type) {
      const actualType = typeof value;
      if (actualType !== arg.type) {
        return {
          success: false,
          error: new Error(`Invalid type for ${arg.name}: expected ${arg.type}, got ${actualType}`)
        };
      }
    }
    
    validated[arg.name] = value;
  }
  
  return { success: true, data: validated };
}
```

### 3. Error Handling

Common prompt errors:

1. **Prompt Not Found**: Invalid prompt name
2. **Invalid Arguments**: Missing required or wrong types
3. **Server Error**: Prompt generation failed
4. **Size Limit**: Generated prompt too large

```typescript
try {
  const result = await getPrompt(name, args);
  return result;
} catch (error) {
  if (error.code === -32004) {
    return { error: "Prompt not found: " + name };
  }
  if (error.code === -32602) {
    return { error: "Invalid arguments: " + error.message };
  }
  return { error: "Prompt generation failed: " + error.message };
}
```

## Security Considerations

### Prompt Injection

1. **Validate Arguments**: Sanitize all user-provided arguments
2. **Escape Special Characters**: Prevent prompt manipulation
3. **Limit Prompt Size**: Prevent resource exhaustion
4. **Review Generated Prompts**: Audit for unexpected content

### Access Control

1. **Prompt Allowlists**: Define which prompts agents can use
2. **Argument Filtering**: Restrict sensitive arguments
3. **Usage Logging**: Track prompt invocations
4. **Rate Limiting**: Prevent prompt abuse

## Advanced Features

### Chained Prompts

Some servers support prompt chaining:

```json
{
  "name": "multi_step_analysis",
  "description": "Performs analysis in multiple steps",
  "annotations": {
    "chain": [
      { "prompt": "gather_requirements" },
      { "prompt": "analyze_current_state" },
      { "prompt": "generate_recommendations" }
    ]
  }
}
```

### Conditional Prompts

Prompts can adapt based on conditions:

```json
{
  "name": "adaptive_helper",
  "arguments": [
    {
      "name": "user_level",
      "type": "string",
      "description": "beginner, intermediate, expert"
    }
  ],
  "annotations": {
    "conditions": {
      "beginner": "detailed_explanation",
      "expert": "concise_summary"
    }
  }
}
```