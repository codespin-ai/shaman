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
- **NO `any` types** - All code must be fully typed

### 3. **Explicit and Predictable**

- Function signatures should be self-documenting
- No hidden state or side effects
- Clear input/output contracts
- Explicit error handling with Result types

### 4. **Recent Architectural Decisions**

- **Git Operations**: Use native git commands instead of isomorphic-git
- **Agent Caching**: Cache agents by commit hash for performance
- **Unified Interfaces**: Single interface for all agent sources
- **Platform Tools**: Immutable, attributed workflow data storage
- **Workflow Abstraction**: ExecutionEngine interface for all workflow adapters

## 📁 File Structure and Naming

### File Extensions and Imports

```typescript
// ✅ Good - Use .js extensions in imports
import { executeAgent } from "./agent-runner.js";
import { GitAgent } from "../shared/types.js";

// ❌ Bad - No file extensions
import { executeAgent } from "./agent-runner";
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
import { createLogger } from '@codespin/shaman-logger';

const logger = createLogger('Validation');

export type Result<T, E = Error> =
  | {
      readonly success: true;
      readonly data: T;
    }
  | {
      readonly success: false;
      readonly error: E;
    };

export async function validateAgentDefinition(
  frontmatter: unknown
): Promise<Result<AgentDefinition, ValidationError[]>> {
  if (!isValidFrontmatter(frontmatter)) {
    return {
      success: false,
      error: [{ field: "name", message: "Name is required" }],
    };
  }

  return {
    success: true,
    data: frontmatter as AgentDefinition,
  };
}

// Usage
const result = await validateAgentDefinition(data);
if (!result.success) {
  logger.error("Validation failed:", result.error);
  return;
}
const agentDef = result.data; // Type-safe access
```

### 4. **LLM Provider Pattern**

```typescript
// ✅ Good - Unified LLM provider interface
import type { LLMProvider, LLMCompletionRequest } from '@codespin/shaman-llm-core';

export async function callLLM(
  request: LLMCompletionRequest,
  provider: LLMProvider
): Promise<Result<LLMCompletionResponse>> {
  try {
    const response = await provider.complete(request);
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error };
  }
}

// ✅ Good - Provider implementation with Vercel AI SDK
export function createVercelLLMProvider(config: VercelConfig): LLMProvider {
  return {
    async complete(request) {
      const model = getModelFromConfig(request.model, config);
      return await generateText({
        model,
        messages: request.messages,
        tools: request.tools,
        temperature: request.temperature
      });
    },
    
    async streamComplete(request) {
      const model = getModelFromConfig(request.model, config);
      const stream = await streamText({
        model,
        messages: request.messages,
        tools: request.tools
      });
      
      for await (const chunk of stream.textStream) {
        yield { content: chunk };
      }
    }
  };
}
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
    callStack: [...context.callStack, agentName],
  };
}
```

### 3. **Discriminated Unions**

```typescript
// ✅ Good - Clear discriminated unions
export type AgentSource =
  | {
      readonly type: "git";
      readonly repository: string;
      readonly commit: string;
    }
  | {
      readonly type: "external";
      readonly endpoint: string;
      readonly agentCard: A2AAgentCard;
    };

export type ExecutionState =
  | { readonly status: "running"; readonly startTime: Date }
  | {
      readonly status: "completed";
      readonly startTime: Date;
      readonly endTime: Date;
      readonly result: string;
    }
  | {
      readonly status: "failed";
      readonly startTime: Date;
      readonly endTime: Date;
      readonly error: string;
    };
```

## 🗄️ Database Access Patterns

### 1. **DbRow Pattern with Domain Structure**

All database access must use the DbRow pattern for type safety and clear separation between database schema and domain types. The codebase follows a domain-driven architecture with modular organization.

```typescript
// ✅ Good - DbRow type mirrors exact database schema
type RunDbRow = {
  id: string;
  status: string;
  initial_input: string;
  total_cost: number;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  created_by: string;
  trace_id: string | null;
  metadata: unknown;  // JSONB fields typed as unknown
};

// ✅ Good - Bidirectional mapper functions
function mapRunFromDb(row: RunDbRow): Run {
  return {
    id: row.id,
    status: row.status as ExecutionState,
    initialInput: row.initial_input,
    totalCost: row.total_cost,
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration || undefined,
    createdBy: row.created_by,
    traceId: row.trace_id || undefined,
    metadata: row.metadata as Record<string, unknown> | undefined
  };
}

function mapRunToDb(run: Omit<Run, 'id' | 'startTime'> & { id?: string }): Partial<RunDbRow> {
  return {
    id: run.id,
    status: run.status,
    initial_input: run.initialInput,
    total_cost: run.totalCost,
    created_by: run.createdBy,
    trace_id: run.traceId || null,
    metadata: run.metadata || null,
    end_time: run.endTime || null,
    duration: run.duration || null
  };
}

// ✅ Good - Type-safe queries
export async function getRun(id: string): Promise<Run | null> {
  const result = await db.oneOrNone<RunDbRow>(
    `SELECT * FROM run WHERE id = $(id)`,
    { id }
  );
  return result ? mapRunFromDb(result) : null;
}
```

