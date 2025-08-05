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
- 📦 **TypeScript Client** - Official client library with type-safe functions, no GraphQL knowledge required
- 📊 **Effective Permissions** - Combined user and role permission calculation
- 🐳 **Docker Ready** - Official Docker images for easy deployment

## Quick Start

### Option 1: Docker (Recommended)

The fastest way to get started is using our official Docker image:

```bash
# Pull and run with auto-migration
docker run -p 5001:5001 \
  -e PERMISO_DB_HOST=host.docker.internal \
  -e PERMISO_DB_USER=postgres \
  -e PERMISO_DB_PASSWORD=postgres \
  -e PERMISO_DB_NAME=permiso \
  -e PERMISO_AUTO_MIGRATE=true \
  ghcr.io/codespin-ai/permiso:latest
```

### Option 2: TypeScript Client (Recommended for Applications)

For TypeScript/JavaScript applications, use our official client library:

```bash
npm install @codespin/permiso-client
```

```typescript
import { createOrganization, createUser, hasPermission } from '@codespin/permiso-client';

const config = {
  endpoint: 'http://localhost:5001',
  apiKey: 'your-api-key' // optional
};

// Create an organization
const org = await createOrganization(config, {
  id: 'acme-corp',
  name: 'ACME Corporation'
});

// Check permissions
const canRead = await hasPermission(config, {
  orgId: 'acme-corp',
  userId: 'john-doe',
  resourceId: '/api/users/*',
  action: 'read'
});
```

## GraphQL Endpoint

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

## TypeScript Client API

### Core Features
- 🔒 **Type-safe** - Full TypeScript support with comprehensive type definitions
- 🚀 **Zero GraphQL knowledge required** - Simple function calls instead of query strings
- ⚡ **Lightweight** - Minimal dependencies, tree-shakeable
- 🛡️ **Result types** - Explicit error handling with discriminated unions
- 🔄 **Consistent API** - Uniform patterns across all operations
- 📦 **Pagination support** - Built-in pagination for list operations
- 🔍 **Property filtering** - Filter entities by custom properties

### API Categories

#### Organizations (9 functions)
- `getOrganization()`, `listOrganizations()`, `createOrganization()`
- `updateOrganization()`, `deleteOrganization()`
- `getOrganizationProperty()`, `setOrganizationProperty()`, `deleteOrganizationProperty()`

#### Users (15 functions)
- `getUser()`, `listUsers()`, `createUser()`, `updateUser()`, `deleteUser()`
- `getUsersByIdentity()` - Find users by identity provider
- `assignUserRole()`, `unassignUserRole()`
- Property management: `getUserProperty()`, `setUserProperty()`, `deleteUserProperty()`

#### Roles (10 functions)
- `getRole()`, `listRoles()`, `createRole()`, `updateRole()`, `deleteRole()`
- Property management: `getRoleProperty()`, `setRoleProperty()`, `deleteRoleProperty()`

#### Resources (7 functions)
- `getResource()`, `listResources()`, `createResource()`, `updateResource()`, `deleteResource()`
- `getResourcesByIdPrefix()` - Wildcard resource matching

#### Permissions (9 functions)
- `hasPermission()` - Check single permission
- `getUserPermissions()`, `getRolePermissions()`, `getEffectivePermissions()`
- `grantUserPermission()`, `revokeUserPermission()`
- `grantRolePermission()`, `revokeRolePermission()`

### Usage Example with TypeScript Client

