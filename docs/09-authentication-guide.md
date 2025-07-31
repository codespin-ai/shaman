[← Previous: Database Schema](./08-database-schema.md) | [🏠 Home](./README.md)

---

# Authentication Guide

Shaman uses two distinct authentication mechanisms depending on the type of access:

1. **Session-based authentication** (via Ory Kratos) - For human users accessing the management UI
2. **API key authentication** (via Permiso) - For programmatic access to A2A agent endpoints

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Human Users                          │
│                                                         │
│  Browser → Kratos Login → Session Cookie → GraphQL API │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 External Systems                        │
│                                                         │
│  System → API Key Header → Permiso Lookup → A2A API    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Session-Based Authentication (Management UI)

### How It Works

1. **User Login**: Users authenticate via Kratos UI (password, Google, GitHub, SSO)
2. **Session Creation**: Kratos creates a secure session and sets a cookie
3. **API Access**: Session cookie is validated on each GraphQL request
4. **Permission Check**: User permissions are verified via Permiso

### Login Flow

```typescript
// 1. User visits login page
https://acme-corp.shaman.ai/login

// 2. Redirected to Kratos
https://acme-corp.shaman.ai/self-service/login/browser

// 3. User chooses login method and authenticates

// 4. Kratos validates and creates session
Set-Cookie: ory_kratos_session=...

// 5. User redirected back to app
https://acme-corp.shaman.ai/dashboard
```

### Session Validation

Every GraphQL request requires a valid session:

```typescript
// GraphQL request with session cookie
POST /graphql
Cookie: ory_kratos_session=abc123...
Content-Type: application/json

{
  "query": "{ viewer { email organization { name } } }"
}

// Backend validates session
const session = await kratos.toSession(sessionCookie);
if (!session.active) {
  throw new AuthenticationError('Invalid session');
}
```

### Managing Sessions

```graphql
# Get current session info
query GetCurrentUser {
  viewer {
    id
    email
    organization {
      id
      name
      subdomain
    }
    lastLoginAt
    sessionExpiresAt
  }
}

# Logout (invalidates session)
mutation Logout {
  logout {
    success
  }
}
```

## API Key Authentication (A2A Access)

### How It Works

1. **API Key Creation**: Admin creates API key via GraphQL (human auth required)
2. **Key Association**: Key is linked to a specific user (regular or service account)
3. **Key Usage**: External systems include key in Authorization header
4. **User Resolution**: Permiso maps API key to user identity
5. **Permission Check**: User's permissions are verified for the requested agent

### Creating API Keys

API keys can only be created by authenticated users via the GraphQL API:

```graphql
# Create a personal API key
mutation CreatePersonalApiKey {
  createApiKey(input: {
    name: "My Automation Script"
    description: "For running automated tests"
    expiresAt: "2025-12-31T23:59:59Z"
  }) {
    apiKey {
      id
      key  # sk_live_abc123... (shown only once!)
      keyPrefix
      name
    }
  }
}

# Create a service account with API key
mutation CreateServiceAccount {
  # Step 1: Create service account user
  createUser(input: {
    email: "github-integration@acme-corp.com"
    type: SERVICE_ACCOUNT
    name: "GitHub Integration"
  }) {
    user {
      id
    }
  }
}

mutation CreateServiceAccountKey {
  # Step 2: Create API key for service account
  createApiKey(input: {
    userId: "user_github_integration"
    name: "GitHub Actions Production"
    permissions: [
      {
        resourceId: "/agents/PRReviewer"
        action: "execute"
      }
    ]
  }) {
    apiKey {
      key
    }
  }
}
```

### Using API Keys

External systems authenticate by including the API key in the Authorization header:

```bash
# Call an exposed agent
curl -X POST https://acme-corp.shaman.ai/a2a/agents/ProcessInvoice \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Process invoice #12345",
    "context": {
      "invoiceId": "12345"
    }
  }'
```

### API Key Validation Flow

```typescript
// 1. Extract API key from request
const apiKey = req.headers.authorization?.replace('Bearer ', '');

// 2. Validate with Permiso
const { data } = await permiso.query(`
  query ValidateApiKey($key: String!) {
    validateApiKey(key: $key) {
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
      error
    }
  }
