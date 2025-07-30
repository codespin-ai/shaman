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

### 2. [Other Services] (to be added as needed)

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