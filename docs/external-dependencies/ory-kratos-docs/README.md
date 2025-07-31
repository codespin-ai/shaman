# Ory Kratos

Ory Kratos is an open-source identity and user management system that Shaman uses for authentication. It handles user registration, login, multi-factor authentication, account recovery, and profile management.

## Overview

Kratos is Shaman's authentication service, answering the question "Who is this user?". It integrates seamlessly with external identity providers (Google, GitHub, corporate SSO) while maintaining a unified identity model.

## Features Used by Shaman

- **Multi-provider authentication**: Password, OIDC, SAML support
- **Session management**: Secure cookie-based sessions across subdomains
- **Account recovery**: Password reset and account verification flows
- **Profile management**: User traits and metadata storage
- **Multi-factor authentication**: TOTP, WebAuthn support
- **Identity schema validation**: Ensures consistent user data

## Integration Points

### 1. API Gateway Integration

The API Gateway validates all incoming requests with Kratos:

```typescript
// Validate session
const session = await kratos.toSession(sessionToken);
const identity = session.identity;
const email = identity.traits.email;
```

### 2. User Registration Flow

For new users signing up to an organization:

1. User visits `acme-corp.shaman.ai/register`
2. Chooses registration method (password, Google, SSO)
3. Kratos creates identity with traits
4. Shaman syncs identity to Permiso with org association

### 3. Login Flow

```
User → acme-corp.shaman.ai/login
  ↓
Kratos Login UI
  ↓
Choose Method (Password/OIDC/SSO)
  ↓
Kratos validates credentials
  ↓
Creates session cookie
  ↓
Redirects to Shaman app
```

## Configuration

### Basic Kratos Configuration

```yaml
# kratos.yml
version: v0.13.0

dsn: postgresql://kratos:secret@postgres:5432/kratos?sslmode=disable

serve:
  public:
    base_url: http://localhost:4433/
    cors:
      enabled: true
      allowed_origins:
        - http://localhost:3000
        - https://*.shaman.ai
  admin:
    base_url: http://kratos:4434/

selfservice:
  default_browser_return_url: http://localhost:3000/
  allowed_return_urls:
    - http://localhost:3000
    - https://*.shaman.ai

  methods:
    password:
      enabled: true
    oidc:
      enabled: true
      config:
        providers:
          - id: google
            provider: google
            client_id: $GOOGLE_CLIENT_ID
            client_secret: $GOOGLE_CLIENT_SECRET
            mapper_url: file:///etc/config/kratos/oidc.google.jsonnet
          
          - id: github
            provider: github
            client_id: $GITHUB_CLIENT_ID
            client_secret: $GITHUB_CLIENT_SECRET
            mapper_url: file:///etc/config/kratos/oidc.github.jsonnet

  flows:
    error:
      ui_url: http://localhost:3000/error
    
    settings:
      ui_url: http://localhost:3000/settings
      privileged_session_max_age: 15m
    
    recovery:
      enabled: true
      ui_url: http://localhost:3000/recovery
      
    verification:
      enabled: true
      ui_url: http://localhost:3000/verification
      
    logout:
      after:
        default_browser_return_url: http://localhost:3000/login
        
    login:
      ui_url: http://localhost:3000/login
      lifespan: 10m
      
    registration:
      lifespan: 10m
      ui_url: http://localhost:3000/registration
      after:
        password:
          hooks:
            - hook: session

hashers:
  argon2:
    parallelism: 1
    memory: 128MB
    iterations: 2
    salt_length: 16
    key_length: 16

identity:
  default_schema_id: default
  schemas:
    - id: default
      url: file:///etc/config/kratos/identity.schema.json

courier:
  smtp:
    connection_uri: smtps://username:password@smtp.example.com:465
```

### Identity Schema

```json
{
  "$id": "https://schemas.ory.sh/presets/kratos/quickstart/email-password/identity.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Person",
  "type": "object",
  "properties": {
    "traits": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "format": "email",
          "title": "E-Mail",
          "ory.sh/kratos": {
            "credentials": {
              "password": {
                "identifier": true
              }
            },
            "verification": {
              "via": "email"
            },
            "recovery": {
              "via": "email"
            }
          }
        },
        "name": {
          "type": "object",
          "properties": {
            "first": {
              "title": "First Name",
              "type": "string"
            },
            "last": {
              "title": "Last Name",
              "type": "string"
            }
          }
        },
        "organization": {
          "type": "string",
          "title": "Organization"
        }
      },
      "required": [
        "email"
      ],
      "additionalProperties": false
    }
  }
}
```