```typescript
import { 
  createOrganization,
  createUser,
  assignUserRole,
  hasPermission,
  setUserProperty
} from '@codespin/permiso-client';

const config = {
  endpoint: 'http://localhost:5001',
  apiKey: 'your-secret-api-key'
};

// Create organization
const orgResult = await createOrganization(config, {
  id: 'acme-corp',
  name: 'ACME Corporation',
  description: 'A sample organization'
});

if (orgResult.success) {
  console.log('Created organization:', orgResult.data);
}

// Create user with properties
const userResult = await createUser(config, {
  id: 'john-doe',
  orgId: 'acme-corp',
  identityProvider: 'auth0',
  identityProviderUserId: 'auth0|123456',
  userType: 'HUMAN'
});

// Set user properties (JSON support)
await setUserProperty(config, 'acme-corp', 'john-doe', 'preferences', {
  theme: 'dark',
  language: 'en',
  notifications: true
});

// Check permissions
const permResult = await hasPermission(config, {
  orgId: 'acme-corp',
  userId: 'john-doe',
  resourceId: '/api/users/*',
  action: 'read'
});

if (permResult.success) {
  console.log('Has permission:', permResult.data);
}
```

### GraphQL API Example (Alternative)

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

## Resource Path Patterns

Permiso uses Unix-like path patterns for resources with wildcard support:

```typescript
// Exact match
const resource1 = await createResource(config, {
  id: '/api/users',
  orgId: 'acme-corp',
  description: 'User management API'
});

// Wildcard match (matches any sub-path)
const resource2 = await createResource(config, {
  id: '/api/users/*',
  orgId: 'acme-corp',
  description: 'All user endpoints'
});

// Hierarchical resources
const resource3 = await createResource(config, {
  id: '/api/billing/invoices/*',
  orgId: 'acme-corp',
  description: 'Invoice management'
});
```

## Advanced Features

### Property System
Permiso supports flexible JSON properties on organizations, users, and roles:

```typescript
// Set complex property
await setUserProperty(config, 'acme-corp', 'john-doe', 'profile', {
  department: 'engineering',
  level: 3,
  skills: ['typescript', 'graphql', 'postgres'],
  manager: 'jane-smith'
});

// Set hidden property (sensitive data)
await setUserProperty(
  config,
  'acme-corp',
  'john-doe',
  'apiToken',
  'secret-token-123',
  true  // hidden = true
);

// Filter by properties
const engineersResult = await listUsers(config, 'acme-corp', {
  filter: {
    properties: [
      { name: 'profile.department', value: 'engineering' }
    ]
  }
});
```

### Batch Operations

```typescript
// Create multiple users efficiently
const users = [
  { id: 'user-1', orgId: 'org-1', identityProvider: 'auth0', identityProviderUserId: 'auth0|123' },
  { id: 'user-2', orgId: 'org-1', identityProvider: 'auth0', identityProviderUserId: 'auth0|456' },
  { id: 'user-3', orgId: 'org-1', identityProvider: 'auth0', identityProviderUserId: 'auth0|789' }
];

const results = await Promise.all(
  users.map(user => createUser(config, user))
);

const failed = results.filter(r => !r.success);
if (failed.length > 0) {
  console.error('Some users failed to create:', failed);
}
```

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

## Integration with Shaman

Shaman integrates with Permiso for all authorization decisions:

```typescript
// Example: Check if user can execute specific agent
const canExecuteAgent = await hasPermission(permisoConfig, {
  orgId: organizationId,
  userId: userId,
  resourceId: `/agents/${agentName}`,
  action: 'execute'
});

if (!canExecuteAgent.success || !canExecuteAgent.data) {
  throw new UnauthorizedError('Cannot execute agent');
}
```

### Recommended Roles for Shaman
- **ADMIN**: Full access to organization management
- **DEVELOPER**: Can manage agents and view runs
- **VIEWER**: Read-only access to runs and agents
- **EXTERNAL_API_CLIENT**: Service accounts with API-only access to specific exposed agents

### Resource Patterns for Shaman
- `/agents/*` - All agent execution permissions
- `/agents/{name}` - Specific agent execution
- `/api/runs/*` - Workflow monitoring access
- `/api/repositories/*` - Agent repository management

## Testing Coverage

Permiso includes comprehensive testing:
- **Integration Tests**: All GraphQL operations tested against real server
- **Client Tests**: All TypeScript client functions tested (64+ tests)
- **Docker Testing**: Automated container testing with real database
- **Test Infrastructure**: Isolated test databases, automated cleanup

For detailed API documentation, see [api-spec.md](./api-spec.md).