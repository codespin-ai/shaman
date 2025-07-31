# Database Schema Documentation

## Overview

Shaman uses PostgreSQL as its primary database with a multi-tenant architecture. The database design follows these principles:

- **Multi-tenancy**: All data is isolated by organization using Row Level Security (RLS)
- **Decentralized Persistence**: Each package manages its own data access layer
- **Snake Case**: All table and column names use `snake_case`
- **Audit Fields**: All tables include `created_at` and `updated_at` timestamps
- **UUID Primary Keys**: Most tables use UUID for primary keys

## Database Architecture

### Connection Management

Database connections are managed by the `@codespin/shaman-db` package, which exports:
- `createRlsDb(orgId)`: Creates an org-scoped connection with RLS enabled
- `createUnrestrictedDb()`: Creates an admin connection without RLS
- `getDb()`: DEPRECATED - Returns legacy database connection
- `getDatabaseConnection(dbName)`: Returns a specific database connection

### Persistence Pattern

Each package that needs database access implements its own persistence layer:
- `shaman-git-resolver` → `src/persistence/` (agent-repository.ts, git-agent.ts)
- `shaman-agent-executor` → `src/persistence/` (run.ts, step.ts)
- `shaman-tool-router` → `src/persistence/` (workflow-data.ts)

All persistence functions follow this pattern:
```typescript
export async function saveEntity(
  db: Database,  // First parameter is always the database connection
  data: EntityData
): Promise<Entity> {
  // Implementation - no manual org filtering needed with RLS
}
```

### Row Level Security (RLS)

All tenant-scoped tables have RLS policies that automatically filter by organization:
- Policies use `app.current_org_id` session variable
- The RLS wrapper automatically sets this before each query
- No manual WHERE clauses needed for org isolation

## Core Tables

### Organization & Multi-tenancy

#### organization
Primary tenant entity for multi-tenant isolation.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | varchar(255) | Organization display name |
| slug | varchar(255) | URL-friendly identifier (unique) |
| description | text | Organization description |
| settings | jsonb | Organization settings (default: {}) |
| subscription_info | jsonb | Subscription details |
| created_by | uuid | User who created the org |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

#### user
System users who can belong to multiple organizations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | varchar(255) | User email (unique) |
| name | varchar(255) | User display name |
| is_active | boolean | Account active status |
| system_role | varchar(50) | USER or SYSTEM_ADMIN |
| current_org_id | uuid | Current organization context |
| last_login_at | timestamptz | Last login timestamp |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

#### organization_user
Junction table for user-organization relationships.

| Column | Type | Description |
|--------|------|-------------|
| org_id | uuid | Organization ID (PK) |
| user_id | uuid | User ID (PK) |
| role | varchar(50) | OWNER, ADMIN, DEVELOPER, VIEWER |
| permissions | jsonb | Additional permissions array |
| joined_at | timestamptz | When user joined org |

### Agent Management

#### agent_repository
Git repositories containing agent definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| org_id | uuid | Organization ID |
| name | varchar(255) | Repository name (unique per org) |
| git_url | varchar(1024) | Git repository URL |
| branch | varchar(255) | Git branch |
| is_root | boolean | Whether to scan from root |
| agent_directory | varchar(255) | Directory containing agents |
| last_sync_commit_hash | varchar(255) | Last synced commit |
| last_sync_at | timestamptz | Last sync timestamp |
| last_sync_status | varchar(50) | success/failure/in_progress |
| last_sync_errors | jsonb | Sync error details |
| created_by | uuid | User who added the repo |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

#### git_agent
Individual agents discovered from Git repositories.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| agent_repository_id | integer | Repository ID |
| name | varchar(255) | Agent name |
| description | text | Agent description |
| file_path | varchar(1024) | Path within repository |
| content_hash | varchar(255) | MD5 hash of content |
| frontmatter | jsonb | Parsed YAML frontmatter |
| is_active | boolean | Whether agent is active |
| tags | text[] | Agent tags |
| last_modified_commit_hash | varchar(255) | Commit that last modified |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

#### git_credential
Stores encrypted Git authentication tokens for private repositories.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| repository_id | integer | FK to agent_repository |
| provider | varchar(50) | Git provider (github, gitlab, etc) |
| username | varchar(255) | Git username |
| encrypted_token | text | Encrypted personal access token |
| token_name | varchar(255) | Optional token name |
| expires_at | timestamptz | Token expiration date |
| last_used_at | timestamptz | Last usage timestamp |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

#### external_agent (REMOVED)
**Note**: External agents are now discovered via the A2A protocol at runtime, not stored in the database. Agent discovery happens through A2A endpoint calls.
| last_health_check_at | timestamptz | Last health check |
| average_response_time | float | Performance metric |
| error_rate | float | Error rate percentage |
| created_by | uuid | User who added agent |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### Workflow Execution

