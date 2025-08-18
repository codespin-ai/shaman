# Permiso Integration with Shaman

This document describes how Shaman will integrate with Permiso for Role-Based Access Control (RBAC).

## Status

⚠️ **PLANNED BUT NOT YET INTEGRATED** - Permiso integration is documented but not yet implemented in Shaman.

## Overview

Shaman will use Permiso as an external service for all authorization needs:

- Multi-tenant organization management
- User and role management
- Fine-grained permission control
- Resource-based access control for agents and APIs

## Planned Configuration

### Environment Variables

```bash
# Required when integration is implemented
PERMISO_ENDPOINT=http://localhost:5001    # Permiso GraphQL endpoint
PERMISO_API_KEY=your-secret-api-key      # API key for authentication
```

### Client Initialization

```typescript
import { PermisoConfig } from "@codespin/permiso-client";

const permisoConfig: PermisoConfig = {
  endpoint: process.env.PERMISO_ENDPOINT || "http://localhost:5001",
  apiKey: process.env.PERMISO_API_KEY,
};
```

## Planned Usage Patterns

### Organization Setup

When a new organization signs up for Shaman:

```typescript
import {
  createOrganization,
  createRole,
  grantRolePermission,
} from "@codespin/permiso-client";

// Create organization
const orgResult = await createOrganization(permisoConfig, {
  id: "org-123",
  name: "ACME Corporation",
  properties: [
    { name: "plan", value: "enterprise" },
    { name: "maxAgents", value: 100 },
  ],
});

// Create default roles
const adminRole = await createRole(permisoConfig, {
  id: "admin",
  orgId: "org-123",
  name: "Administrator",
  description: "Full system access",
});

const agentUserRole = await createRole(permisoConfig, {
  id: "agent-user",
  orgId: "org-123",
  name: "Agent User",
  description: "Can execute agents",
});

// Grant permissions to roles
await grantRolePermission(permisoConfig, {
  orgId: "org-123",
  roleId: "admin",
  resourceId: "/*",
  action: "admin",
});

await grantRolePermission(permisoConfig, {
  orgId: "org-123",
  roleId: "agent-user",
  resourceId: "/agents/*",
  action: "execute",
});
```

### User Management

When users are created or authenticated:

```typescript
import { createUser, assignUserRole } from "@codespin/permiso-client";

// Create user from OAuth provider
const userResult = await createUser(permisoConfig, {
  id: "user-456",
  orgId: "org-123",
  identityProvider: "google",
  identityProviderUserId: "google-oauth-id-12345",
  properties: [
    { name: "email", value: "john@acme.com" },
    { name: "department", value: "engineering" },
  ],
  roleIds: ["agent-user"],
});

// Assign additional role later
await assignUserRole(permisoConfig, "org-123", "user-456", "admin");
```

### Resource Definitions

Shaman resources will follow a hierarchical pattern:

```typescript
// Agent resources
"/agents"; // List agents
"/agents/*"; // All agent operations
"/agents/{agentId}"; // Specific agent
"/agents/{agentId}/execute"; // Execute specific agent

// Repository resources
"/repositories"; // List repositories
"/repositories/*"; // All repository operations
"/repositories/{repoId}"; // Specific repository

// Workflow resources
"/workflows"; // List workflows
"/workflows/*"; // All workflow operations
"/workflows/{workflowId}"; // Specific workflow

// Admin resources
"/admin/users"; // User management
"/admin/roles"; // Role management
"/admin/settings"; // System settings
```

### Permission Checking

#### In GraphQL Resolvers

```typescript
import { hasPermission } from "@codespin/permiso-client";

// GraphQL resolver example
export const executeAgent = async (parent, args, context) => {
  const { orgId, userId } = context.auth;
  const { agentId } = args;

  // Check permission
  const canExecute = await hasPermission(permisoConfig, {
    orgId,
    userId,
    resourceId: `/agents/${agentId}/execute`,
    action: "execute",
  });

  if (!canExecute.success || !canExecute.data) {
    throw new ForbiddenError("Insufficient permissions to execute agent");
  }

  // Execute agent...
};
```

#### In A2A Server

```typescript
// Middleware for A2A endpoints
export async function checkA2APermission(req, res, next) {
  const { orgId, userId } = req.auth;
  const { agentName } = req.body.params;

  const hasAccess = await hasPermission(permisoConfig, {
    orgId,
    userId,
    resourceId: `/agents/${agentName}/execute`,
    action: "execute",
  });

  if (!hasAccess.success || !hasAccess.data) {
    return res.status(403).json({
      jsonrpc: "2.0",
      id: req.body.id,
      error: {
        code: -32003,
        message: "Forbidden",
        data: { reason: "Insufficient permissions" },
      },
    });
  }

  next();
}
```

### Agent-Level Permissions

Fine-grained control over individual agents:

```typescript
// Create resources for each agent
await createResource(permisoConfig, {
  id: "/agents/customer-support",
  orgId: "org-123",
  name: "Customer Support Agent",
  description: "Customer service automation agent",
});

// Grant permission to specific users
await grantUserPermission(permisoConfig, {
  orgId: "org-123",
  userId: "user-789",
  resourceId: "/agents/customer-support",
  action: "execute",
});

// Or grant to a role
await grantRolePermission(permisoConfig, {
  orgId: "org-123",
  roleId: "support-team",
  resourceId: "/agents/customer-support",
  action: "execute",
});
```

### Workflow Permissions

Control who can view and manage workflows:

```typescript
// Check workflow access
const canViewWorkflow = await hasPermission(permisoConfig, {
  orgId,
  userId,
  resourceId: `/workflows/${workflowId}`,
  action: "read",
});

// Get all workflows user can access
const effectivePerms = await getEffectivePermissionsByPrefix(permisoConfig, {
  orgId,
  userId,
  resourceIdPrefix: "/workflows/",
  action: "read",
});

// Filter workflows based on permissions
const accessibleWorkflows = allWorkflows.filter((w) =>
  effectivePerms.data.some((p) => p.resourceId === `/workflows/${w.id}`),
);
```

## Integration Points

### 1. Authentication Flow

```
User Login → Ory Kratos → Shaman → Permiso (check org/user)
```

### 2. GraphQL Context

```typescript
// Add permission checker to GraphQL context
const context = {
  auth: { orgId, userId },
  permiso: {
    hasPermission: (resourceId, action) =>
      hasPermission(permisoConfig, { orgId, userId, resourceId, action }),
  },
};
```

### 3. Database Considerations

- Organization IDs will be synchronized between Shaman and Permiso
- User IDs will map to Permiso users via identity provider
- No permission data stored in Shaman database

## Migration Strategy

When Permiso integration is implemented:

1. **Create Organizations**: Migrate existing Shaman organizations to Permiso
2. **Create Users**: Map Shaman users to Permiso users with identity provider
3. **Define Resources**: Create resource hierarchy for agents and APIs
4. **Assign Roles**: Set up default roles and permissions
5. **Update Code**: Add permission checks to all protected operations

## Benefits

- **Centralized Authorization**: Single source of truth for permissions
- **Fine-grained Control**: Per-agent and per-resource permissions
- **Scalable**: Handles complex permission hierarchies
- **Auditable**: Complete permission history and effective permissions
- **Flexible**: Custom properties and metadata support
