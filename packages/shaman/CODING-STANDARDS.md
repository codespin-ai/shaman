# Shaman Coding Standards

This document defines the coding standards and conventions for the Shaman AI Agent Coordination Framework.

## 🎯 Core Principles

### 1. **Functional Programming First**
- No classes - use pure functions and data transformations
- Immutable data structures where possible
- Composable function design
- Explicit dependency injection through parameters

### 2. **ESM TypeScript**
- Modern ES modules with `.js` file extensions in imports
- Strong typing with comprehensive type definitions
- Prefer `type` over `interface` (use `interface` only for extensible contracts)

### 3. **Explicit and Predictable**
- Function signatures should be self-documenting
- No hidden state or side effects
- Clear input/output contracts
- Explicit error handling with Result types

## 📁 File Structure and Naming

### File Extensions and Imports
```typescript
// ✅ Good - Use .js extensions in imports
import { executeAgent } from './agent-runner.js';
import { GitAgent } from '../shared/types.js';

// ❌ Bad - No file extensions
import { executeAgent } from './agent-runner';
```

### File Naming
- Use kebab-case: `agent-runner.ts`, `git-discovery.ts`
- Be descriptive: `external-agent-health.ts` not `health.ts`
- Group related functionality in directories

## 🔧 Function Design Patterns

### 1. **Pure Function Exports**
```typescript
// ✅ Good - Pure function with explicit dependencies
export async function executeAgent(
  agentName: string,
  input: string,
  context: ExecutionContext,
  dependencies: {
    llmProvider: LLMProvider;
    toolRouter: ToolRouter;
    memoryManager: MemoryManager;
  }
): Promise<AgentExecutionResult> {
  // Implementation
}

// ❌ Bad - Class-based approach
export class AgentRunner {
  constructor(
    private llmProvider: LLMProvider,
    private toolRouter: ToolRouter
  ) {}
  
  async execute(agentName: string, input: string) {
    // Implementation
  }
}
```

### 2. **Configuration and Dependencies**
```typescript
// ✅ Good - Explicit configuration objects
export type DatabaseConfig = {
  readonly url: string;
  readonly poolSize: number;
  readonly ssl: boolean;
  readonly timeout: number;
};

export async function initializeDatabase(
  config: DatabaseConfig
): Promise<DatabaseConnection> {
  // Implementation
}

// ✅ Good - Dependency injection pattern
export async function processAgentCall(
  agentCall: AgentCallRequest,
  dependencies: {
    agentResolver: (name: string) => Promise<ResolvedAgent>;
    workflowEngine: WorkflowEngine;
    authChecker: (context: SecurityContext) => Promise<boolean>;
  }
): Promise<AgentCallResult> {
  // Implementation
}
```

### 3. **Result Types for Error Handling**
```typescript
// ✅ Good - Explicit Result types
export type Result<T, E = Error> = {
  readonly success: true;
  readonly data: T;
} | {
  readonly success: false;
  readonly error: E;
};

export async function validateAgentDefinition(
  frontmatter: unknown
): Promise<Result<AgentDefinition, ValidationError[]>> {
  if (!isValidFrontmatter(frontmatter)) {
    return {
      success: false,
      error: [{ field: 'name', message: 'Name is required' }]
    };
  }
  
  return {
    success: true,
    data: frontmatter as AgentDefinition
  };
}

// Usage
const result = await validateAgentDefinition(data);
if (!result.success) {
  console.error('Validation failed:', result.error);
  return;
}
const agentDef = result.data; // Type-safe access
```

## 📊 Type Definitions

### 1. **Prefer `type` over `interface`**
```typescript
// ✅ Good - Use type for data structures
export type User = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly createdAt: Date;
};

export type CreateUserRequest = {
  readonly email: string;
  readonly name: string;
  readonly role?: UserRole;
};

// ✅ Acceptable - Use interface for extensible contracts
export interface LLMProvider {
  call(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  getModels(): Promise<string[]>;
}
```

