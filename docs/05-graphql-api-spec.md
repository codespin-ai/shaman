[← Previous: API, Config & Deployment](./04-api-config-and-deployment.md) | [🏠 Home](./README.md)

---

# GraphQL API Specification

## Overview

The Shaman GraphQL API provides a strongly-typed interface for managing AI agents, executing workflows, and monitoring system operations. This API is designed for the management UI and requires **session-based authentication** via Ory Kratos.

**Note**: This API is NOT used for agent execution. External systems calling agents should use the A2A endpoints with API key authentication.

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

The complete GraphQL schema is defined in: [`/node/packages/shaman-server/src/schema.graphql`](../node/packages/shaman-server/src/schema.graphql)

## Key Concepts

### Agent Model

The agent system distinguishes between Git-based agents and external A2A agents through a unified `Agent` type:

```graphql
type Agent {
  name: String!
  description: String!
  source: AgentSource!  # GIT or A2A_EXTERNAL
  tags: [String!]!
  
  # Source-specific details
  gitDetails: GitAgentDetails      # Populated for Git agents
  externalDetails: ExternalAgentDetails  # Populated for A2A agents
  
  # Analytics (common to all agents)
  usageCount: Int!
  lastUsed: DateTime
  averageExecutionTime: Float
  successRate: Float
}
```

### MCP Server Access

Instead of using JSON, MCP server configurations are strongly typed:

```graphql
type MCPServerAccess {
  serverName: String!
  accessType: MCPAccessType!  # FULL, SPECIFIC_TOOLS, or NONE
  allowedTools: [String!]     # Populated when accessType is SPECIFIC_TOOLS
}

enum MCPAccessType {
  FULL           # Access to all tools ("*" or null in YAML)
  SPECIFIC_TOOLS # Access to listed tools only
  NONE           # No access
}
```

### Workflow Execution

Execute agents through the GraphQL API (for UI testing, not production use):

```graphql
mutation ExecuteAgent {
  executeAgent(input: {
    agentName: "CustomerSupport"
    input: "Help me with order #12345"
    source: GIT
    contextScope: FULL
  }) {
    id
    status
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
    type: SERVICE_ACCOUNT
    role: EXTERNAL_API_CLIENT
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
      # Note: No kratos_identity_id for service accounts
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
    authType: TOKEN
    authToken: "github_pat_..."
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