# Shaman Package Overview

Generated: 2025-08-02

## Package Status Table

| Package | Version | Purpose | Status | In Use | Dependencies | Notes |
|---------|---------|---------|---------|---------|--------------|-------|
| **@codespin/shaman-types** | 1.0.0 | Core domain type definitions for entire system | ✅ Complete | ✅ Yes | None | Foundation package, all other packages depend on this |
| **@codespin/shaman-logger** | 0.1.0 | Centralized logging with context support | ✅ Complete | ✅ Yes | None | Used throughout the system |
| **@codespin/shaman-core** | 0.0.1 | Core utilities (Result type, error handling) | ✅ Complete | ✅ Yes | shaman-types | Provides fundamental patterns |
| **@codespin/shaman-config** | 0.0.1 | Configuration loading and validation | ✅ Complete | ✅ Yes | shaman-core, shaman-logger | Loads from env and files |
| **@codespin/shaman-llm-core** | 0.0.1 | LLM provider interface abstraction | ✅ Complete | ✅ Yes | shaman-types, shaman-core | Defines LLM contracts |
| **@codespin/shaman-db** | 0.1.0 | Database connection with RLS support | ✅ Complete | ✅ Yes | shaman-logger, pg-promise | Two connection types: RLS and unrestricted |
| **@codespin/shaman-observability** | 0.0.1 | OpenTelemetry metrics and tracing | ✅ Complete | ⚠️ Partial | shaman-logger | Infrastructure ready, not fully integrated |
| **@codespin/shaman-security** | 0.0.1 | Auth/RBAC structure | ⚠️ Partial | ❌ No | shaman-types, shaman-core | JWT placeholder, needs real implementation |
| **@codespin/shaman-external-registry** | 0.0.1 | External agent registry support | ✅ Complete | ❌ No | shaman-types, shaman-core | Ready but no external registries configured |
| **@codespin/shaman-git-resolver** | 1.0.0 | Git-based agent discovery with caching | ✅ Complete | ✅ Yes | shaman-types, shaman-db | Caches by commit hash |
| **@codespin/shaman-agents** | 0.0.1 | Unified agent resolution from all sources | ✅ Complete | ✅ Yes | git-resolver, external-registry | Central agent discovery |
| **@codespin/shaman-a2a-protocol** | 0.0.1 | Pure A2A protocol types from spec | ✅ Complete | ✅ Yes | None | Canonical protocol types |
| **@codespin/shaman-jsonrpc** | 0.0.1 | JSON-RPC 2.0 implementation | ✅ Complete | ✅ Yes | None | Full JSON-RPC with error handling |
| **@codespin/shaman-a2a-transport** | 0.0.1 | Transport layer abstractions | ✅ Complete | ✅ Yes | jsonrpc, a2a-protocol | JSON-RPC, REST, SSE support |
| **@codespin/shaman-a2a-client** | 0.1.0 | A2A protocol HTTP client | ✅ Complete | ✅ Yes | a2a-protocol, jsonrpc | Includes retry, SSE streaming |
| **@codespin/shaman-llm-vercel** | 0.0.1 | Vercel AI SDK LLM implementation | ✅ Complete | ✅ Yes | llm-core, @ai-sdk/* | Supports OpenAI, Anthropic |
| **@codespin/shaman-tool-router** | 0.0.1 | Tool execution routing | ✅ Complete | ✅ Yes | shaman-types, shaman-core | Platform tools + MCP support |
| **@codespin/shaman-agent-executor** | 0.0.1 | Core agent execution engine | ✅ Complete | ✅ Yes | Many | Handles conversations, tools |
| **@codespin/shaman-workflow** | 0.0.1 | BullMQ workflow engine | ✅ Complete | ⚠️ Partial | bullmq, shaman-types | Engine ready, not fully integrated |
| **@codespin/shaman-a2a-server** | 0.0.1 | A2A protocol server | ✅ Complete | ✅ Yes | a2a-transport, workflow | Supports internal/external roles |
| **@codespin/shaman-gql-server** | 0.0.1 | GraphQL management API | ✅ Complete | ✅ Yes | apollo, graphql, shaman-db | Control plane API |
| **@codespin/shaman-worker** | 0.0.1 | Background job processor | ⚠️ Partial | ❌ No | workflow, agent-executor | Bootstrap only, needs implementation |
| **@codespin/shaman-cli** | 0.0.1 | Command-line interface | ⚠️ Partial | ❌ No | commander, shaman-types | Structure only, no implementations |
| **@codespin/shaman-integration-tests** | 0.0.1 | Integration test suite | ✅ Complete | ❌ No | jest, various | Test infrastructure ready |

## Package Categories

### 🏗️ Core Infrastructure (Stable)
- **shaman-types**: Domain models
- **shaman-logger**: Logging
- **shaman-core**: Utilities
- **shaman-config**: Configuration
- **shaman-db**: Database

### 🤖 Agent System (Complete)
- **shaman-git-resolver**: Git agent discovery
- **shaman-external-registry**: External agents
- **shaman-agents**: Unified resolution
- **shaman-agent-executor**: Execution engine

### 🌐 A2A Protocol (Complete)
- **shaman-a2a-protocol**: Protocol types
- **shaman-jsonrpc**: JSON-RPC base
- **shaman-a2a-transport**: Transports
- **shaman-a2a-client**: Client SDK
- **shaman-a2a-server**: Server implementation

### 🧠 LLM Integration (Complete)
- **shaman-llm-core**: Abstraction
- **shaman-llm-vercel**: Vercel AI SDK

### 🔧 Execution (Mixed)
- **shaman-tool-router**: ✅ Tool routing
- **shaman-workflow**: ✅ Workflow engine
- **shaman-worker**: ⚠️ Needs implementation

### 🖥️ API Layer (Complete)
- **shaman-gql-server**: GraphQL API
- **shaman-a2a-server**: A2A API

### 🛠️ Tools (Incomplete)
- **shaman-cli**: ⚠️ Structure only
- **shaman-integration-tests**: ✅ Ready

## Implementation Status Legend

- ✅ **Complete**: Fully implemented and functional
- ⚠️ **Partial**: Basic structure exists but missing key functionality
- ❌ **Not Started**: Package doesn't exist or is empty

## Usage Status Legend

- ✅ **Yes**: Actively used by other packages or runtime
- ⚠️ **Partial**: Used in limited capacity
- ❌ **No**: Not yet integrated or used

## Key Observations

1. **Core Infrastructure**: All foundational packages are complete and in use
2. **A2A Protocol**: Fully implemented with all 5 packages complete
3. **Agent System**: Complete and functional
4. **Missing Pieces**: 
   - Worker implementation (job processing)
   - Security implementation (proper JWT)
   - CLI tool implementations
   - Observability integration

## Package Relationships

```
shaman-types
    ├── shaman-core
    ├── shaman-logger
    ├── shaman-db
    ├── shaman-config
    └── [used by most packages]

shaman-a2a-protocol
    ├── shaman-jsonrpc
    ├── shaman-a2a-transport
    ├── shaman-a2a-client
    └── shaman-a2a-server

shaman-agent-executor
    ├── shaman-llm-core/vercel
    ├── shaman-tool-router
    ├── shaman-agents
    └── shaman-a2a-client

shaman-workflow
    ├── shaman-worker (incomplete)
    └── shaman-a2a-server
```

## Next Priority Packages

1. **shaman-worker**: Critical for async job processing
2. **shaman-security**: Need proper JWT implementation
3. **shaman-cli**: User interface for management
4. **shaman-observability**: Integrate metrics/tracing