### 2. **Immutable Data Structures**
```typescript
// ✅ Good - Readonly properties
export type AgentExecutionContext = {
  readonly runId: string;
  readonly stepId: string;
  readonly agentName: string;
  readonly callStack: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
};

// ✅ Good - Functional updates
export function addToCallStack(
  context: AgentExecutionContext,
  agentName: string
): AgentExecutionContext {
  return {
    ...context,
    callStack: [...context.callStack, agentName]
  };
}
```

### 3. **Discriminated Unions**
```typescript
// ✅ Good - Clear discriminated unions
export type AgentSource = 
  | { readonly type: 'git'; readonly repository: string; readonly commit: string; }
  | { readonly type: 'external'; readonly endpoint: string; readonly agentCard: A2AAgentCard; };

export type ExecutionState =
  | { readonly status: 'running'; readonly startTime: Date; }
  | { readonly status: 'completed'; readonly startTime: Date; readonly endTime: Date; readonly result: string; }
  | { readonly status: 'failed'; readonly startTime: Date; readonly endTime: Date; readonly error: string; };
```

## 🔄 Async Patterns

### 1. **Promise-Based Functions**
```typescript
// ✅ Good - Explicit async/await
export async function syncGitRepository(
  repoConfig: GitRepositoryConfig
): Promise<Result<SyncResult, SyncError>> {
  try {
    const gitCredentials = await authenticateRepository(repoConfig);
    const commits = await fetchNewCommits(repoConfig, gitCredentials);
    const agents = await discoverAgentsInCommits(commits);
    
    return {
      success: true,
      data: {
        repository: repoConfig.name,
        discoveredAgents: agents,
        syncedCommit: commits[0]?.hash ?? null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        repository: repoConfig.name,
        message: error.message,
        timestamp: new Date()
      }
    };
  }
}
```

### 2. **Stream Processing**
```typescript
// ✅ Good - Async iterables for streaming
export async function* streamLLMResponse(
  request: LLMRequest,
  provider: LLMProvider
): AsyncIterable<LLMStreamChunk> {
  for await (const chunk of provider.stream(request)) {
    // Transform and validate chunk
    const validatedChunk = validateStreamChunk(chunk);
    if (validatedChunk.success) {
      yield validatedChunk.data;
    }
  }
}

// Usage
for await (const chunk of streamLLMResponse(request, provider)) {
  console.log('Received chunk:', chunk);
}
```

## 🏗️ Module Organization

### 1. **Clear Module Exports**
```typescript
// src/agents/resolver.ts

// Types first
export type AgentResolution = {
  readonly agent: GitAgent | ExternalAgent;
  readonly source: 'git' | 'external';
  readonly resolvedAt: Date;
};

export type ResolverOptions = {
  readonly includeInactive: boolean;
  readonly preferredCommit?: string;
};

// Main functions
export async function resolveAgent(
  agentName: string,
  options: ResolverOptions = { includeInactive: false }
): Promise<Result<AgentResolution, AgentNotFoundError>> {
  // Implementation
}

export async function listAvailableAgents(
  filters?: AgentFilters
): Promise<readonly string[]> {
  // Implementation
}

// Helper functions (can be internal)
function parseAgentPath(agentName: string): AgentPath {
  // Implementation
}
```

### 2. **Index Files for Clean Imports**
```typescript
// src/agents/index.ts
export {
  resolveAgent,
  listAvailableAgents,
  type AgentResolution,
  type ResolverOptions
} from './resolver.js';

export {
  syncRepository,
  discoverAgents,
  type SyncResult,
  type GitRepositoryConfig
} from './git-discovery.js';

// Usage in other modules
import { resolveAgent, syncRepository } from '@/agents/index.js';
```

## 🧪 Testing Patterns

### 1. **Pure Function Testing**
```typescript
// tests/unit/agent-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAgent } from '@/agents/resolver.js';

describe('resolveAgent', () => {
  it('should resolve git agent from root repository', async () => {
    const mockGitResolver = vi.fn().mockResolvedValue({
      success: true,
      data: {
        name: 'test-agent',
        source: 'git',
        repository: 'main-agents'
      }
    });

    const result = await resolveAgent(
      'test-agent',
      { includeInactive: false },
      { gitResolver: mockGitResolver, externalResolver: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('git');
    }
  });
});
```

