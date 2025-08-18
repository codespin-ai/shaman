# Shaman - AI Agent Orchestration Framework

Shaman is a comprehensive backend framework for managing and coordinating AI agents through a federated ecosystem. It provides a complete infrastructure for discovering, executing, and orchestrating AI agents with enterprise-grade features.

## Key Features

- **Agent Discovery**: Automatic discovery of agents from Git repositories with caching
- **Multi-LLM Support**: Pluggable LLM providers (OpenAI, Anthropic via Vercel AI SDK)
- **Dual Server Architecture**: Separate GraphQL management API and A2A execution server
- **Workflow Orchestration**: Foreman-based task management for reliable execution
- **Tool Ecosystem**: Built-in platform tools and extensible tool router
- **Type-Safe**: Fully typed TypeScript codebase with no `any` types
- **Production Ready**: Built-in observability, security, and persistence layers

## Architecture

Shaman follows a dual-server architecture with clear separation between management and execution:

```
┌────────────────────────┐        ┌────────────────────────┐
│   GraphQL Server       │        │    A2A Server          │
│   (Management API)     │        │   (Agent Execution)    │
│                        │        │                        │
│ • Agent Management     │        │ • Agent Execution      │
│ • User/Tenant Mgmt     │        │ • Workflow Jobs        │
│ • Monitoring           │        │ • Tool Routing         │
│ • NO EXECUTION         │        │ • LLM Integration      │
└────────────────────────┘        └────────────────────────┘
         │                                    │
         └─────────────┬──────────────────────┘
                       │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│    (PostgreSQL + Redis + Security + Observability)         │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         └─────────────┬──────────────────────┘
                       │
┌─────────────────────────────────────────────────────────────┐
│                External Services (Active)                    │
│  • Foreman - Workflow Orchestration (@codespin/foreman-client)│
└─────────────────────────────────────────────────────────────┘
                       │
┌─────────────────────────────────────────────────────────────┐
│           External Services (Planned/Future)                 │
│  • Permiso - RBAC Authorization (not yet integrated)        │
│  • Ory Kratos - User Authentication (not yet integrated)    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (required by Foreman for queue management)
- Foreman service running (or use Docker Compose)

### Installation

```bash
# Clone the repository
git clone https://github.com/codespin-ai/shaman.git
cd shaman

# Build all packages (uses custom build system, not npm workspaces)
./build.sh --install  # Installs dependencies and builds

# Start development environment with Docker Compose
docker-compose up -d  # Starts PostgreSQL, Redis, and Foreman

# Set up database
npm run migrate:shaman:latest
npm run seed:shaman:run

# Start the servers
# Terminal 1: GraphQL Management API
cd node/packages/shaman-gql-server && npm start

# Terminal 2: A2A Execution Server (public mode)
cd node/packages/shaman-a2a-server && npm start -- --role public --port 5000

# Terminal 3: Worker (processes Foreman tasks)
cd node/packages/shaman-worker && npm start
```

### Environment Variables

Create a `.env` file with:

```env
# Database
SHAMAN_DB_HOST=localhost
SHAMAN_DB_PORT=5432
SHAMAN_DB_NAME=shaman

# Legacy database user (deprecated)
SHAMAN_DB_USER=postgres
SHAMAN_DB_PASSWORD=postgres

# RLS-enabled database user (for application)
RLS_DB_USER=rls_db_user
RLS_DB_USER_PASSWORD=secure_rls_password

# Unrestricted database user (for migrations, admin)
UNRESTRICTED_DB_USER=unrestricted_db_user
UNRESTRICTED_DB_USER_PASSWORD=secure_admin_password

# LLM Providers (optional)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Workflow Orchestration (Required)
FOREMAN_ENDPOINT=http://localhost:3000
FOREMAN_API_KEY=fmn_dev_shaman_abc123
SHAMAN_TASK_QUEUE=shaman:tasks  # Optional: Override default queue name
SHAMAN_RESULT_QUEUE=shaman:results  # Optional: Override default queue name

