[← Previous: API, Config & Deployment](./04-api-config-and-deployment.md) | [🏠 Home](./README.md)

---

# GraphQL API Specification

## Overview

The Shaman GraphQL API provides a strongly-typed interface for managing AI agents and monitoring system operations. This API is designed for the management UI and requires **session-based authentication** via Ory Kratos.

**IMPORTANT**: This API does NOT execute agents. ALL agent execution (including from the UI) must go through the A2A server. The GraphQL API is purely for management operations.

## Authentication

**Required**: All GraphQL operations require a valid Kratos session cookie or session token.

```http
POST /graphql
Cookie: ory_kratos_session=...

# OR

POST /graphql
Authorization: Bearer <kratos-session-token>
```

The session is validated with Kratos, and the user's permissions are checked via Permiso before executing any operation.

## Design Principles

1. **Strong Typing**: All fields use proper GraphQL types - no JSON escape hatches
2. **Consistent Patterns**: Relay-style connections for all paginated queries
3. **Clear Discrimination**: Agent sources and types are clearly distinguished
4. **Rich Error Types**: Detailed error information for debugging
5. **Comprehensive Coverage**: Full system visibility for management UIs
6. **Session-Only Access**: No API key authentication for GraphQL

## Schema Location

The complete GraphQL schema is defined in: [`/node/packages/shaman-gql-server/src/schema.graphql`](../node/packages/shaman-gql-server/src/schema.graphql)

## Key Concepts

### Agent Model

The agent system provides a minimal unified view for discovery:

```graphql
type Agent {
  name: String!
  description: String!
  source: AgentSource!  # GIT or A2A_EXTERNAL
  tags: [String!]!
  
  # Minimal source details
  repositoryName: String  # For Git agents
  endpoint: String        # For external agents
  
  # Analytics
  usageCount: Int!
  lastUsed: DateTime
  averageExecutionTime: Float
  successRate: Float
}
```

**Note**: Detailed agent configuration (models, MCP servers, allowed agents) remains in the Git repository where it belongs. The API provides only discovery and analytics.

### Workflow Monitoring

Monitor existing workflow runs (execution happens via A2A server).

**Note**: The system builds a complete execution DAG (Directed Acyclic Graph) by tracking parent-child relationships between Steps. This is achieved through the A2A protocol's `metadata` field that carries `runId` and `parentStepId` through all agent calls.

```graphql
query GetRun {
  run(id: "run_abc123") {
    id
    status
    startedAt
    completedAt
    steps {
      edges {
        node {
          id
          agentName
          status
          messages {
            edges {
              node {
                role
                content
                timestamp
              }
            }
          }
        }
      }
    }
  }
}
```

### User Roles

Users can have multiple roles within an organization:

- **OWNER**: Full administrative access, can delete organization
- **ADMIN**: Manage users, repositories, and settings
- **USER**: Standard access to execute agents and view data

Roles are managed through Permiso RBAC service for fine-grained permissions.

## Core Operations

### Organization & User Management

```graphql
# Get current user's organization
query GetMyOrganization {
  viewer {
    id
    email
    organization {
      id
      name
      subdomain
      plan
      repositories {
        edges {
          node {
            name
            gitUrl
            lastSyncStatus
          }
        }
      }
    }
  }
}

# List organization users
query ListOrgUsers {
  viewer {
    organization {
      users(first: 50) {
        edges {
          node {
            id
            email
            roles
            lastLoginAt
            apiKeys {
              edges {
                node {
                  id
                  keyPrefix
                  name
                  status
                  lastUsedAt
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### API Key Management & Service Accounts

```graphql
# Create service account with API key for external partner
mutation CreateServiceAccount {
  createServiceAccount(input: {
    email: "integration@partner-corp.com"
    name: "Partner Corp Integration"
    description: "External API access for order processing"
    roles: ["USER"]  # Can be ["OWNER"], ["ADMIN"], or ["USER"]
    allowedAgents: [
      "/agents/ProcessOrder",
      "/agents/CheckOrderStatus",
      "/agents/GetShippingRates"
    ]
    apiKeyExpiry: "2025-12-31T23:59:59Z"
  }) {
    user {
      id
      email
      type  # SERVICE_ACCOUNT
      roles  # Array of roles
    }
    apiKey {
      id
      key  # sk_live_abc123... (shown only once!)
      keyPrefix
      expiresAt
      permissions {
        resourceId  # /agents/ProcessOrder
        action      # execute
      }
    }
  }
}