### 2. **Integration Testing**
```typescript
// tests/integration/agent-execution.test.ts
describe('Agent Execution Integration', () => {
  it('should execute simple agent end-to-end', async () => {
    const testConfig = await loadTestConfig();
    const dependencies = await setupTestDependencies(testConfig);
    
    const result = await executeAgent(
      'test-echo-agent',
      'Hello, world!',
      createTestContext(),
      dependencies
    );
    
    expect(result.success).toBe(true);
    expect(result.data.output).toContain('Hello, world!');
  });
});
```

## 📋 Code Quality Guidelines

### 1. **Documentation Comments**
```typescript
/**
 * Executes an AI agent with the given input and context.
 * 
 * @param agentName - The name of the agent to execute
 * @param input - The input prompt for the agent
 * @param context - Execution context with run metadata
 * @param dependencies - Required service dependencies
 * @returns Promise resolving to execution result or error
 * 
 * @example
 * ```typescript
 * const result = await executeAgent(
 *   'customer-support',
 *   'Help with order #12345',
 *   context,
 *   { llmProvider, toolRouter, memoryManager }
 * );
 * 
 * if (result.success) {
 *   console.log('Agent response:', result.data.output);
 * }
 * ```
 */
export async function executeAgent(/* ... */): Promise<AgentExecutionResult> {
  // Implementation
}
```

### 2. **Validation Functions**
```typescript
// ✅ Good - Explicit validation with type guards
export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateCreateUserRequest(
  request: unknown
): Result<CreateUserRequest, ValidationError[]> {
  const errors: ValidationError[] = [];
  
  if (!isObject(request)) {
    return { success: false, error: [{ field: 'root', message: 'Request must be an object' }] };
  }
  
  if (!isValidEmail(request.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }
  
  if (typeof request.name !== 'string' || request.name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
  
  if (errors.length > 0) {
    return { success: false, error: errors };
  }
  
  return {
    success: true,
    data: request as CreateUserRequest
  };
}
```

## 🚫 Anti-Patterns to Avoid

### 1. **Don't Use Classes**
```typescript
// ❌ Bad
export class UserService {
  constructor(private db: Database) {}
  
  async createUser(data: CreateUserRequest): Promise<User> {
    return this.db.users.create(data);
  }
}

// ✅ Good
export async function createUser(
  data: CreateUserRequest,
  db: Database
): Promise<Result<User, DatabaseError>> {
  try {
    const user = await db.users.create(data);
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: adaptDatabaseError(error) };
  }
}
```

### 2. **Avoid Implicit Dependencies**
```typescript
// ❌ Bad - Hidden global state
let globalConfig: Config;

export function processRequest(request: Request): Response {
  // Uses globalConfig implicitly
  return processWithConfig(request, globalConfig);
}

// ✅ Good - Explicit dependencies
export function processRequest(
  request: Request,
  config: Config
): Response {
  return processWithConfig(request, config);
}
```

### 3. **Don't Throw Exceptions for Business Logic**
```typescript
// ❌ Bad - Exceptions for control flow
export async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

// ✅ Good - Result types for business logic
export async function getUser(
  id: string,
  db: Database
): Promise<Result<User, UserNotFoundError>> {
  const user = await db.findUser(id);
  if (!user) {
    return {
      success: false,
      error: { type: 'UserNotFound', userId: id }
    };
  }
  return { success: true, data: user };
}
```

## 🎨 Formatting and Linting

Use the following tools and configurations:

- **Prettier** for code formatting
- **ESLint** with TypeScript rules
- **Strict TypeScript** configuration
- **Import sorting** by category (Node.js → dependencies → internal)

Example ESLint configuration:
```json
{
  "extends": ["@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

**Remember**: The goal is to write code that is **predictable, testable, and maintainable** through functional composition and strong typing.