# Security
JWT_SECRET=your-jwt-secret-for-internal-auth

# A2A Server Configuration
INTERNAL_A2A_URL=http://localhost:5001  # Internal A2A server URL for worker

# Worker Configuration
WORKER_CONCURRENCY=5  # Number of concurrent tasks to process
```

## Project Structure

This is a TypeScript monorepo that deliberately avoids npm workspaces in favor of a custom build system:

- `/node/packages/` - All packages in dependency order
- `/agents/` - Example agent definitions
- `/docs/` - Architecture and API documentation
- `/database/` - Migrations and seeds
- `./build.sh` - Custom build script
- `./start.sh` - Application starter
- `CLAUDE.md` - AI assistant guidance

## Core Packages

### Agent Management

- `@codespin/shaman-agents` - Unified agent resolution
- `@codespin/shaman-agent-executor` - Agent execution engine
- `@codespin/shaman-git-resolver` - Git-based agent discovery
- `@codespin/shaman-a2a-client` - A2A protocol client
- `@codespin/shaman-a2a-server` - A2A protocol server

### LLM & Tools

- `@codespin/shaman-llm-core` - LLM provider interface
- `@codespin/shaman-llm-vercel` - Vercel AI SDK implementation
- `@codespin/shaman-tool-router` - Tool execution routing

### Workflow & Orchestration

- `@codespin/foreman-client` - Integration with Foreman workflow service (handles all task management)
- `@codespin/shaman-worker` - Processes tasks from Foreman queues

### Servers

- `@codespin/shaman-gql-server` - GraphQL management API
- `@codespin/shaman-a2a-server` - A2A execution server
- `@codespin/shaman-worker` - Job processing worker

### Infrastructure

- `@codespin/shaman-types` - Shared TypeScript types
- `@codespin/shaman-logger` - Centralized logging
- `@codespin/shaman-db` - Database connection management
- `@codespin/shaman-security` - JWT auth & API key validation (internal implementation)
- `@codespin/shaman-observability` - Metrics & tracing

## Creating Agents

Agents are defined as Markdown files with YAML frontmatter:

```markdown
---
name: example-agent
description: An example agent
model: gpt-4
temperature: 0.7
tools:
  - run_data_write
  - run_data_read
---

You are an example agent that helps users...

## Instructions

1. Always be helpful
2. Use tools when needed
3. Collaborate with other agents
```

## Development

### Building

```bash
# Full build
./build.sh

# Build with npm install
./build.sh --install

# Build and run migrations
./build.sh --migrate
```

### Database

```bash
# Create migration (specify database name)
npm run migrate:shaman:make your_migration_name

# Run migrations
npm run migrate:shaman:latest

# Rollback migrations
npm run migrate:shaman:rollback

# Check migration status
npm run migrate:shaman:status

# Create seed
npm run seed:shaman:make your_seed_name

# Run seeds
npm run seed:shaman:run
```

### Code Standards

- **NO CLASSES** - Use pure functions with explicit dependencies
- **Result Types** - Use `Result<T, E>` for error handling
- **Named SQL Parameters** - Always use named parameters in queries
- **ESM Modules** - All imports must include `.js` extension
- **Type Safety** - No `any` types allowed

See `node/CODING-STANDARDS.md` for complete guidelines.

## Documentation

- [Overview and Concepts](docs/01-overview-and-concepts.md)
- [Use Cases and Agent Model](docs/02-use-cases-and-agent-model.md)
- [System Architecture](docs/03-system-architecture.md)
- [API Configuration](docs/04-api-config-and-deployment.md)
- [GraphQL API Spec](docs/05-graphql-api-spec.md)
- [Tool Execution Guide](docs/06-tool-execution-guide.md)
- [Workflow Engine Adapters](docs/07-workflow-engine-adapters.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
