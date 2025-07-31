# API Key Management in Permiso

Permiso manages API keys for programmatic access to Shaman's A2A endpoints. Each API key is associated with a specific user, providing a complete audit trail for all API operations.

## API Key Model

```graphql
type ApiKey {
  id: ID!
  key: String!  # The actual key (shown only on creation)
  keyPrefix: String!  # First 8 chars for identification (e.g., "sk_live_")
  userId: ID!
  orgId: ID!
  name: String!
  description: String
  status: ApiKeyStatus!
  expiresAt: DateTime
  lastUsedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relationships
  user: User!
  organization: Organization!
  permissions: [ApiKeyPermission!]!
}

enum ApiKeyStatus {
  ACTIVE
  REVOKED
  EXPIRED
}

type ApiKeyPermission {
  id: ID!
  apiKeyId: ID!
  resourceId: ID!  # Can be specific agent or wildcard
  action: String!  # "execute" for agents
  
  # Relationships
  apiKey: ApiKey!
  resource: Resource!
}
```

## GraphQL Operations

### Creating API Keys

```graphql
mutation CreateApiKey {
  createApiKey(input: {
    orgId: "acme-corp"
    userId: "service-account-1"
    name: "Production Integration"
    description: "API key for production workflow automation"
    expiresAt: "2025-12-31T23:59:59Z"
    permissions: [
      {
        resourceId: "/agents/ProcessInvoice"
        action: "execute"
      },
      {
        resourceId: "/agents/CustomerSupport"
        action: "execute"
      }
    ]
  }) {
    id
    key  # Full key shown only once!
    keyPrefix
    name
    status
    user {
      id
      email
    }
  }
}

# Response
{
  "data": {
    "createApiKey": {
      "id": "apikey_123",
      "key": "sk_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
      "keyPrefix": "sk_live_",
      "name": "Production Integration",
      "status": "ACTIVE",
      "user": {
        "id": "service-account-1",
        "email": "integration@acme-corp.com"
      }
    }
  }
}
```

### Listing API Keys

```graphql
query ListApiKeys {
  apiKeys(
    orgId: "acme-corp"
    filter: { status: ACTIVE }
  ) {
    nodes {
      id
      keyPrefix
      name
      description
      status
      lastUsedAt
      expiresAt
      user {
        email
      }
      permissions {
        resourceId
        action
      }
    }
    totalCount
  }
}
```

### Validating API Keys

```graphql
query ValidateApiKey {
  validateApiKey(key: "sk_live_abc123...") {
    valid
    apiKey {
      id
      userId
      orgId
      status
      expiresAt
      permissions {
        resourceId
        action
      }
    }
    error  # If invalid, why
  }
}
```

### Revoking API Keys

```graphql
mutation RevokeApiKey {
  revokeApiKey(
    orgId: "acme-corp"
    apiKeyId: "apikey_123"
  ) {
    id
    status  # Now REVOKED
    revokedAt
  }
}
```

## API Key Types

### User API Keys
Created by individual users for personal automation:
```graphql
mutation CreatePersonalApiKey {
  createApiKey(input: {
    orgId: "acme-corp"
    userId: "john-doe"  # Regular user
    name: "My Automation Script"
    permissions: []  # Inherits user's permissions
  }) {
    key
  }
}
```

### Service Account Keys
Created for system integrations:
```graphql
# First create a service account user
mutation CreateServiceAccount {
  createUser(input: {
    id: "github-integration"
    orgId: "acme-corp"
    identityProvider: "service-account"
    identityProviderUserId: "github-integration@acme-corp"
    properties: [{
      name: "type"
      value: "service-account"
    }]
  }) {
    id
  }
}

# Then create API key for it
mutation CreateServiceAccountKey {
  createApiKey(input: {
    orgId: "acme-corp"
    userId: "github-integration"
    name: "GitHub Actions Integration"
    permissions: [{
      resourceId: "/agents/PRReviewer"
      action: "execute"
    }]
  }) {
    key
  }
}
```

## Permission Model

API keys can have:

1. **No explicit permissions** - Inherit all user's permissions
2. **Specific permissions** - Limited to listed resources
3. **Wildcard permissions** - Access to resource patterns

```graphql
# Wildcard permission example
mutation CreateWildcardApiKey {
  createApiKey(input: {
    orgId: "acme-corp"
    userId: "admin-user"
    name: "Admin API Key"
    permissions: [{
      resourceId: "/agents/*"  # All agents
      action: "execute"
    }]
  }) {
    key
  }
}
```

## Security Best Practices

1. **Key Format**: Use secure prefixes like `sk_live_` for production, `sk_test_` for testing
2. **Rotation**: Set expiration dates and rotate regularly
3. **Least Privilege**: Grant minimum required permissions
4. **Audit Trail**: All API key usage is logged with user context
5. **Storage**: Keys are hashed with bcrypt, never stored in plaintext
6. **Rate Limiting**: Apply per-key rate limits

## Integration with Shaman

When an API request arrives at Shaman:

```typescript
// API Gateway validates the key
async function validateApiRequest(req: Request) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  
  // Query Permiso
  const validation = await permiso.query(`
    query {
      validateApiKey(key: "${apiKey}") {
        valid
        apiKey {
          userId
          orgId
          status
          permissions {
            resourceId
            action
          }
        }
        error
      }
    }
  `);
  
  if (!validation.valid) {
    throw new UnauthorizedError(validation.error);
  }
  
  // Check if key can access the requested agent
  const agent = extractAgentFromPath(req.path);
  const hasPermission = checkAgentPermission(
    validation.apiKey.permissions,
    agent
  );
  
  if (!hasPermission) {
    throw new ForbiddenError(`API key cannot access agent: ${agent}`);
  }
  
  // Return user context for audit
  return {
    userId: validation.apiKey.userId,
    orgId: validation.apiKey.orgId,
    authMethod: 'api-key',
    apiKeyId: validation.apiKey.id
  };
}
```

## Monitoring and Analytics

Track API key usage:

```graphql
query ApiKeyAnalytics {
  apiKeyUsageStats(
    orgId: "acme-corp"
    apiKeyId: "apikey_123"
    timeRange: { start: "2024-01-01", end: "2024-01-31" }
  ) {
    totalRequests
    successfulRequests
    failedRequests
    uniqueAgentsCalled
    averageResponseTime
    dailyUsage {
      date
      requests
      errors
    }
  }
}
```