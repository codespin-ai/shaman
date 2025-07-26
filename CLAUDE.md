# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Shaman is a comprehensive backend framework for managing and coordinating AI agents through a federated ecosystem. It's a NodeJS/TypeScript monorepo that deliberately avoids npm workspaces in favor of a custom build system.

## Recent Important Changes

- **Git Operations**: Now uses native git commands instead of isomorphic-git
- **Agent Caching**: Git agents are cached by commit hash for performance
- **Branch Support**: All git operations support branch parameters
- **Unified Agent Resolution**: New `shaman-agents` package provides single interface for all agent sources

## Essential Commands

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
```

### Database Commands
```bash
# Run migrations
npm run migrate:latest

# Create new migration
npm run migrate:make migration_name

# Create seed file
npm run seed:make seed_name

# Run seeds
npm run seed:run
```

### Development Commands
```bash
# Start server and UI
npm start

# TypeScript compilation for individual packages
cd node/packages/[package-name] && npm run build
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
- The persistence layer (`shaman-persistence`) handles camelCase ↔ snake_case mapping

### 4. ESM Modules
- All imports MUST include `.js` extension: `import { foo } from './bar.js'`
- TypeScript configured for `"module": "NodeNext"`
- Type: `"module"` in all package.json files

## Package Structure

Located in `/node/packages/`, build order matters:

1. **@codespin/shaman-types** - Shared TypeScript interfaces (start here for new features)
2. **@codespin/shaman-core** - Core types and utilities
3. **@codespin/shaman-config** - Configuration management
4. **@codespin/shaman-llm-core** - LLM provider abstraction
5. **@codespin/shaman-workflow-core** - Workflow engine abstraction
6. **@codespin/shaman-persistence** - Database access layer
7. **@codespin/shaman-observability** - Metrics and tracing
8. **@codespin/shaman-security** - Auth, RBAC, rate limiting
9. **@codespin/shaman-external-registry** - External agent registry
10. **@codespin/shaman-git-resolver** - Git-based agent discovery (with caching)
11. **@codespin/shaman-agents** - Unified agent resolution from all sources
12. **@codespin/shaman-llm-vercel** - Vercel AI SDK provider
13. **@codespin/shaman-tool-router** - Tool execution routing
14. **@codespin/shaman-workflow-bullmq** - BullMQ workflow adapter
15. **@codespin/shaman-workflow-temporal** - Temporal workflow adapter
16. **@codespin/shaman-server** - Main GraphQL server
17. **@codespin/shaman-worker** - Background worker
18. **@codespin/shaman-cli** - CLI tool

## Development Workflow

1. **Define Types**: Add/update interfaces in `@codespin/shaman-types`
2. **Update Dependencies**: Add `file:` references to package.json files
3. **Update Build Script**: Add new packages to `./build.sh` if created
4. **Create Migration**: Use `npm run migrate:make` for schema changes
5. **Implement Persistence**: Add functions in `@codespin/shaman-persistence`
6. **Implement Logic**: Add business logic in appropriate package
7. **Build**: Run `./build.sh` from root
8. **Migrate**: Run `npm run migrate:latest`

## Environment Variables

Required PostgreSQL connection variables:
- `SHAMAN_DB_HOST`
- `SHAMAN_DB_PORT`
- `SHAMAN_DB_NAME`
- `SHAMAN_DB_USER`
- `SHAMAN_DB_PASSWORD`

## Code Patterns

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
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// Usage
const result = await validateAgent(agent);
if (!result.success) {
  console.error("Validation failed:", result.error);
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
1. Create migration: `npm run migrate:make your_migration_name`
2. Edit migration file in `/database/migrations/`
3. Run migration: `npm run migrate:latest`
4. Update types in `@codespin/shaman-types`
5. Update persistence layer in `@codespin/shaman-persistence`

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