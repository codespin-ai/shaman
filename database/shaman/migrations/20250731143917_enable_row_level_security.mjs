/**
 * Enable Row Level Security (RLS) for multi-tenant isolation
 * 
 * This migration:
 * 1. Creates database users for RLS
 * 2. Grants appropriate permissions
 * 3. Enables RLS on tenant-scoped tables
 * 4. Creates security policies
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // Note: User creation requires superuser privileges
  // These may need to be run separately by a DBA in production
  
  // Create users (wrapped in DO block to handle existing users)
  await knex.raw(`
    DO $$
    BEGIN
      -- Create RLS user if not exists
      IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'rls_db_user') THEN
        CREATE USER rls_db_user WITH PASSWORD 'changeme_rls_password';
      END IF;
      
      -- Create unrestricted user if not exists
      IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'unrestricted_db_user') THEN
        CREATE USER unrestricted_db_user WITH PASSWORD 'changeme_admin_password';
      END IF;
    EXCEPTION WHEN duplicate_object THEN
      -- Users already exist, continue
      NULL;
    END $$;
  `);

  // Grant permissions
  await knex.raw(`
    -- Grant schema permissions
    GRANT USAGE ON SCHEMA public TO rls_db_user;
    GRANT ALL ON SCHEMA public TO unrestricted_db_user;
    
    -- Grant table permissions to unrestricted user
    GRANT ALL ON ALL TABLES IN SCHEMA public TO unrestricted_db_user;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO unrestricted_db_user;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO unrestricted_db_user;
    
    -- Grant table permissions to RLS user (will be filtered by policies)
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_db_user;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rls_db_user;
    
    -- Set default privileges for future tables
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT ALL ON TABLES TO unrestricted_db_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rls_db_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
      GRANT USAGE ON SEQUENCES TO rls_db_user;
  `);

  // Enable RLS on tenant-scoped tables
  const tenantTables = [
    'organization',
    'user',
    'organization_user',
    'agent_repository',
    'git_agent',
    'git_credential',
    'external_agent',
    'mcp_server',
    'api_key',
    'run',
    'step',
    'message',
    'tool_call',
    'workflow_data',
    'artifact',
    'audit_log',
    'organization_usage'
  ];

  // Enable RLS on each table
  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  }

  // Create RLS policies
  
  // Organization table - special handling
  await knex.raw(`
    CREATE POLICY organization_isolation ON organization
      FOR ALL
      TO rls_db_user
      USING (
        id = current_setting('app.current_org_id', true)::uuid
        OR id IN (
          SELECT org_id FROM organization_user 
          WHERE user_id = current_setting('app.current_user_id', true)::uuid
        )
      );
  `);

  // User table - see users in same org
  await knex.raw(`
    CREATE POLICY user_isolation ON "user"
      FOR ALL
      TO rls_db_user
      USING (
        current_org_id = current_setting('app.current_org_id', true)::uuid
        OR id = current_setting('app.current_user_id', true)::uuid
      );
  `);

  // Organization-user relationship
  await knex.raw(`
    CREATE POLICY organization_user_isolation ON organization_user
      FOR ALL
      TO rls_db_user
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  `);

  // Direct org_id tables
  const directOrgTables = [
    'agent_repository',
    'external_agent',
    'mcp_server',
    'api_key',
    'run',
    'audit_log',
    'organization_usage'
  ];

  for (const table of directOrgTables) {
    await knex.raw(`
      CREATE POLICY ${table}_isolation ON ${table}
        FOR ALL
        TO rls_db_user
        USING (org_id = current_setting('app.current_org_id', true)::uuid);
    `);
  }

  // Tables that reference agent_repository
  await knex.raw(`
    CREATE POLICY git_agent_isolation ON git_agent
      FOR ALL
      TO rls_db_user
      USING (
        agent_repository_id IN (
          SELECT id FROM agent_repository 
          WHERE org_id = current_setting('app.current_org_id', true)::uuid
        )
      );
  `);

  await knex.raw(`
    CREATE POLICY git_credential_isolation ON git_credential
      FOR ALL
      TO rls_db_user
      USING (
        repository_id IN (
          SELECT id FROM agent_repository 
          WHERE org_id = current_setting('app.current_org_id', true)::uuid
        )
      );
  `);

  // Tables that reference run
  const runReferenceTables = ['step', 'workflow_data', 'artifact'];
  
  for (const table of runReferenceTables) {
    await knex.raw(`
      CREATE POLICY ${table}_isolation ON ${table}
        FOR ALL
        TO rls_db_user
        USING (
          run_id IN (
            SELECT id FROM run 
            WHERE org_id = current_setting('app.current_org_id', true)::uuid
          )
        );
    `);
  }

  // Tables that reference step
  const stepReferenceTables = ['message', 'tool_call'];
  
  for (const table of stepReferenceTables) {
    await knex.raw(`
      CREATE POLICY ${table}_isolation ON ${table}
        FOR ALL
        TO rls_db_user
        USING (
          step_id IN (
            SELECT s.id FROM step s
            JOIN run r ON s.run_id = r.id
            WHERE r.org_id = current_setting('app.current_org_id', true)::uuid
          )
        );
    `);
  }

  // Grant BYPASSRLS to unrestricted user (requires superuser)
  await knex.raw(`
    DO $$
    BEGIN
      ALTER USER unrestricted_db_user BYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Cannot grant BYPASSRLS - requires superuser. unrestricted_db_user will still work but queries will be checked against policies.';
    END $$;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // Drop all policies
  const tenantTables = [
    'organization',
    'user',
    'organization_user',
    'agent_repository',
    'git_agent',
    'git_credential',
    'external_agent',
    'mcp_server',
    'api_key',
    'run',
    'step',
    'message',
    'tool_call',
    'workflow_data',
    'artifact',
    'audit_log',
    'organization_usage'
  ];

  // Drop policies
  for (const table of tenantTables) {
    await knex.raw(`DROP POLICY IF EXISTS ${table}_isolation ON ${table}`);
  }

  // Disable RLS
  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }

  // Revoke permissions
  await knex.raw(`
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rls_db_user;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM rls_db_user;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM rls_db_user;
    REVOKE USAGE ON SCHEMA public FROM rls_db_user;
    
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM unrestricted_db_user;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM unrestricted_db_user;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM unrestricted_db_user;
    REVOKE ALL ON SCHEMA public FROM unrestricted_db_user;
  `);

  // Note: We don't drop users as they might be used elsewhere
  // DBAs can manually drop users if needed:
  // DROP USER IF EXISTS rls_db_user;
  // DROP USER IF EXISTS unrestricted_db_user;
};