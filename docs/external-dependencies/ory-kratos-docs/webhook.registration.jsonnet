// webhook.registration.jsonnet
// This webhook is called after successful registration to sync with Permiso

function(ctx) {
  identity_id: ctx.identity.id,
  identity_traits: ctx.identity.traits,
  identity_schema_id: ctx.identity.schema_id,
  
  // Extract organization from registration context
  organization_id: if std.objectHas(ctx.identity.traits, 'organization') then 
    ctx.identity.traits.organization 
  else 
    'default-org',
  
  // User data for Permiso
  user_data: {
    email: ctx.identity.traits.email,
    name: if std.objectHas(ctx.identity.traits, 'name') then {
      first: ctx.identity.traits.name.first,
      last: ctx.identity.traits.name.last,
    } else null,
    username: if std.objectHas(ctx.identity.traits, 'username') then 
      ctx.identity.traits.username 
    else 
      std.split(ctx.identity.traits.email, '@')[0],
  },
  
  // Metadata
  metadata: {
    provider: if std.objectHas(ctx.identity.metadata_public, 'provider') then 
      ctx.identity.metadata_public.provider 
    else 
      'password',
    registered_at: std.extVar('now'),
    registration_flow_id: ctx.flow.id,
  },
  
  // Event type for Shaman to handle
  event: 'user.registered',
}