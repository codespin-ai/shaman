# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project structure and conventions
2. **Read PROJECT_STATUS.md** - This file tracks the current implementation progress, what's completed, what's in progress, and what needs to be done next. This is specifically maintained for AI assistants to quickly understand where the project stands.
3. **Read the key documentation files** in this order:
   - `/README.md` - Project overview and quick start
   - `/node/CODING-STANDARDS.md` - Mandatory coding patterns and conventions
   - `/agents/agent.md` - Agent development guide
   - `/docs/01-overview-and-concepts.md` - Core concepts
   - `/docs/02-use-cases-and-agent-model.md` - Agent patterns
   - `/docs/03-system-architecture.md` - Architecture details
   - Any other relevant docs based on the task at hand

Only after reading these documents should you proceed with any implementation or analysis tasks.

## Overview

Shaman is a comprehensive backend framework for managing and coordinating AI agents through a federated ecosystem. It's a NodeJS/TypeScript monorepo that deliberately avoids npm workspaces in favor of a custom build system.

## Recent Important Changes

- **Git Operations**: Now uses native git commands instead of isomorphic-git
- **Agent Caching**: Git agents are cached by commit hash for performance
- **Branch Support**: All git operations support branch parameters
- **Unified Agent Resolution**: New `shaman-agents` package provides single interface for all agent sources
- **Type Safety**: All `any` types removed from codebase, replaced with proper types
- **LLM Provider**: Vercel AI SDK provider implemented with OpenAI and Anthropic support
- **Agent Executor**: Complete agent execution engine with tool calling and conversation management
- **Workflow Foundation**: Temporal adapter, tool router, and platform tools implemented
- **Domain-Driven Architecture**: Refactored persistence layer to domain structure with one-function-per-file pattern and dedicated mapper directories

## Essential Commands

### Git Workflow Rules

**IMPORTANT**: NEVER commit or push changes without explicit user instruction
- Only run `git add`, `git commit`, or `git push` when the user explicitly asks
- Common explicit instructions include: "commit", "push", "commit and push", "save to git"
- If unsure, ask the user if they want to commit the changes
- Always wait for user approval before making any git operations

### Build Commands
```bash
# Build entire project (from root)
./build.sh              # Standard build
./build.sh --install    # Force npm install in all packages
./build.sh --migrate    # Build + run DB migrations
./build.sh --seed       # Build + run DB seeds

# Clean build artifacts
./clean.sh

# Start the application
./start.sh

# Lint entire project (from root)
./lint-all.sh           # Run ESLint on all packages
```

### Database Commands

**IMPORTANT**: NEVER run database migrations or seeds unless explicitly instructed by the user
- Only run migration/seed commands that modify the database when the user specifically asks
- You can run status checks and create new migration/seed files without explicit permission
- There is NO DEFAULT database - all commands must specify the database name

```bash
# Check migration status (safe to run)
npm run migrate:shaman:status
npm run migrate:all:status

# Create new migration (safe to run)
npm run migrate:shaman:make migration_name

# Run migrations (ONLY when explicitly asked)
npm run migrate:shaman:latest
npm run migrate:shaman:rollback
npm run migrate:all

# Create seed file (safe to run)
npm run seed:shaman:make seed_name

# Run seeds (ONLY when explicitly asked)
npm run seed:shaman:run
```

### Database-specific commands (replace 'shaman' with your database name)

```bash
npm run migrate:shaman:latest    # Run latest migrations
npm run migrate:shaman:make migration_name  # Create new migration
npm run migrate:shaman:rollback  # Rollback migrations
npm run migrate:shaman:status    # Check migration status
npm run seed:shaman:make seed_name  # Create seed file
npm run seed:shaman:run          # Run seeds

# Run commands on all databases
npm run migrate:all          # Run latest migrations on all databases
npm run migrate:all:rollback # Rollback all databases
npm run migrate:all:status   # Check status of all databases
npm run seed:all             # Run seeds on all databases
```