`, { key: apiKey });

// 3. Check if valid
if (!data.validateApiKey.valid) {
  throw new UnauthorizedError(data.validateApiKey.error);
}

// 4. Check permissions for requested agent
const agent = extractAgentFromPath(req.path);
const hasPermission = checkPermission(
  data.validateApiKey.apiKey.permissions,
  agent
);

if (!hasPermission) {
  throw new ForbiddenError(`No access to agent: ${agent}`);
}

// 5. Proceed with user context
const userContext = {
  userId: data.validateApiKey.apiKey.userId,
  orgId: data.validateApiKey.apiKey.orgId,
  authMethod: 'api-key',
  apiKeyId: data.validateApiKey.apiKey.id
};
```

## Service Accounts

Service accounts are special users designed for system integrations. **Important: Service accounts do NOT have Kratos identities** - they exist only in Permiso with API key authentication.

### User Types in Permiso

```typescript
type User = {
  id: string;
  email: string;
  type: 'HUMAN' | 'SERVICE_ACCOUNT';
  kratos_identity_id?: string;  // Only for HUMAN users
  organization_id: string;
  properties: UserProperty[];
}

// HUMAN users: Have Kratos identity, can login via UI
// SERVICE_ACCOUNT users: No Kratos identity, API key only
```

### Creating Service Accounts for External API Access

Organizations can grant external partners controlled access to specific exposed agents:

```graphql
# Admin creates a service account for external partner
mutation CreateExternalAPIUser {
  createServiceAccount(input: {
    orgId: "acme-corp"
    email: "partner-system@external-partner.com"
    name: "External Partner Integration"
    description: "API access for Partner Corp's order system"
    type: SERVICE_ACCOUNT
    allowedAgents: [
      "/agents/ProcessOrder",      # Can call this exposed agent
      "/agents/CheckOrderStatus"   # And this one
      # Cannot call any other agents
    ]
    apiKeyExpiry: "2025-12-31T23:59:59Z"
  }) {
    user {
      id
      email
      type  # SERVICE_ACCOUNT
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
```

This single API call:
1. Creates a service account user in Permiso (no Kratos identity)
2. Assigns the EXTERNAL_API_CLIENT role
3. Sets permissions for specific exposed agents only
4. Generates an API key with expiration
5. Returns the key to share with the external partner

### Managing External API Access

```graphql
# List all external API users
query ListExternalAPIUsers {
  users(
    filter: {
      type: SERVICE_ACCOUNT
      role: EXTERNAL_API_CLIENT
    }
  ) {
    edges {
      node {
        id
        email
        name
        createdAt
        apiKeys {
          edges {
            node {
              keyPrefix
              status
              lastUsedAt
              expiresAt
              permissions {
                resourceId
              }
            }
          }
        }
      }
    }
  }
}

# Revoke access for a partner
mutation RevokePartnerAccess {
  # Option 1: Revoke specific API key
  revokeApiKey(id: "apikey_123") {
    success
  }
  
  # Option 2: Disable entire service account
  updateUser(
    id: "user_partner_123"
    input: { status: DISABLED }
  ) {
    user {
      status
    }
  }
}

# Update allowed agents for a partner
mutation UpdatePartnerAgentAccess {
  updateApiKeyPermissions(
    apiKeyId: "apikey_123"
    permissions: [
      { resourceId: "/agents/ProcessOrder", action: "execute" },
      { resourceId: "/agents/CheckOrderStatus", action: "execute" },
      { resourceId: "/agents/GetShippingRates", action: "execute" }  # New!
    ]
  ) {
    apiKey {
      permissions {
        resourceId
      }
    }
  }
}
```

### Service Account Best Practices

1. **Clear User Type Separation**: 
   - HUMAN users → Kratos identity + Permiso record
   - SERVICE_ACCOUNT users → Permiso record only

2. **Descriptive Naming**: Use emails that indicate the external system
   - ✅ `github-actions@acme-corp.com`
   - ✅ `salesforce-integration@partner.com`
   - ❌ `user123@temp.com`

