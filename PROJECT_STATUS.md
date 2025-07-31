# Project Status - Shaman AI Agent Framework

This file is maintained for AI assistants to quickly understand the current state of the Shaman project when starting a new session.

## Quick Context
Shaman is a comprehensive backend framework for managing and coordinating AI agents through a federated ecosystem. It's built as a NodeJS/TypeScript monorepo without npm workspaces, using a custom build system.

**CRITICAL ARCHITECTURE**: Shaman uses a two-server deployment model where:
- **Public Server** (`--role public`): Handles external API requests, authentication
- **Internal Server** (`--role internal`): Executes agents in isolated environment
- All agent-to-agent communication uses HTTP/A2A protocol (NOT direct function calls)

## Current Implementation Status

### ✅ Completed Core Packages
1. **shaman-types** - Type definitions for entire system
2. **shaman-logger** - Centralized logging with context
3. **shaman-core** - Core utilities and base types
4. **shaman-config** - Configuration loading and validation
5. **shaman-llm-core** - LLM provider interface
6. **shaman-workflow-core** - Workflow engine abstraction
7. **shaman-db** - Database connection management only
8. **shaman-observability** - OpenTelemetry integration
9. **shaman-llm-vercel** - Vercel AI SDK implementation

### ✅ Completed Agent Infrastructure
10. **shaman-git-resolver** - Git-based agent discovery with caching
11. **shaman-external-registry** - External agent registry support
12. **shaman-agents** - Unified agent resolution
13. **shaman-a2a-provider** - A2A protocol server implementation
14. **shaman-a2a-client** - A2A protocol HTTP client for agent-to-agent calls
15. **shaman-tool-router** - Tool execution routing
16. **shaman-agent-executor** - Agent execution engine
17. **shaman-workflow-temporal** - Temporal workflow adapter

### ✅ Completed Server
18. **shaman-server** - GraphQL API server with:
    - Express middleware setup
    - Apollo Server configuration (commented out, needs integration)
    - GraphQL schema and resolvers
    - Health endpoints
    - Basic structure for subscriptions (not implemented)
    - **MISSING**: --role flag support for two-server model

### ⚠️ Partially Implemented
19. **shaman-security** - Has structure but needs:
    - JWT validation implementation (only stub exists)
    - RBAC policy enforcement
    - Rate limiting refinement
    - Internal JWT token generation for A2A calls
    
20. **shaman-workflow-bullmq** - Has adapter skeleton but needs:
    - Queue management
    - Job processing
    - Error handling

21. **shaman-worker** - Has bootstrap but needs:
    - Workflow processing logic
    - Agent execution integration
    - Queue consumers

22. **shaman-cli** - Has command structure but needs:
    - Command implementations
    - Server API integration

### ❌ Critical Implementation Gaps
1. **Server Role Support**: No --role flag parsing in server startup
2. **A2A Integration**: Agent-executor still uses direct function calls instead of A2A client
3. **JWT Infrastructure**: Only empty stub files exist for JWT functionality
4. **Server Integration**: A2A provider not integrated into main server

## Remaining Work Options

### shaman-security
**Current state**: Has basic structure but needs implementation
**Remaining tasks**:
- Implement JWT token validation
- Add RBAC middleware
- Complete rate limiting
- Add security context to GraphQL
**Dependencies**: Needed for authenticated API access

### shaman-workflow-bullmq
**Current state**: Has adapter skeleton
**Remaining tasks**:
- Set up BullMQ queues
- Implement workflow execution
- Add job monitoring
- Error handling and retries
**Dependencies**: Alternative to Temporal for workflow execution

### shaman-worker
**Current state**: Has bootstrap structure
**Remaining tasks**:
- Connect to workflow engine (BullMQ or Temporal)
- Implement agent execution jobs
- Add health monitoring
- Handle graceful shutdown
**Dependencies**: Requires workflow adapter (either Temporal or BullMQ)

### shaman-cli
**Current state**: Has command structure
**Remaining tasks**:
- Implement sync command
- Implement run command
- Add configuration management
- Add output formatting
**Dependencies**: Requires server API

### Server Enhancements
**Current state**: Basic server running, Apollo commented out
**Remaining tasks**:
- Enable Apollo Server integration
- Implement GraphQL subscriptions
- Add authentication middleware
- Integrate A2A gateway
**Dependencies**: May need security package for auth

## Current Blockers & Decisions Needed

1. **Apollo Server Integration**: Currently commented out in server. Need to uncomment and test once auth is ready.

2. **Database Migrations**: Need to verify all tables exist for new features (user, auth tokens, etc.)

3. **Environment Variables**: May need additional config for:
   - JWT secrets
   - Redis connection (for BullMQ)
   - Temporal connection details

## Important Implementation Notes

- All packages follow functional programming (no classes)
- Use Result<T, E> pattern for error handling
- Database queries use DbRow pattern with mappers
- All imports must use .js extension
- Follow the build order in build.sh when adding dependencies

## Session Start Checklist

When starting a new session:
1. Run `./build.sh` to ensure everything compiles
2. Check for any failing tests or lints
3. Ask the user what they'd like to work on from the remaining options
4. Reference CODING-STANDARDS.md for implementation patterns

## Recent Activity Log

- **Latest Changes (Current Session)**:
  - ✅ Created `@codespin/shaman-a2a-client` package with full implementation
  - ✅ Added JWT token generation and validation utilities
  - ✅ Updated build.sh to include new a2a-client package
  - ✅ Added jsonwebtoken dependencies to security, server, and a2a-client packages
  - ✅ Updated CLAUDE.md with two-server architecture documentation
  - ✅ Added A2A provider dependency to server package
  - ✅ Added A2A client dependency to agent-executor package

- **Major Architecture Change**: ✅ COMPLETED - Migrated from centralized shaman-persistence to decentralized database pattern
  - Created new `@codespin/shaman-db` package for database connection management only
  - Moved persistence functions to their respective packages:
    - `agent-repository.ts` and `git-agent.ts` → `shaman-git-resolver/src/persistence/`
    - `run.ts` and `step.ts` → `shaman-agent-executor/src/persistence/`
    - `workflow-data.ts` → `shaman-tool-router/src/persistence/`
  - All persistence functions now receive database connection as first parameter
  - Removed shaman-persistence package completely
  - Updated all imports and dependencies
  - Fixed pg-promise ESM import issues
  - Updated all documentation (README.md, CLAUDE.md, agent.md)
  - All packages build and lint successfully
- Fixed ESLint issues in shaman-server (all errors resolved)
- Converted promise.then() patterns to async/await where possible
- Created PROJECT_STATUS.md for session continuity