### Development Commands
```bash
# Start server and UI
npm start

# TypeScript compilation for individual packages
cd node/packages/[package-name] && npm run build

# Linting commands (from /node directory)
cd node && npm run lint        # Run ESLint on all packages
cd node && npm run lint:fix    # Run ESLint with auto-fix on all packages

# Individual package linting
cd node/packages/[package-name] && npm run lint
cd node/packages/[package-name] && npm run lint:fix
```

## Critical Architecture Decisions

### 1. Monorepo Without Workspaces
- **NO npm workspaces** - Uses custom `./build.sh` script instead
- Dependencies between packages use `file:` protocol (e.g., `"@codespin/shaman-types": "file:../shaman-types"`)
- **IMPORTANT**: When adding new packages, you MUST update the `PACKAGES` array in `./build.sh`

### 2. Functional Programming Only
- **NO CLASSES** - Export functions from modules only
- Use pure functions with explicit dependency injection
- Prefer `type` over `interface` (use `interface` only for extensible contracts)
- Use Result types for error handling instead of exceptions

### 3. Database Conventions
- **PostgreSQL** with **Knex.js** for migrations
- **pg-promise** for data access (NO ORMs)
- Table names: **singular** and **snake_case** (e.g., `agent_repository`)
- TypeScript: **camelCase** for all variables/properties
- SQL: **snake_case** for all table/column names
- **DbRow Pattern**: All persistence functions use `XxxDbRow` types that mirror exact database schema
- **Mapper Functions**: `mapXxxFromDb()` and `mapXxxToDb()` handle conversions between snake_case DB and camelCase domain types
- **Type-safe Queries**: All queries use `db.one<XxxDbRow>()` with explicit type parameters

### 4. ESM Modules
- All imports MUST include `.js` extension: `import { foo } from './bar.js'`
- TypeScript configured for `"module": "NodeNext"`
- Type: `"module"` in all package.json files

### 5. TypeScript Configuration
- **NO tsconfig.base.json** - Each package uses its own simple, consistent tsconfig.json
- Standard tsconfig pattern for all packages:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "outDir": "./dist",
      "strict": true,
      "forceConsistentCasingInFileNames": true,
      "declaration": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist"]
  }
  ```
- Do NOT add extra options like `esModuleInterop`, `skipLibCheck`, etc. unless absolutely necessary

## Package Structure

Located in `/node/packages/`, build order matters:

1. **@codespin/shaman-types** - Shared TypeScript interfaces (start here for new features)
2. **@codespin/shaman-logger** - Centralized logging for all packages
3. **@codespin/shaman-core** - Core types and utilities
4. **@codespin/shaman-config** - Configuration management
5. **@codespin/shaman-llm-core** - LLM provider abstraction
6. **@codespin/shaman-workflow-core** - Workflow engine abstraction
7. **@codespin/shaman-db** - Database connection management
8. **@codespin/shaman-observability** - Metrics and tracing
9. **@codespin/shaman-security** - Auth, RBAC, rate limiting
10. **@codespin/shaman-external-registry** - External agent registry
11. **@codespin/shaman-git-resolver** - Git-based agent discovery (with caching)
12. **@codespin/shaman-agents** - Unified agent resolution from all sources
13. **@codespin/shaman-a2a-provider** - Expose Git agents via A2A protocol
14. **@codespin/shaman-llm-vercel** - Vercel AI SDK provider
15. **@codespin/shaman-tool-router** - Tool execution routing
16. **@codespin/shaman-agent-executor** - Core agent execution engine
17. **@codespin/shaman-workflow-bullmq** - BullMQ workflow adapter
18. **@codespin/shaman-workflow-temporal** - Temporal workflow adapter
19. **@codespin/shaman-server** - Main GraphQL server
20. **@codespin/shaman-worker** - Background worker
21. **@codespin/shaman-cli** - CLI tool

## Development Workflow

1. **Define Types**: Add/update interfaces in `@codespin/shaman-types`
2. **Update Dependencies**: Add `file:` references to package.json files
3. **Update Build Script**: Add new packages to `./build.sh` if created
4. **Create Migration**: Use `npm run migrate:make` for schema changes
5. **Implement Domain Functions**: Add domain functions in the appropriate package (e.g., in `src/domain/` directory of the package that uses the data)
6. **Implement Logic**: Add business logic in appropriate package
7. **Build**: Run `./build.sh` from root
8. **Migrate**: Run `npm run migrate:latest`

## Environment Variables

**IMPORTANT**: Each database uses its own set of environment variables with the pattern `[DBNAME]_DB_*`.

Required PostgreSQL connection variables for the 'shaman' database:
- `SHAMAN_DB_HOST`
- `SHAMAN_DB_PORT`
- `SHAMAN_DB_NAME`
- `SHAMAN_DB_USER`
- `SHAMAN_DB_PASSWORD`

For additional databases, use the same pattern:
- `[DBNAME]_DB_HOST`
- `[DBNAME]_DB_PORT`
- `[DBNAME]_DB_NAME`
- `[DBNAME]_DB_USER`
- `[DBNAME]_DB_PASSWORD`

## Code Patterns

### Database Row Pattern (DbRow) - Domain Structure
```typescript
// ✅ Good - Modular domain structure with individual files

