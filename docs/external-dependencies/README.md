# External Dependencies

This directory contains documentation for external services that Shaman integrates with or plans to integrate with.

## Active Integrations

### Foreman
- **Status**: ✅ ACTIVELY INTEGRATED
- **Purpose**: Workflow orchestration engine
- **Documentation**: [foreman/](foreman/)
- **Integration Guide**: [foreman/shaman-integration.md](foreman/shaman-integration.md)

Foreman handles all workflow orchestration for Shaman:
- Run and task management
- Queue orchestration with BullMQ
- Run data storage for inter-agent communication
- Status tracking and monitoring

## Planned Integrations

### Permiso
- **Status**: 📋 DOCUMENTED BUT NOT YET INTEGRATED
- **Purpose**: Role-Based Access Control (RBAC) system
- **Documentation**: [permiso/](permiso/)
- **Integration Guide**: [permiso/shaman-integration.md](permiso/shaman-integration.md)

Permiso will provide authorization services:
- Multi-tenant organization management
- User and role management
- Fine-grained permission control
- Resource-based access control

### Ory Kratos
- **Status**: 📋 PLANNED
- **Purpose**: User authentication and identity management
- **Documentation**: [ory-kratos-docs/](ory-kratos-docs/)

Ory Kratos will handle:
- User registration and login
- Multi-factor authentication
- Account recovery
- Session management

## Documentation Structure

Each service directory contains:
- `README.md` - Main documentation (copy of official docs)
- `api.md` - API reference (if applicable)
- `architecture.md` - System design documentation
- `shaman-integration.md` - Shaman-specific integration details
- Additional files as provided by the upstream project

## Updating Documentation

To update external documentation:

1. Copy the latest documentation from the external project
2. Place files in the appropriate directory
3. Update `shaman-integration.md` with any integration changes
4. Note any breaking changes or new features that affect Shaman

The goal is to keep documentation as close to the original as possible to enable easy updates via copy-paste.