# Create API key for existing user (human or service account)
mutation CreateApiKey {
  createApiKey(input: {
    userId: "user-123"
    name: "Production Integration"
    description: "Used by GitHub Actions"
    expiresAt: "2025-12-31T23:59:59Z"
    permissions: [
      {
        resourceId: "/agents/ProcessInvoice"
        action: "execute"
      }
    ]
  }) {
    apiKey {
      id
      key  # Full key - shown only once!
      keyPrefix
      name
    }
  }
}

# List API keys
query ListApiKeys {
  viewer {
    organization {
      apiKeys(
        first: 20
        filter: { status: ACTIVE }
      ) {
        edges {
          node {
            id
            keyPrefix
            name
            user {
              email
            }
            status
            lastUsedAt
            permissions {
              resourceId
              action
            }
          }
        }
      }
    }
  }
}

# Revoke API key
mutation RevokeApiKey {
  revokeApiKey(id: "apikey-123") {
    apiKey {
      id
      status  # Now REVOKED
    }
  }
}
```

### Repository Management

```graphql
# Add a new repository
mutation AddRepository {
  createRepository(input: {
    name: "customer-agents"
    gitUrl: "https://github.com/acme/customer-agents.git"
    branch: "main"
    isRoot: true
  }) {
    repository {
      id
      name
      syncStatus
    }
  }
}

# Sync repository
mutation SyncRepository {
  syncRepository(id: "repo-123") {
    repository {
      id
      lastSyncStatus
      lastSyncAt
      lastSyncCommit
      agents {
        edges {
          node {
            name
            exposed
          }
        }
      }
    }
  }
}
```

### Git Credential Management

```graphql
# Set credentials for a repository
mutation SetGitCredentials {
  setGitCredentials(input: {
    repositoryId: "repo-123"
    provider: GITHUB
    token: "github_pat_..."
    tokenName: "Shaman Read-Only Access"
  }) {
    repository {
      id
      name
      hasCredentials
      lastCredentialUpdate
    }
  }
}

# Test repository access
mutation TestGitCredentials {
  testGitCredentials(repositoryId: "repo-123") {
    success
    message
    lastCommitHash
    branchInfo {
      name
      isProtected
    }
  }
}

# Remove credentials
mutation RemoveGitCredentials {
  removeGitCredentials(repositoryId: "repo-123") {
    repository {
      id
      hasCredentials
    }
  }
}

# Types for Git credential management
enum GitProvider {
  GITHUB
  GITLAB
  BITBUCKET
  GENERIC  # For self-hosted Git
}

input GitCredentialInput {
  repositoryId: ID!
  provider: GitProvider!
  token: String!
  tokenName: String
}

type GitCredentialTestResult {
  success: Boolean!
  message: String
  lastCommitHash: String
  branchInfo: BranchInfo
}

