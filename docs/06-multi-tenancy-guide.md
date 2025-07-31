[← Previous: GraphQL API Specification](./05-graphql-api-spec.md) | [🏠 Home](./README.md)

---

# Multi-Tenancy Architecture

## Overview

Shaman is designed as a multi-tenant system where multiple organizations can operate independently within the same deployment. Each organization has complete isolation of their data, configurations, and resources while sharing the underlying infrastructure.

## Core Concepts

### Organization

The Organization is the top-level tenant entity in Shaman. All resources (repositories, agents, runs, users) belong to an organization. Organizations are completely isolated from each other.

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;           // URL-friendly identifier (e.g., "acme-corp")
  description: string;
  settings: OrganizationSettings;
  subscription: SubscriptionInfo;
}
```

### Organization Settings

Each organization can configure:
- **Agent Execution**: Default models, providers, concurrency limits
- **Security**: External agent policies, domain whitelisting
- **Feature Flags**: Enable/disable specific features

### User-Organization Relationship

Users can belong to multiple organizations with different roles:
- **OWNER**: Full control, billing access, can delete organization
- **ADMIN**: Manage users, repositories, and settings
- **DEVELOPER**: Create/modify agents, execute workflows
- **VIEWER**: Read-only access to view executions and analytics

## Tenant Isolation

### Data Isolation

All database tables include an `org_id` column for row-level security:

```sql
-- Example: Agent repositories are scoped to organizations
SELECT * FROM agent_repository 
WHERE org_id = :current_org_id;
```

### Resource Scoping

All GraphQL queries automatically scope to the current organization context:

```graphql
query GetRepositories {
  # Returns only repositories for the current organization
  repositories {
    edges {
      node {
        name
        gitUrl
      }
    }
  }
}
```

### Credential Isolation

Each organization has separate:
- Git repository credentials
- External API keys
- LLM provider tokens
- A2A agent authentications

## Multi-Tenant Features

### Organization Switching

Users can switch between organizations they belong to:

```graphql
mutation SwitchOrganization {
  switchOrganization(organizationId: "org-123") {
    user {
      name
    }
    currentOrganization {
      name
      slug
    }
  }
}
```

### Cross-Organization Access

System administrators have special access for support:
- Can view all organizations
- Can impersonate users for debugging
- Cannot modify organization data without explicit permission

### Organization Management

```graphql
# Create a new organization
mutation CreateOrganization {
  createOrganization(input: {
    name: "Acme Corporation"
    slug: "acme-corp"
    description: "Enterprise AI automation"
  }) {
    id
    name
    slug
  }
}

# Invite users to organization
mutation InviteUser {
  inviteUser(input: {
    email: "developer@acme.com"
    name: "Jane Developer"
    role: DEVELOPER
    permissions: ["execute_agents", "view_analytics"]
  }) {
    user {
      email
    }
    role
  }
}
```

## Resource Ownership

### Agent Repositories

Each repository belongs to exactly one organization:

```graphql
type AgentRepository {
  organization: Organization!
  name: String!           # Unique within organization
  gitUrl: String!
  # ... other fields
}
```

### Workflow Runs

All executions are scoped to the organization:

```graphql
type Run {
  organization: Organization!
  createdBy: User!
  # ... execution details
}
```

### MCP Servers & External Agents

Tool servers and external agents are organization-specific:

```graphql
type McpServer {
  organization: Organization!
  allowedRoles: [OrganizationRole!]!
  allowedUsers: [User!]!
  # ... server configuration
}
```

## Usage Tracking & Billing

Each organization's usage is tracked separately:

```graphql
type OrganizationUsage {
  currentPeriodStart: DateTime!
  currentPeriodEnd: DateTime!
  totalRuns: Int!
  totalCost: Float!
  totalTokens: Int!
  runsByStatus: [UsageByStatus!]!
}
```

## Security Considerations

### API Access

All API requests must include organization context:
- GraphQL context includes current organization
- REST endpoints use organization slug in URL
- Webhooks are scoped to organization

### Authentication Flow

1. User authenticates (OAuth, SAML, etc.)
2. System determines available organizations
3. User selects or defaults to an organization
4. All subsequent requests use that organization context

### Permission Model

Permissions are evaluated at multiple levels:
1. System role (USER vs SYSTEM_ADMIN)
2. Organization role (OWNER, ADMIN, DEVELOPER, VIEWER)
3. Resource-specific permissions (if applicable)

## Implementation Guidelines

### Database Queries

Always include organization context:

```typescript
// ❌ Bad - No organization scoping
const agents = await db.query('SELECT * FROM git_agent');

// ✅ Good - Properly scoped
const agents = await db.query(
  'SELECT * FROM git_agent WHERE org_id = $1',
  [context.organizationId]
);
```

### GraphQL Resolvers

Use context to enforce organization scope:

```typescript
const repositoryResolver = {
  Query: {
    repositories: async (_, args, context) => {
      // Context includes current organization
      return getRepositories(context.organization.id);
    }
  }
};
```

### Agent Resolution

Agent names are unique within an organization:
- `org-a` can have `CustomerSupport` agent
- `org-b` can also have `CustomerSupport` agent
- No conflicts between organizations

## Migration Path

For existing single-tenant deployments:

1. Create a default organization
2. Assign all existing resources to it
3. Create user accounts for existing access
4. Map existing credentials to organization
5. Update API clients with organization context

## Best Practices

1. **Always Validate Organization Context**: Never assume organization from other parameters
2. **Use Database Constraints**: Foreign keys should cascade delete with organization
3. **Audit Organization Access**: Log all cross-organization access by system admins
4. **Separate Credentials**: Never share credentials between organizations
5. **Test Isolation**: Regularly verify no data leakage between tenants

---

**Navigation:**

- [← Previous: GraphQL API Specification](./05-graphql-api-spec.md)
- [🏠 Home](./README.md)