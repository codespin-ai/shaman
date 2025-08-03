# External Dependencies Documentation

This directory contains copies of documentation from external services that Shaman integrates with. These are maintained locally to ensure developers and AI assistants have quick access to the exact API specifications we're working with.

## Purpose

- **Development Reference**: Quick access to external service documentation
- **AI Assistant Context**: Ensures AI coding assistants have complete documentation available
- **Version Control**: Track the exact version of external APIs we're integrating with
- **Offline Access**: Documentation available even without access to external repositories

## External Services

### 1. Permiso - Role-Based Access Control (RBAC)

- **Type**: Docker service
- **Port**: 5001
- **Protocol**: GraphQL
- **Docker Image**: `ghcr.io/codespin-ai/permiso:latest`
- **Purpose**: Handles all authorization and role-based access control for Shaman

#### Documentation:
- **[README](./permiso-docs/README.md)** - Complete overview, setup, and usage
- **[GraphQL Schema](./permiso-docs/schema.graphql)** - Full API specification

#### Integration with Shaman:
- All authorization decisions delegated to Permiso
- Users authenticated by Shaman are mapped to Permiso users
- Agent execution permissions: `/agents/{name}`
- API permissions: `/api/runs/*`, `/api/repositories/*`
- Suggested roles: `admin`, `developer`, `viewer`

#### Environment Variables:
```bash
PERMISO_ENDPOINT=http://localhost:5001/graphql
PERMISO_API_KEY=your-secret-api-key
```

### 2. Foreman - Workflow Orchestration Engine

- **Type**: REST API service
- **Port**: 3000 (default)
- **Protocol**: REST/HTTP
- **NPM Package**: `@codespin/foreman-client`
- **Purpose**: Handles all workflow orchestration, task management, and run data storage for Shaman

#### Documentation:
- **[README](./foreman-docs/README.md)** - Complete overview, setup, and usage
- **[API Reference](./foreman-docs/api-reference.md)** - REST API endpoints specification
- **[API Guide](./foreman-docs/api.md)** - Common workflows and examples
- **[Database Schema](./foreman-docs/database.md)** - Database design and architecture

#### Integration with Shaman:
- All workflow and task management delegated to Foreman
- Shaman creates runs and tasks via Foreman API
- Task execution results stored in Foreman's run data
- Queue-agnostic design (BullMQ, SQS, etc.)
- Multi-tenant support with organization isolation

#### Key Features:
- Multi-tenant runs and task management
- Key-value storage with tags for inter-task communication
- PostgreSQL as source of truth (queues only store IDs)
- Status tracking and execution history
- Support for hierarchical tasks

#### Environment Variables:
```bash
FOREMAN_ENDPOINT=http://localhost:3000
FOREMAN_API_KEY=fmn_prod_your_api_key_here  # Format: fmn_[env]_[orgId]_[random]
SHAMAN_TASK_QUEUE=shaman:tasks              # Optional: Override default queue name
SHAMAN_RESULT_QUEUE=shaman:results          # Optional: Override default queue name
```

#### Client Usage:
The `@codespin/foreman-client` package provides:
- Initialize once with `initializeForemanClient()`
- All functions return Result types for explicit error handling
- Queue names can be overridden for multi-tenant deployments
- Client handles all Redis/BullMQ operations internally

### 3. [Other Services] (to be added as needed)

## Integration Guidelines

When integrating with external services:

1. Always use environment variables for connection details
2. Implement proper error handling for service unavailability
3. Use health checks before attempting connections
4. Log all external service interactions for debugging
5. Implement circuit breakers for resilience

## Updating Documentation

When external service APIs change:

1. Copy the latest documentation from the external repository
2. Update the integration code to match the new API
3. Test the integration thoroughly
4. Note the version/date of the documentation update