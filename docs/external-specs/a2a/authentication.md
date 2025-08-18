# Authentication in A2A

Authentication in A2A is handled at the HTTP transport layer, not within the protocol messages. This document describes how authentication works and how agents declare their requirements.

## Core Principles

1. **Transport Layer**: Authentication happens via HTTP headers
2. **Out-of-Band**: Credentials are obtained outside the A2A protocol
3. **Declaration**: Agents declare requirements in their AgentCard
4. **Standards-Based**: Uses established web authentication patterns

## Authentication Flow

### 1. Discovery

Client discovers authentication requirements from AgentCard:

```json
{
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT",
      "description": "JWT token from our auth server"
    },
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key",
      "description": "API key obtained from developer portal"
    }
  },
  "security": [
    { "bearer": ["read", "write"] }, // Option 1: Bearer with scopes
    { "apiKey": [] } // Option 2: API key
  ]
}
```

### 2. Credential Acquisition

Client obtains credentials through provider-specific process:

- OAuth 2.0 flow for bearer tokens
- Developer portal for API keys
- Identity provider for OIDC tokens

### 3. Request Authentication

Client includes credentials in HTTP headers:

```http
POST / HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "message/send",
  "params": {...}
}
```

## Security Scheme Types

### HTTP Authentication

```json
{
  "bearer": {
    "type": "http",
    "scheme": "bearer",
    "bearerFormat": "JWT" // Optional: JWT, OAuth2, etc.
  },
  "basic": {
    "type": "http",
    "scheme": "basic"
  }
}
```

### API Key

```json
{
  "apiKey": {
    "type": "apiKey",
    "in": "header", // or "query", "cookie"
    "name": "X-API-Key"
  }
}
```

### OAuth 2.0

```json
{
  "oauth2": {
    "type": "oauth2",
    "flows": {
      "authorizationCode": {
        "authorizationUrl": "https://auth.example.com/oauth/authorize",
        "tokenUrl": "https://auth.example.com/oauth/token",
        "scopes": {
          "read": "Read access",
          "write": "Write access"
        }
      }
    }
  }
}
```

### OpenID Connect

```json
{
  "oidc": {
    "type": "openIdConnect",
    "openIdConnectUrl": "https://auth.example.com/.well-known/openid-configuration"
  }
}
```

## Security Requirements

The `security` field defines which schemes can be used:

### Single Scheme Required

```json
{
  "security": [
    { "bearer": [] } // Only bearer token accepted
  ]
}
```

### Multiple Options (OR)

```json
{
  "security": [
    { "bearer": [] }, // Option 1: Bearer token
    { "apiKey": [] }, // Option 2: API key
    { "basic": [] } // Option 3: Basic auth
  ]
}
```

### Multiple Requirements (AND)

```json
{
  "security": [
    {
      "apiKey": [], // Requires BOTH
      "mtls": [] // API key AND mTLS
    }
  ]
}
```

### Scopes

```json
{
  "security": [
    {
      "oauth2": ["read", "write", "admin"] // Required scopes
    }
  ]
}
```

## Server Responsibilities

### 1. Validate Every Request

```python
def handle_request(request):
    # Extract credentials
    auth_header = request.headers.get('Authorization')

    # Validate based on declared schemes
    if not validate_credentials(auth_header):
        return error_401_unauthorized()

    # Check authorization
    if not check_permissions(auth_header, request.method):
        return error_403_forbidden()

    # Process request
    return process_a2a_request(request)
```

### 2. Return Appropriate Errors

**401 Unauthorized**: Missing or invalid credentials

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="A2A API"
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32000,
    "message": "Authentication required"
  }
}
```

**403 Forbidden**: Valid credentials but insufficient permissions

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32000,
    "message": "Insufficient permissions for requested operation"
  }
}
```

## In-Task Authentication

Sometimes agents need additional credentials during task execution:

### 1. Agent Requests Auth

```json
{
  "status": {
    "state": "auth-required",
    "message": {
      "parts": [
        {
          "kind": "data",
          "data": {
            "authRequired": {
              "service": "google-drive",
              "scopes": ["drive.readonly"],
              "authUrl": "https://accounts.google.com/oauth/authorize?..."
            }
          }
        }
      ]
    }
  }
}
```

### 2. Client Obtains Credentials

Client performs out-of-band authentication flow.

### 3. Client Provides Credentials

How credentials are provided depends on the use case:

- As data in the next message
- As new HTTP headers
- Through a separate secure channel

## Shaman Implementation

### External Authentication (API Keys)

1. **Validation**: Via Permiso service
2. **Storage**: API keys managed by Permiso
3. **Headers**: Standard `Authorization: Bearer` format
4. **Context**: User/service account identity maintained

### Internal Authentication (JWT)

1. **Generation**: Short-lived tokens for agent-to-agent calls
2. **Claims**: Include workflow ID, organization, agent names
3. **Validation**: Standard JWT verification
4. **Expiry**: 5-minute lifetime

### AgentCard Generation

Shaman automatically adds security schemes based on organization configuration:

```yaml
# Organization config
authentication:
  type: bearer
  provider: permiso

# Generated AgentCard includes:
"securitySchemes": {
  "bearer": {
    "type": "http",
    "scheme": "bearer",
    "bearerFormat": "JWT"
  }
},
"security": [{"bearer": []}]
```

## Best Practices

1. **Use HTTPS Always**: Never send credentials over plain HTTP
2. **Validate Everything**: Check auth on every request
3. **Fail Fast**: Return 401/403 immediately
4. **Clear Documentation**: Describe auth requirements clearly
5. **Token Rotation**: Support token refresh for long-running tasks
6. **Audit Everything**: Log all authentication events
