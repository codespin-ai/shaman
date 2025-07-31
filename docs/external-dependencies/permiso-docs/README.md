# Permiso

A comprehensive Role-Based Access Control (RBAC) system with GraphQL API, built with TypeScript.

## Overview

Permiso is an external RBAC service that Shaman integrates with for fine-grained authorization. It provides multi-tenant organizations, users, roles, and resource-based permissions.

## Features

- 🏢 **Multi-tenant Organizations** - Isolated authorization contexts
- 👥 **Users & Roles** - Flexible user management with role assignments
- 🔐 **Fine-grained Permissions** - Resource-based access control with path-like IDs
- 🏷️ **Properties & Filtering** - Custom metadata with query capabilities
- 🚀 **GraphQL API** - Modern, type-safe API with full CRUD operations
- 📊 **Effective Permissions** - Combined user and role permission calculation

## Endpoint

```
POST http://localhost:5001/graphql
```

## Authentication

Permiso supports optional API key authentication. When enabled, all requests must include a valid API key in the `x-api-key` header.

```bash
# Using curl
curl -X POST http://localhost:5001/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key" \
  -d '{"query": "{ organizations { id name } }"}'

# Using Apollo Client
const client = new ApolloClient({
  uri: 'http://localhost:5001/graphql',
  headers: {
    'x-api-key': 'your-secret-api-key'
  }
});
```

## Core Concepts

### Organizations

Root entities that provide isolated authorization contexts. All other entities belong to an organization.

### Users

Represent individuals or service accounts who need access to resources. 

**User Types:**
- **HUMAN**: Regular users with Kratos identities who can login via UI
- **SERVICE_ACCOUNT**: API-only users without Kratos identities, authenticated via API keys

Users can:
- Belong to one organization
- Have multiple roles assigned (including EXTERNAL_API_CLIENT for service accounts)
- Have direct permissions on resources
- Have custom properties for filtering
- Own multiple API keys (with different permissions/expiry)

### Roles

Collections of permissions that can be assigned to users. Common roles include:
- **ADMIN**: Full access to organization management
- **USER**: Standard user access
- **EXTERNAL_API_CLIENT**: Service accounts with API-only access to specific exposed agents

### Resources

Entities identified by IDs in path-like format that permissions apply to:

- `/documents/contracts/2023/acme.pdf`
- `/features/billing`
- `/api/users/*`

### Permissions

Define what actions can be performed on resources:

- User permissions: Direct user → resource mappings
- Role permissions: Role → resource mappings
- Effective permissions: Combined view of user's direct + role permissions

### Properties

Key-value metadata stored as JSONB that can be attached to organizations, users, and roles:

- **Flexible JSON storage** - Store strings, numbers, booleans, objects, arrays, or null
- **Hidden properties** - Mark sensitive data as hidden
- **Filterable queries** - Query by property names and values
- **Type-safe** - PostgreSQL JSONB validation and operations

## Usage Example

### Checking User Permissions

```graphql
query GetUserPermissions {
  user(orgId: "acme-corp", userId: "john-doe") {
    id
    properties {
      name
      value
      hidden
    }
    roles {
      id
      properties {
        name
        value
      }
      permissions {
        resourceId
        action
      }
    }
    effectivePermissions(resourceId: "/documents/*") {
      resourceId
      action
      source
    }
  }
}
```

### Creating Organizations with Properties

```graphql
mutation {
  createOrganization(
    input: {
      id: "acme-corp"
      name: "ACME Corporation"
      description: "Global leader in innovation"
      properties: [
        {
          name: "tier"
          value: "enterprise"
        }
        {
          name: "settings"
          value: {
            maxUsers: 5000
            features: ["sso", "audit", "api"]
          }
        }
      ]
    }
  ) {
    id
    name
    properties {
      name
      value
    }
  }
}
```

### Setting User Properties

```graphql
mutation {
  setUserProperty(
    orgId: "acme-corp"
    userId: "john-doe"
    name: "profile"
    value: {
      department: "engineering"
      level: 3
      skills: ["typescript", "graphql", "postgres"]
      manager: "jane-smith"
    }
  ) {
    name
    value
  }
}
```

### Checking Permissions

```graphql
query {
  hasPermission(
    orgId: "acme-corp"
    userId: "john-doe"
    resourceId: "/documents/report.pdf"
    action: "write"
  )
}
```

## Environment Variables

When deploying Permiso, use these environment variables:

| Variable              | Description                     | Default     |
| --------------------- | ------------------------------- | ----------- |
| `PERMISO_DB_HOST`     | PostgreSQL host                 | `localhost` |
| `PERMISO_DB_PORT`     | PostgreSQL port                 | `5432`      |
| `PERMISO_DB_NAME`     | Database name                   | `permiso`   |
| `PERMISO_DB_USER`     | Database user                   | `postgres`  |
| `PERMISO_DB_PASSWORD` | Database password               | `postgres`  |
| `PERMISO_API_KEY`     | API key for authentication      | (none)      |
| `PERMISO_API_KEY_ENABLED` | Enable API key auth         | `false`     |
| `PERMISO_SERVER_PORT` | GraphQL server port             | `5001`      |
| `LOG_LEVEL`           | Logging level                   | `info`      |

## Docker Deployment

### Using Pre-built Images

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/codespin-ai/permiso:latest

# Run with automatic database setup
docker run -p 5001:5001 \
  -e PERMISO_DB_HOST=your-db-host \
  -e PERMISO_DB_PORT=5432 \
  -e PERMISO_DB_NAME=permiso \
  -e PERMISO_DB_USER=postgres \
  -e PERMISO_DB_PASSWORD=your-password \
  -e PERMISO_AUTO_MIGRATE=true \
  ghcr.io/codespin-ai/permiso:latest
```

### Quick Start with Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: permiso
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  permiso:
    image: ghcr.io/codespin-ai/permiso:latest
    ports:
      - "5001:5001"
    environment:
      PERMISO_DB_HOST: postgres
      PERMISO_DB_PORT: 5432
      PERMISO_DB_NAME: permiso
      PERMISO_DB_USER: postgres
      PERMISO_DB_PASSWORD: postgres
      PERMISO_AUTO_MIGRATE: true
    depends_on:
      - postgres
```

For detailed API documentation, see [api-spec.md](./api-spec.md).