### OIDC Mapper (Jsonnet)

```jsonnet
// oidc.google.jsonnet
local claims = std.extVar('claims');

{
  identity: {
    traits: {
      email: claims.email,
      name: {
        first: claims.given_name,
        last: claims.family_name,
      }
    },
    metadata_public: {
      provider: "google",
      provider_id: claims.sub
    }
  }
}
```

## Multi-Tenant Considerations

### 1. Subdomain Isolation

Configure Kratos to accept return URLs from all tenant subdomains:

```yaml
selfservice:
  allowed_return_urls:
    - https://*.shaman.ai
```

### 2. Organization Assignment

Use identity metadata to track organization membership:

```jsonnet
// Enhanced mapper with org detection
local claims = std.extVar('claims');
local email = claims.email;
local domain = std.split(email, '@')[1];

{
  identity: {
    traits: {
      email: email,
      organization: if domain == "acme.com" then "acme-corp" else "default"
    }
  }
}
```

### 3. Session Cookies

Configure cookies to work across subdomains:

```yaml
session:
  cookie:
    domain: .shaman.ai  # Note the leading dot
    same_site: Lax
    path: /
```

## API Endpoints

Kratos provides two sets of APIs:

### Public API (Port 4433)
- `/self-service/login/browser` - Initialize login flow
- `/self-service/registration/browser` - Initialize registration
- `/sessions/whoami` - Get current session
- `/self-service/logout` - Logout

### Admin API (Port 4434)
- `/admin/identities` - Manage identities
- `/admin/sessions` - Manage sessions
- `/admin/recovery` - Trigger recovery flows

## Environment Variables

```bash
# Kratos Database
KRATOS_DB_HOST=postgres
KRATOS_DB_PORT=5432
KRATOS_DB_NAME=kratos
KRATOS_DB_USER=kratos
KRATOS_DB_PASSWORD=secret

# OIDC Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# SMTP (for email verification/recovery)
SMTP_CONNECTION_URI=smtps://username:password@smtp.example.com:465
```

## Integration with Shaman

### 1. User Creation Flow

```typescript
// When Kratos creates a new identity
kratos.on('identity.created', async (identity) => {
  // Extract org from subdomain or email domain
  const org = determineOrganization(identity);
  
  // Create user in Permiso
  await permiso.createUser({
    id: identity.id,
    orgId: org.id,
    identityProvider: 'kratos',
    identityProviderUserId: identity.id,
    properties: [{
      name: 'email',
      value: identity.traits.email
    }]
  });
  
  // Create local mirror
  await db.createUserMirror({
    permiso_id: identity.id,
    org_id: org.id,
    identity_provider: 'kratos',
    identity_provider_user_id: identity.id
  });
});
```

### 2. Session Validation

```typescript
// API Gateway validates every request
async function validateRequest(req: Request) {
  // Get session from cookie or header
  const session = req.cookies['ory_kratos_session'] || 
                  req.headers['authorization']?.replace('Bearer ', '');
  
  // Validate with Kratos
  const whoami = await kratos.toSession(session);
  if (!whoami.active) {
    throw new UnauthorizedError('Invalid session');
  }
  
  // Get org from subdomain
  const orgId = extractOrgFromSubdomain(req.hostname);
  
  // Verify user belongs to org (via Permiso)
  const hasAccess = await permiso.hasPermission(
    orgId,
    whoami.identity.id,
    `/orgs/${orgId}`,
    'access'
  );
  
  if (!hasAccess) {
    throw new ForbiddenError('No access to organization');
  }
  
  return { identity: whoami.identity, orgId };
}
```

## Security Best Practices

1. **Always use HTTPS** in production
2. **Configure CSRF protection** for all state-changing operations
3. **Set secure session cookies** with appropriate SameSite policies
4. **Implement rate limiting** on auth endpoints
5. **Use strong password policies** via Kratos configuration
6. **Enable MFA** for sensitive organizations
7. **Audit all authentication events**

## References

- [Ory Kratos Documentation](https://www.ory.sh/docs/kratos)
- [Kratos API Reference](https://www.ory.sh/docs/kratos/reference/api)
- [Identity Schema Guide](https://www.ory.sh/docs/kratos/manage-identities/identity-schema)
- [OIDC & OAuth2 Guide](https://www.ory.sh/docs/kratos/social-signin/overview)