**Key Rules:**
- DbRow types use **snake_case** to match database columns exactly
- Domain types use **camelCase** for TypeScript conventions
- JSONB fields typed as `unknown` in DbRow types
- All queries must specify the DbRow type: `db.one<XxxDbRow>(...)`
- Mapper functions handle all conversions including null/undefined mapping
- Use `Partial<XxxDbRow>` for insert/update operations

### Domain Structure Organization

All database-related functions are organized in domain directories with:
- `types.ts` - DbRow type definitions only
- `mappers/` - Individual mapper functions (one per file, e.g., `map-run-from-db.ts`, `map-run-to-db.ts`)
- Individual function files for business logic (e.g., `create-run.ts`, `get-run.ts`, `update-run.ts`)
- Utility functions in separate files (e.g., `generate-run-id.ts`)
- `index.ts` - Clean exports for the entire domain

```typescript
// Example domain structure: src/domain/run/
// types.ts - Only type definitions
export type RunDbRow = {
  id: string;
  status: string;
  // ... other fields
};

// mappers/map-run-from-db.ts - Single mapper function
export function mapRunFromDb(row: RunDbRow): Run {
  return {
    id: row.id,
    status: row.status as ExecutionState,
    // ... field conversions
  };
}

// create-run.ts - Single business function  
export async function createRun(db: Database, run: CreateRunInput): Promise<Run> {
  // Implementation using mapRunToDb and mapRunFromDb
}

// index.ts - Clean exports
export { createRun } from './create-run.js';
export { getRun } from './get-run.js';
export { mapRunFromDb } from './mappers/map-run-from-db.js';
export type { RunDbRow } from './types.js';
```

### 2. **Named Parameters in SQL**

Always use named parameters in SQL queries for clarity and safety. Use pg-promise's named parameter syntax.

```typescript
// ✅ Good - Named parameters
export async function createRunData(
  data: RunDataInput,
  db: Database
): Promise<Result<RunData, DatabaseError>> {
  try {
    const result = await db.one(
      `INSERT INTO run_data 
       (run_id, key, value, created_by_agent_name, created_by_agent_source, created_by_step_id)
       VALUES ($(runId), $(key), $(value), $(agentName), $(agentSource), $(stepId))
       RETURNING *`,
      {
        runId: data.runId,
        key: data.key,
        value: JSON.stringify(data.value),
        agentName: data.agentName,
        agentSource: data.agentSource,
        stepId: data.stepId
      }
    );
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: adaptDatabaseError(error) };
  }
}

// ❌ Bad - Positional parameters
export async function createRunData(data: RunDataInput, db: Database) {
  const result = await db.query(
    `INSERT INTO run_data VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.runId, data.key, data.value, data.agentName, data.agentSource, data.stepId]
  );
}

// ✅ Good - Complex queries with named parameters
export async function findRunDataByAgent(
  filters: RunDataFilters,
  db: Database
): Promise<Result<RunData[], DatabaseError>> {
  const query = `
    SELECT * FROM run_data 
    WHERE run_id = $(runId)
      AND created_by_agent_name = $(agentName)
      ${filters.afterDate ? 'AND created_at > $(afterDate)' : ''}
    ORDER BY created_at DESC
    LIMIT $(limit)
  `;
  
  try {
    const results = await db.manyOrNone(query, {
      runId: filters.runId,
      agentName: filters.agentName,
      afterDate: filters.afterDate,
      limit: filters.limit || 100
    });
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: adaptDatabaseError(error) };
  }
}
```

### 2. **Database Connection Patterns**

```typescript
// ✅ Good - Pass database connection explicitly
export async function executeInTransaction<T>(
  operation: (tx: DatabaseTransaction) => Promise<T>,
  db: Database
): Promise<Result<T, DatabaseError>> {
  try {
    const result = await db.tx(async (tx) => {
      return await operation(tx);
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: adaptDatabaseError(error) };
  }
}
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
        syncedCommit: commits[0]?.hash ?? null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        repository: repoConfig.name,
        message: error.message,
        timestamp: new Date(),
      },
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
import { createLogger } from '@codespin/shaman-logger';
const logger = createLogger('LLMStream');

