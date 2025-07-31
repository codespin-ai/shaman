# Project Status - Shaman AI Agent Framework

This file is maintained for AI assistants to quickly understand the current state of the Shaman project when starting a new session.

## Quick Context
Shaman is a comprehensive backend framework for managing and coordinating AI agents through a federated ecosystem. It's built as a NodeJS/TypeScript monorepo without npm workspaces, using a custom build system.

**CRITICAL ARCHITECTURE CHANGE**: Shaman now splits into two distinct servers:
- **GraphQL Server** (`shaman-gql-server`): Pure management API - NO agent execution
- **A2A Server** (`shaman-a2a-server`): ALL agent execution, supports --role public/internal
- All agent-to-agent communication uses HTTP/A2A protocol (NOT direct function calls)
- Single workflow engine using BullMQ (removed abstraction layer)

## Current Implementation Status

### ✅ Completed Core Packages
1. **shaman-types** - Type definitions for entire system
2. **shaman-logger** - Centralized logging with context
3. **shaman-core** - Core utilities and base types
4. **shaman-config** - Configuration loading and validation
5. **shaman-llm-core** - LLM provider interface
6. **shaman-db** - Database connection management only
7. **shaman-observability** - OpenTelemetry integration
8. **shaman-llm-vercel** - Vercel AI SDK implementation
9. **shaman-workflow** - Workflow engine using BullMQ

### ✅ Completed Agent Infrastructure
10. **shaman-git-resolver** - Git-based agent discovery with caching
11. **shaman-external-registry** - External agent registry support
12. **shaman-agents** - Unified agent resolution
13. **shaman-a2a-client** - A2A protocol HTTP client for agent-to-agent calls
14. **shaman-tool-router** - Tool execution routing
15. **shaman-agent-executor** - Agent execution engine

### ✅ New Server Architecture
16. **shaman-gql-server** - GraphQL management API:
    - Pure management operations (no execution)
    - User authentication via Ory Kratos
    - Agent repository management
    - Workflow monitoring
    - Single schema.graphql file with codegen setup
    - Simplified role model: OWNER, ADMIN, USER
    - Minimal agent info (details stay in Git repos)
    
17. **shaman-a2a-server** - A2A execution server:
    - Handles ALL agent execution
    - Supports --role public and --role internal
    - Starts workflow jobs via BullMQ
    - JWT validation for internal calls

### ⚠️ Partially Implemented
18. **shaman-security** - Has structure but needs:
    - JWT validation implementation (only stub exists)
    - RBAC policy enforcement
    - Rate limiting refinement
    - Internal JWT token generation for A2A calls
    
19. **shaman-worker** - Has bootstrap but needs:
    - BullMQ job processing
    - A2A client integration
    - Proper job lifecycle management

20. **shaman-cli** - Has command structure but needs:
    - Command implementations
    - Support for both servers

### ❌ Implementation Gaps for New Architecture
1. **A2A Server Start Script**: Need to add --role flag parsing
2. **Workflow Integration**: A2A server needs to create BullMQ jobs
3. **Worker A2A Calls**: Worker needs to use A2A client for execution
4. **JWT Infrastructure**: Security package needs real JWT implementation
5. **GraphQL Queries**: Need to update to not include execution mutations

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

- **Latest Major Refactor (Current Session)**:
  - ✅ Split shaman-server into shaman-gql-server and shaman-a2a-server
  - ✅ Created shaman-workflow package (unified BullMQ implementation)
  - ✅ Renamed shaman-a2a-provider to shaman-a2a-server
  - ✅ Removed workflow-core, workflow-temporal, workflow-bullmq packages
  - ✅ Updated all package dependencies for new architecture
  - ✅ Updated build.sh with new package structure
  - ✅ Completely revised documentation for new architecture
  
- **Previous Session**:
  - ✅ Created `@codespin/shaman-a2a-client` package with full implementation
  - ✅ Added JWT token generation and validation utilities
  - ✅ Added jsonwebtoken dependencies to security, server, and a2a-client packages

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