#### run
Top-level workflow execution instances.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| agent_name | varchar(255) | Agent being executed |
| session_id | varchar(255) | Session identifier |
| parent_run_id | uuid | Parent run (for nested) |
| call_stack | text[] | Agent call hierarchy |
| initial_prompt | text | Starting prompt |
| status | varchar(50) | RUNNING/COMPLETED/FAILED |
| error_message | text | Error details if failed |
| created_by | uuid | User who started run |
| created_at | timestamptz | Start timestamp |
| completed_at | timestamptz | Completion timestamp |

#### step
Individual steps within a workflow run.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| run_id | uuid | Parent run ID |
| sequence_number | integer | Step order |
| type | varchar(50) | Step type |
| input | jsonb | Step input data |
| output | jsonb | Step output data |
| status | varchar(50) | Step status |
| error_message | text | Error if failed |
| started_at | timestamptz | Start timestamp |
| completed_at | timestamptz | Completion timestamp |
| metadata | jsonb | Additional metadata |

#### workflow_data
Immutable data storage for agent collaboration.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| run_id | uuid | Associated run |
| step_id | uuid | Step that created data |
| key | varchar(255) | Data key |
| value | jsonb | Data value |
| data_type | varchar(50) | Type hint |
| tags | text[] | Data tags |
| created_by_agent | varchar(255) | Agent that created |
| created_at | timestamptz | Creation timestamp |

#### input_request
Tracks requests for user input during execution.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| run_id | uuid | Associated run |
| step_id | uuid | Requesting step |
| request_type | varchar(50) | Type of input needed |
| prompt | text | Prompt for user |
| schema | jsonb | Expected input schema |
| response | jsonb | User's response |
| responded_by | uuid | User who responded |
| requested_at | timestamptz | Request timestamp |
| responded_at | timestamptz | Response timestamp |

### Tool & Integration Management

#### mcp_server (REMOVED)
**Note**: MCP servers are now configured in agent YAML frontmatter within Git repositories. This allows MCP configuration to be versioned alongside agent code.
| last_health_check_at | timestamptz | Last health check |
| created_by | uuid | User who added server |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### Usage & Analytics

#### organization_usage
Tracks organization resource usage for billing.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization ID |
| period_start | timestamptz | Billing period start |
| period_end | timestamptz | Billing period end |
| total_runs | integer | Total executions |
| total_cost | decimal(10,4) | Total cost |
| total_tokens | bigint | Total LLM tokens used |
| runs_by_status | jsonb | Run count by status |
| usage_details | jsonb | Detailed usage metrics |

## Indexes

Key indexes for performance:

- `organization.slug` - Unique organization lookups
- `user.email` - User authentication
- `agent_repository.org_id` - Multi-tenant queries
- `git_agent.agent_repository_id` - Agent lookups
- `run.org_id` - Organization run queries
- `run.session_id` - Session-based queries
- `workflow_data.run_id` - Data lookups by run
- `workflow_data.key` - Data lookups by key

## Foreign Key Relationships

All foreign keys use CASCADE delete to maintain referential integrity:

- `organization_user` → `organization`, `user`
- `agent_repository` → `organization`, `user` (created_by)
- `git_agent` → `agent_repository`
- `run` → `organization`, `user` (created_by)
- `step` → `run`
- `workflow_data` → `run`, `step`
- `input_request` → `run`, `step`, `user` (responded_by)
- `git_credential` → `agent_repository`
- `organization_usage` → `organization`

## Migration Management

Migrations are managed using Knex.js:
- Located in `/database/shaman/migrations/`
- Run with `npm run migrate:shaman:latest`
- Create new with `npm run migrate:shaman:make migration_name`

## Best Practices

1. **Always include org_id**: All queries must filter by organization
2. **Use transactions**: For multi-table operations
3. **Parameterized queries**: Always use named parameters with pg-promise
4. **Type safety**: Use DbRow types that match exact database schema
5. **Audit fields**: Always set created_at/updated_at appropriately

## Example Queries

### Get all agents for an organization
```sql
SELECT ga.* 
FROM git_agent ga
JOIN agent_repository ar ON ga.agent_repository_id = ar.id
WHERE ar.org_id = $(orgId)
AND ga.is_active = true;
```

### Get workflow data for a run
```sql
SELECT * FROM workflow_data
WHERE run_id = $(runId)
ORDER BY created_at ASC;
```

### Get organization usage for current period
```sql
SELECT * FROM organization_usage
WHERE org_id = $(orgId)
AND period_start <= NOW()
AND period_end > NOW();
```