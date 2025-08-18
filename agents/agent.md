# Shaman Agent Development Guide

Welcome, Agent. This is your primary operational guide. Adherence to these instructions is mandatory. Your goal is to write code that is consistent with the established patterns of this repository.

## 1. Core Principles

1.  **Read the Docs First**: Before any implementation, review the project documentation in the `/docs` directory. It contains the high-level architecture and concepts.
2.  **Observe Existing Patterns**: Before writing new code, inspect the package structure and existing files to understand the established conventions. Do not introduce new patterns without explicit instruction.
3.  **Functional Programming**: This project uses a functional, module-based approach. **You must not use classes.** Export functions from modules.
4.  **Domain-Driven Structure**: Each package uses a `src/domain/` directory with one function per file and dedicated mapper directories for database conversions.

## 2. Environment Setup

- **Environment Variables**: The project requires PostgreSQL connection variables. Create a `.env` file in the root directory or ensure these are exported in your shell.

  **Database Connection (Required):**
  - `SHAMAN_DB_HOST` - PostgreSQL host
  - `SHAMAN_DB_PORT` - PostgreSQL port (default: 5432)
  - `SHAMAN_DB_NAME` - Database name
  - `RLS_DB_USER` and `RLS_DB_USER_PASSWORD` - For application queries (with Row Level Security)
  - `UNRESTRICTED_DB_USER` and `UNRESTRICTED_DB_USER_PASSWORD` - For migrations and admin tasks

  **External Services (Required):**
  - `FOREMAN_ENDPOINT` - Foreman workflow engine URL (default: http://localhost:3000)
  - `FOREMAN_API_KEY` - Foreman API key (format: fmn*[env]*[orgId]\_[random])

  **LLM Providers (At least one required):**
  - `OPENAI_API_KEY` - For OpenAI models
  - `ANTHROPIC_API_KEY` - For Anthropic models

  **Security (Required):**
  - `INTERNAL_JWT_SECRET` - For internal service-to-service authentication
  - `ENCRYPTION_KEY` - For data encryption

## 3. Project Architecture & Conventions

### Monorepo Structure

The codebase is a NodeJS/TypeScript monorepo located under `/node/packages`. Each package has a single responsibility.

**Core Infrastructure:**

- **`@codespin/shaman-types`**: Shared TypeScript interfaces. **Always start here.**
- **`@codespin/shaman-db`**: Database connections with Row Level Security.
- **`@codespin/shaman-logger`**: Centralized logging.
- **`@codespin/shaman-config`**: Configuration management.
- **`@codespin/shaman-security`**: JWT tokens and API key validation.

**Agent System:**

- **`@codespin/shaman-agents`**: Unified agent resolution from all sources.
- **`@codespin/shaman-git-resolver`**: Git-based agent discovery with caching.
- **`@codespin/shaman-external-registry`**: External agent registry.
- **`@codespin/shaman-agent-executor`**: Core agent execution engine.

**Communication:**

- **`@codespin/shaman-a2a-server`**: A2A protocol server (public/internal modes).
- **`@codespin/shaman-a2a-client`**: HTTP client for agent-to-agent calls.
- **`@codespin/shaman-gql-server`**: GraphQL management API (no execution).

**Execution:**

- **`@codespin/shaman-worker`**: Processes tasks from Foreman queues.
- **`@codespin/shaman-tool-router`**: Routes tool calls to handlers.
- **`@codespin/shaman-llm-vercel`**: Vercel AI SDK provider (OpenAI/Anthropic).
- **`@codespin/foreman-client`**: Integration with external Foreman service.

### Dependency Management

- This project **deliberately avoids npm workspaces** (and other workspace implementations) in favor of a custom build system.
- Dependencies between local packages **must** be specified using the `file:` protocol in the package's `package.json`.
  - Example: `"@codespin/shaman-types": "file:../shaman-types"`

### Build System

- The project uses a **custom build system** via the **`./build.sh`** script in the root directory instead of npm workspaces.
- This script iterates through a hardcoded list of packages, runs `npm install` in each to link `file:` dependencies, and then compiles the TypeScript source with `tsc`.
- **If you add a new package, you MUST update `./build.sh` to include it in the build sequence.**

### Database and Persistence

- **Database**: PostgreSQL with Row Level Security for multi-tenancy.
- **Migrations**: Managed by **Knex.js**.
  - Migration files are located in `/database/shaman/migrations`.
  - Use `npm run migrate:shaman:make migration_name` to create.
  - Use `npm run migrate:shaman:latest` to apply.
- **Data Access**: Handled by **`pg-promise`**.
  - **Do not use an ORM**.
  - Each package uses a `src/domain/` directory with modular structure.
  - DbRow types mirror exact database schema with snake_case.
  - Mapper functions handle snake_case to camelCase conversion.

### Naming and Coding Conventions

1.  **TypeScript (`.ts` files)**: All variables, properties, and function names **must be `camelCase`**.
2.  **Database (SQL files)**: All table and column names **must be `snake_case`**.
3.  **Table Names**: All database table names **must be singular** (e.g., `agent_repository`, not `agent_repositories`).
4.  **File Paths**: Module imports/exports **must include the `.js` file extension** (e.g., `from './db.js'`).
5.  **Domain Structure**:
    - One function per file in `src/domain/[entity]/`
    - DbRow types in `src/domain/[entity]/types.ts`
    - Mappers in `src/domain/[entity]/mappers/`
    - Clean exports in `src/domain/[entity]/index.ts`
6.  **Type Safety**: Use `db.one<XxxDbRow>()` with explicit type parameters.
7.  **Result Types**: Use Result<T, E> for error handling instead of exceptions.

## 4. Standard Development Workflow

Follow these steps **in order**:

1.  **Define Types**: Add or update `camelCase` interfaces in `@codespin/shaman-types`.
2.  **Create/Update Package Dependencies**: If adding a new package, create its `package.json` and update the `package.json` of any package that depends on it using a `file:` reference.
3.  **Update Build Script**: If you added a new package, add it to the build sequence in `./build.sh` (respect dependency order).
4.  **Create Migration**: Use `npm run migrate:shaman:make migration_name` to create a new migration file. Define the `snake_case`, singular-named tables and columns here.
5.  **Implement Domain Functions**: In the appropriate package:
    - Create `src/domain/[entity]/types.ts` with DbRow types
    - Create mapper functions in `src/domain/[entity]/mappers/`
    - Create one file per domain function
    - All functions must receive a `Database` connection as their first parameter
6.  **Implement Business Logic**: Import domain functions to implement the core feature logic.
7.  **Lint**: Run `./lint-all.sh` to check for issues.
8.  **Build**: Run `./build.sh` from the root directory to compile everything.
9.  **Run Migration**: Run `npm run migrate:shaman:latest` to apply your schema changes.
10. **Test**: Start services and verify functionality:
    ```bash
    docker-compose up -d  # Start PostgreSQL, Redis, Foreman
    npm run dev:gql-server  # Terminal 1: GraphQL server
    npm run dev:a2a-server -- --role public  # Terminal 2: A2A server
    npm run dev:worker  # Terminal 3: Worker
    ```

## 5. Key Architectural Decisions

1.  **Two-Server Architecture**: GraphQL for management, A2A for execution.
2.  **Workflow Orchestration**: ALL workflow management delegated to external Foreman service.
3.  **Worker Execution**: Worker directly executes agents (no circular A2A dependencies).
4.  **Platform Tools**: Store data in Foreman via run_data operations.
5.  **Agent Discovery**: Git repositories with caching by commit hash.
6.  **Multi-Tenancy**: Row Level Security in PostgreSQL.
7.  **LLM Integration**: Vercel AI SDK v5 with OpenAI and Anthropic support.

## 6. Common Commands

```bash
# Build
./build.sh              # Standard build
./build.sh --install    # Force npm install
./build.sh --migrate    # Build + run migrations
./build.sh --seed       # Build + run seeds

# Linting
./lint-all.sh           # Run ESLint on all packages

# Database
npm run migrate:shaman:make migration_name  # Create migration
npm run migrate:shaman:latest              # Run migrations
npm run migrate:shaman:rollback            # Rollback
npm run migrate:shaman:status              # Check status

# Development
npm run dev:gql-server    # Start GraphQL server
npm run dev:a2a-server    # Start A2A server
npm run dev:worker        # Start worker
```