for await (const chunk of streamLLMResponse(request, provider)) {
  logger.debug("Received chunk:", { chunk });
}
```

## 🏗️ Module Organization

### 1. **Clear Module Exports**

```typescript
// src/agents/resolver.ts

// Types first
export type AgentResolution = {
  readonly agent: GitAgent | ExternalAgent;
  readonly source: "git" | "external";
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
  type ResolverOptions,
} from "./resolver.js";

export {
  syncRepository,
  discoverAgents,
  type SyncResult,
  type GitRepositoryConfig,
} from "./git-discovery.js";

// Usage in other modules
import { resolveAgent, syncRepository } from "@/agents/index.js";
```

## 🧪 Testing Patterns

### 1. **Pure Function Testing**

```typescript
// tests/unit/agent-resolver.test.ts
import { describe, it, expect } from "vitest";
import { resolveAgent } from "@/agents/resolver.js";

describe("resolveAgent", () => {
  it("should resolve git agent from root repository", async () => {
    const mockGitResolver = vi.fn().mockResolvedValue({
      success: true,
      data: {
        name: "test-agent",
        source: "git",
        repository: "main-agents",
      },
    });

    const result = await resolveAgent(
      "test-agent",
      { includeInactive: false },
      { gitResolver: mockGitResolver, externalResolver: vi.fn() }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("git");
    }
  });
});
```

### 2. **Integration Testing**

```typescript
// tests/integration/agent-execution.test.ts
describe("Agent Execution Integration", () => {
  it("should execute simple agent end-to-end", async () => {
    const testConfig = await loadTestConfig();
    const dependencies = await setupTestDependencies(testConfig);

    const result = await executeAgent(
      "test-echo-agent",
      "Hello, world!",
      createTestContext(),
      dependencies
    );

    expect(result.success).toBe(true);
    expect(result.data.output).toContain("Hello, world!");
  });
});
```

## 📋 Code Quality Guidelines

### 1. **Documentation Comments**

````typescript
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
 *   { llmProvider, toolRouter }
 * );
 *
 * import { createLogger } from '@codespin/shaman-logger';
 * const logger = createLogger('AgentDemo');
 * 
 * if (result.success) {
 *   logger.info('Agent response:', { output: result.data.output });
 * }
 * ```
 */
export async function executeAgent(/* ... */): Promise<AgentExecutionResult> {
  // Implementation
}
````

### 2. **Validation Functions**

```typescript
// ✅ Good - Explicit validation with type guards
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateCreateUserRequest(
  request: unknown
): Result<CreateUserRequest, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!isObject(request)) {
    return {
      success: false,
      error: [{ field: "root", message: "Request must be an object" }],
    };
  }

  if (!isValidEmail(request.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }

  if (typeof request.name !== "string" || request.name.length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters",
    });
  }

  if (errors.length > 0) {
    return { success: false, error: errors };
  }

  return {
    success: true,
    data: request as CreateUserRequest,
  };
}
```

## 🛠️ Platform Tools Pattern

```typescript
// ✅ Good - Type-safe platform tool implementation
import type { PlatformToolName, PlatformToolSchemas, PlatformToolResults } from './types.js';

export type PlatformToolHandlers = {
  [K in PlatformToolName]: ToolHandler<
    PlatformToolSchemas[K],
    PlatformToolResults[K]
  >;
};

// Type-safe handler implementation
export function createPlatformToolHandlers(
  dependencies: ToolRouterDependencies
): PlatformToolHandlers {
  return {
    run_data_write: async (input, context) => {
      const data = await dependencies.persistenceLayer.createRunData({
        runId: context.runId,
        key: input.key,
        value: input.value,
        createdByAgentName: context.agentName,
        createdByAgentSource: context.agentSource,
        createdByStepId: context.stepId,
        metadata: input.metadata
      });
      return { success: true, data: undefined };
    },
    
    run_data_read: async (input, context) => {
      const data = await dependencies.persistenceLayer.getRunData(
        context.runId,
        input.key
      );
      return { success: true, data };
    }
    // ... other handlers
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
export function processRequest(request: Request, config: Config): Response {
  return processWithConfig(request, config);
}
```

### 3. **Don't Throw Exceptions for Business Logic**

```typescript
// ❌ Bad - Exceptions for control flow
export async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id);
  if (!user) {
    throw new Error("User not found");
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
      error: { type: "UserNotFound", userId: id },
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
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

**Remember**: The goal is to write code that is **predictable, testable, and maintainable** through functional composition and strong typing.