// In src/domain/agent-repository/types.ts - DbRow type mirrors exact database schema
export type AgentRepositoryDbRow = {
  id: number;
  name: string;
  git_url: string;  // snake_case matching DB column
  branch: string;
  is_root: boolean;
  last_sync_commit_hash: string | null;
  last_sync_at: Date | null;
  last_sync_status: string;
  last_sync_errors: unknown;  // JSONB fields typed as unknown
  created_at: Date;
  updated_at: Date;
};

// In src/domain/agent-repository/mappers/map-agent-repository-from-db.ts
export function mapAgentRepositoryFromDb(row: AgentRepositoryDbRow): AgentRepository {
  return {
    id: row.id,
    name: row.name,
    gitUrl: row.git_url,  // snake_case to camelCase
    branch: row.branch,
    isRoot: row.is_root,
    lastSyncCommitHash: row.last_sync_commit_hash,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as AgentRepository['lastSyncStatus'],
    lastSyncErrors: row.last_sync_errors as Record<string, unknown> | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// In src/domain/agent-repository/get-agent-repository.ts
export async function getAgentRepository(
  db: Database, 
  id: number
): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE id = $(id)`,
    { id }
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

// In src/domain/agent-repository/index.ts - Clean exports
export { getAgentRepository } from './get-agent-repository.js';
export { mapAgentRepositoryFromDb } from './mappers/map-agent-repository-from-db.js';
export type { AgentRepositoryDbRow } from './types.js';
```

### Function Export Pattern
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
): Promise<Result<AgentExecutionResult, Error>> {
  // Implementation
}

// ❌ Bad - Class-based approach
export class AgentRunner { /* ... */ }
```

### Result Type Pattern
```typescript
import { createLogger } from '@codespin/shaman-logger';

export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// Usage
const logger = createLogger('AgentValidator');
const result = await validateAgent(agent);
if (!result.success) {
  logger.error("Validation failed:", result.error);
  return;
}
const validAgent = result.data; // Type-safe
```

### Import Pattern
```typescript
// ✅ Good - Always include .js extension
import { executeAgent } from "./agent-runner.js";
import { GitAgent } from "@codespin/shaman-types";

// ❌ Bad - Missing extension
import { executeAgent } from "./agent-runner";
```

## Key Documentation

- Agent development guide: `/agents/agent.md`
- Coding standards: `/node/CODING-STANDARDS.md`
- System documentation: `/docs/` directory
- Architecture overview: `/docs/03-system-architecture.md`
- API specification: `/docs/05-graphql-api-spec.md`

## Testing & Quality

- TypeScript strict mode enabled
- No dedicated test framework configured yet
- Follow functional testing patterns from CODING-STANDARDS.md
- Each package builds independently with `tsc`

### Important Build & Lint Workflow

**ALWAYS follow this sequence:**
1. Run `./lint-all.sh` first
2. Run `./build.sh`
3. **If build fails and you make changes**: You MUST run `./lint-all.sh` again before building
   - Your new changes haven't been linted yet
   - Build errors often require code changes that may introduce lint issues
   - Always: lint → build → (if changes) → lint → build

## Common Tasks

### Adding a New Package
1. Create directory in `/node/packages/`
2. Add package.json with `file:` dependencies
3. Add to `PACKAGES` array in `./build.sh` (respect dependency order)
4. Create `src/` directory and `tsconfig.json`
5. Run `./build.sh --install`

### Working with Agents
- Agents are Markdown files with YAML frontmatter
- Agent discovery through Git repositories
- See `/docs/02-use-cases-and-agent-model.md` for patterns

### Database Changes

**Database Structure**: The project follows a multi-database pattern:
```
/
├── knexfile.js             # Base configuration only (no default export)
├── scripts/
│   └── db-all.sh          # Script to run commands on all databases
└── database/
    └── [dbname]/          # One directory per database
        ├── knexfile.js    # Database-specific config
        ├── migrations/    # Migrations for this database
        └── seeds/        # Seeds for this database
```

1. Create migration: `npm run migrate:[dbname]:make your_migration_name`
2. Edit migration file in `/database/[dbname]/migrations/`
3. Run migration: `npm run migrate:[dbname]:latest`
4. Update types in `@codespin/shaman-types`
5. Update domain functions in the relevant package's `src/domain/` directory

## Git Agent Caching

The git-resolver implements intelligent caching:
- Repository-level: Checks if commit hash changed before processing
- File-level: Only re-processes agent files that have been modified
- Branch-aware: Different branches are treated as separate repositories

Key functions:
- `resolveAgents(repoUrl, branch)` - Syncs and caches agents from a git repo
- `getAgentRepositoryByUrlAndBranch()` - Queries repos by URL and branch
- Commit hashes stored in `agent_repository.last_sync_commit_hash`
- Per-file hashes in `git_agent.last_modified_commit_hash`

## A2A Provider

The shaman-a2a-provider module exposes Git agents via the A2A protocol:
- Express-based HTTP server with A2A endpoints
- Agent discovery, execution, and health check endpoints
- Configurable authentication and rate limiting
- Whitelist/blacklist support for agent exposure
- Can run standalone or integrate with main server

Key endpoints:
- `GET /a2a/v1/agents` - Discover available agents
- `POST /a2a/v1/agents/:name/execute` - Execute an agent
- `GET /a2a/v1/health` - Health check

## Agent Executor

The agent-executor package provides the core execution engine:
- Manages agent conversations with full message history
- Handles tool calls and agent-to-agent communication
- Integrates with LLM providers for AI responses
- Tracks execution state through persistence layer
- Supports context sharing between agents

## LLM Provider (Vercel AI SDK)

The llm-vercel package implements the LLM provider interface:
```typescript
const provider = createVercelLLMProvider({
  models: {
    'gpt-4': { provider: 'openai', modelId: 'gpt-4' },
    'claude-3': { provider: 'anthropic', modelId: 'claude-3-opus-20240229' }
  },
  defaultModel: 'gpt-4',
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY
  }
});
```

Features:
- Support for OpenAI and Anthropic models
- Streaming responses
- Token usage tracking
- Tool/function calling support

## Platform Tools

The tool-router provides built-in platform tools for workflow data management:
- `workflow_data_write` - Store data for agent collaboration
- `workflow_data_read` - Retrieve specific data by key
- `workflow_data_query` - Search data by patterns
- `workflow_data_list` - List all stored data with metadata

All workflow data is immutable and tracked by agent/step for full auditability.