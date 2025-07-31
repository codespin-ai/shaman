local claims = std.extVar('claims');
local email = if std.objectHas(claims, 'email') then claims.email else error 'email claim missing';
local email_verified = if std.objectHas(claims, 'email_verified') then claims.email_verified else false;

// Extract organization from email domain or subdomain context
local email_parts = std.split(email, '@');
local domain = if std.length(email_parts) > 1 then email_parts[1] else null;

// Map common domains to organizations (can be customized)
local org_mapping = {
  'acme.com': 'acme-corp',
  'partner.com': 'partner-org',
  'example.com': 'example-org',
};

local organization = if domain != null && std.objectHas(org_mapping, domain) then
  org_mapping[domain]
else
  'default-org';

{
  identity: {
    traits: {
      email: email,
      name: {
        first: if std.objectHas(claims, 'given_name') then claims.given_name else null,
        last: if std.objectHas(claims, 'family_name') then claims.family_name else null,
      },
      username: std.split(email, '@')[0],  // Use email prefix as default username
      organization: organization,
      profile: {
        avatar_url: if std.objectHas(claims, 'picture') then claims.picture else null,
        locale: if std.objectHas(claims, 'locale') then claims.locale else 'en-US',
      },
      preferences: {
        theme: 'system',
        notifications: {
          email: true,
          workflow_updates: true,
          agent_errors: true,
        },
      },
    },
    metadata_public: {
      provider: 'google',
      provider_id: claims.sub,
      email_verified: email_verified,
      registered_at: std.extVar('now'),
    },
    metadata_admin: {
      google_claims: claims,
    },
  },
}