type BranchInfo {
  name: String!
  isProtected: Boolean!
}
```

### Agent Discovery

```graphql
# List all available agents
query ListAgents {
  agents(
    first: 50
    filter: {
      source: GIT
      exposed: true
      tags: ["customer-support"]
    }
  ) {
    edges {
      node {
        name
        description
        exposed
        source
        gitDetails {
          repository {
            name
          }
          filePath
          lastModifiedAt
        }
        tags
        model
        mcpServerAccess {
          serverName
          accessType
          allowedTools
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Workflow Management

```graphql
# Create a new run explicitly (for multi-agent orchestration)
mutation CreateRun {
  createRun(input: {
    description: "Process order with fraud check and inventory update"
    metadata: {
      orderId: "12345",
      customerId: "cust-789"
    }
  }) {
    run {
      id
      status
      createdAt
    }
    errors {
      code
      message
    }
  }
}
```

**Note**: This enables orchestration patterns where multiple agents can be started as root steps in the same workflow. Pass the returned `run.id` in the A2A metadata field `shaman:runId` when invoking agents.

### Workflow Monitoring

```graphql
# List recent workflow runs
query ListWorkflowRuns {
  runs(
    first: 20
    orderBy: { field: CREATED_AT, direction: DESC }
  ) {
    edges {
      node {
        id
        status
        startedAt
        completedAt
        initiatingUser {
          email
          authMethod  # SESSION or API_KEY
        }
        rootStep {
          agentName
          status
          tokenUsage {
            promptTokens
            completionTokens
            totalCost
          }
        }
      }
    }
  }
}

# Get detailed run information
query GetRunDetails($runId: ID!) {
  run(id: $runId) {
    id
    status
    initiatingUser {
      id
      email
      authMethod
      apiKeyUsed {
        keyPrefix
        name
      }
    }
    steps {
      edges {
        node {
          id
          agentName
          status
          startedAt
          completedAt
          error {
            code
            message
            stackTrace
          }
          messages {
            edges {
              node {
                role
                content
                timestamp
              }
            }
          }
          toolCalls {
            edges {
              node {
                toolName
                parameters
                result
                duration
              }
            }
          }
        }
      }
    }
  }
}
```

### Audit Logs

```graphql
# Query audit logs
query GetAuditLogs {
  auditLogs(
    first: 100
    filter: {
      startDate: "2024-01-01T00:00:00Z"
      endDate: "2024-01-31T23:59:59Z"
      actions: [API_KEY_CREATED, AGENT_EXECUTED, REPOSITORY_SYNCED]
    }
  ) {
    edges {
      node {
        id
        timestamp
        action
        user {
          email
        }
        authMethod
        resourceType
        resourceId
        metadata {
          ipAddress
          userAgent
          apiKeyUsed
        }
      }
    }
  }
}
```

## Subscriptions

Real-time updates for active workflows:

```graphql
subscription WatchRun($runId: ID!) {
  runUpdates(runId: $runId) {
    run {
      id
      status
    }
    event {
      type  # STEP_STARTED, MESSAGE_ADDED, TOOL_CALLED, etc.
      timestamp
      data {
        ... on StepStartedData {
          stepId
          agentName
        }
        ... on MessageAddedData {
          stepId
          message {
            role
            content
          }
        }
        ... on ToolCalledData {
          stepId
          toolName
          parameters
        }
      }
    }
  }
}
```

## Error Handling

All operations return strongly-typed errors:

```graphql
type MutationResponse {
  success: Boolean!
  errors: [Error!]
}

type Error {
  code: ErrorCode!
  message: String!
  field: String
  context: ErrorContext
}

enum ErrorCode {
  AUTHENTICATION_REQUIRED
  PERMISSION_DENIED
  NOT_FOUND
  VALIDATION_ERROR
  RATE_LIMITED
  INTERNAL_ERROR
}
```

Example error response:

```json
{
  "data": {
    "createRepository": null
  },
  "errors": [
    {
      "message": "User does not have permission to create repositories",
      "extensions": {
        "code": "PERMISSION_DENIED",
        "requiredPermission": "repositories:create",
        "userPermissions": ["repositories:read", "agents:execute"]
      }
    }
  ]
}
```

## Rate Limiting

GraphQL operations are rate-limited per user:

- **Queries**: 1000 requests per minute
- **Mutations**: 100 requests per minute
- **Subscriptions**: 10 concurrent connections

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1704124800
```

## Best Practices

1. **Use field selection** to request only needed data
2. **Implement pagination** for list queries
3. **Handle errors gracefully** - check both `data` and `errors` fields
4. **Use subscriptions sparingly** - only for active UI components
5. **Cache agent lists** - they change infrequently
6. **Batch operations** when possible using aliases

---

**Navigation:**

- [← Previous: API, Config & Deployment](./04-api-config-and-deployment.md)
- [🏠 Home](./README.md)