3. **Least Privilege**: Grant access only to required exposed agents
   - Start with minimal permissions
   - Add agents as needed
   - Regular access reviews

4. **API Key Management**:
   - Set reasonable expiration dates
   - Monitor usage patterns
   - Revoke unused keys
   - Never share keys in plain text

5. **Audit Trail**: All API calls include service account identity
   ```typescript
   {
     userId: "service_partner_integration",
     userEmail: "integration@partner.com",
     authMethod: "api-key",
     apiKeyId: "apikey_123",
     agent: "ProcessOrder",
     timestamp: "2024-01-15T10:30:00Z"
   }
   ```

## Security Best Practices

### For Session Authentication

1. **Secure Cookies**: Always use HTTPS in production
2. **CSRF Protection**: Implement CSRF tokens for state-changing operations
3. **Session Timeout**: Configure appropriate session lifetimes
4. **MFA Support**: Enable multi-factor authentication for sensitive orgs

### For API Key Authentication

1. **Key Format**: Use secure, prefixed formats (`sk_live_`, `sk_test_`)
2. **Key Storage**: Never commit keys to version control
3. **Key Rotation**: Regularly rotate keys (quarterly recommended)
4. **Least Privilege**: Grant minimum required permissions
5. **IP Whitelisting**: Restrict API keys to specific IPs when possible
6. **Rate Limiting**: Apply per-key rate limits

### General Security

1. **HTTPS Only**: All authentication must use TLS
2. **Audit Logging**: Log all authentication attempts
3. **Monitor Usage**: Track unusual patterns
4. **Revoke Quickly**: Immediately revoke compromised credentials

## Authentication Errors

### Common Error Responses

```json
// Invalid session
{
  "errors": [{
    "message": "Authentication required",
    "extensions": {
      "code": "UNAUTHENTICATED",
      "authenticateUrl": "https://acme-corp.shaman.ai/login"
    }
  }]
}

// Invalid API key
{
  "error": {
    "code": "invalid_api_key",
    "message": "The provided API key is invalid or expired"
  }
}

// Insufficient permissions
{
  "error": {
    "code": "forbidden",
    "message": "API key does not have permission to execute agent: ProcessInvoice"
  }
}
```

## Monitoring Authentication

### Audit Logs

All authentication events are logged:

```graphql
query GetAuthEvents {
  auditLogs(
    filter: {
      actions: [
        LOGIN_SUCCESS,
        LOGIN_FAILED,
        API_KEY_USED,
        API_KEY_REJECTED,
        SESSION_EXPIRED
      ]
    }
    first: 100
  ) {
    edges {
      node {
        timestamp
        action
        user {
          email
        }
        authMethod
        metadata {
          ipAddress
          userAgent
          apiKeyUsed
          errorReason
        }
      }
    }
  }
}
```

### Metrics to Track

1. **Failed login attempts** - Detect brute force attacks
2. **API key usage patterns** - Identify anomalies
3. **Session duration** - Optimize timeout settings
4. **Geographic distribution** - Detect suspicious locations
5. **Rate limit violations** - Adjust limits as needed

## Integration Examples

### JavaScript/TypeScript

```typescript
// Session-based (for management UI)
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://acme-corp.shaman.ai/graphql',
  cache: new InMemoryCache(),
  credentials: 'include', // Include cookies
});

// API key-based (for A2A calls)
async function callAgent(agentName: string, prompt: string) {
  const response = await fetch(
    `https://acme-corp.shaman.ai/a2a/agents/${agentName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SHAMAN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Agent call failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

### Python

```python
import requests
import os

# API key-based agent call
def call_agent(agent_name, prompt):
    url = f"https://acme-corp.shaman.ai/a2a/agents/{agent_name}"
    headers = {
        "Authorization": f"Bearer {os.environ['SHAMAN_API_KEY']}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json={"prompt": prompt}, headers=headers)
    response.raise_for_status()
    
    return response.json()

# Usage
result = call_agent("ProcessInvoice", "Process invoice #12345")
print(result["response"])
```

---

**Navigation:**

- [← Previous: Database Schema](./08-database-schema.md)
- [🏠 Home](./README.md)