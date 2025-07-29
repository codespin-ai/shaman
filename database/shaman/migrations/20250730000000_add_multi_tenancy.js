/**
 * Add multi-tenancy support to Shaman
 * 
 * This migration adds the organization table and updates all existing tables
 * to include org_id for tenant isolation.
 */

export const up = async (knex) => {
  // Create organization table
  await knex.schema.createTable("organization", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name", 255).notNullable();
    table.string("slug", 255).notNullable().unique(); // URL-friendly identifier
    table.text("description");
    
    // Settings (JSONB for flexibility)
    table.jsonb("settings").notNullable().defaultTo('{}');
    
    // Subscription info
    table.jsonb("subscription_info");
    
    // Metadata
    table.uuid("created_by").notNullable(); // User ID who created the org
    table.timestamps(true, true);
    
    // Indexes
    table.index("slug", "idx_organization_slug");
    table.index("created_at", "idx_organization_created");
  });

  // Create user table (was referenced but not created before)
  await knex.schema.createTable("user", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("email", 255).notNullable().unique();
    table.string("name", 255).notNullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.string("system_role", 50).defaultTo("USER"); // USER or SYSTEM_ADMIN
    
    // Current organization context (nullable)
    table.uuid("current_org_id");
    
    // Metadata
    table.timestamp("last_login_at", { useTz: true });
    table.timestamps(true, true);
    
    // Indexes
    table.index("email", "idx_user_email");
    table.index("is_active", "idx_user_active");
  });

  // Create organization_user junction table for many-to-many relationship
  await knex.schema.createTable("organization_user", (table) => {
    table.uuid("org_id").notNullable();
    table.uuid("user_id").notNullable();
    table.string("role", 50).notNullable(); // OWNER, ADMIN, DEVELOPER, VIEWER
    table.jsonb("permissions").defaultTo('[]'); // Additional fine-grained permissions
    table.timestamp("joined_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    // Composite primary key
    table.primary(["org_id", "user_id"]);
    
    // Foreign keys
    table.foreign("org_id").references("id").inTable("organization").onDelete("CASCADE");
    table.foreign("user_id").references("id").inTable("user").onDelete("CASCADE");
    
    // Indexes
    table.index("user_id", "idx_org_user_user");
    table.index("role", "idx_org_user_role");
  });

  // Add foreign key for current organization
  await knex.schema.alterTable("user", (table) => {
    table.foreign("current_org_id").references("id").inTable("organization").onDelete("SET NULL");
  });

  // Update agent_repository table
  await knex.schema.alterTable("agent_repository", (table) => {
    table.uuid("org_id").notNullable();
    table.uuid("created_by").notNullable();
    
    // Add foreign keys
    table.foreign("org_id").references("id").inTable("organization").onDelete("CASCADE");
    table.foreign("created_by").references("id").inTable("user");
    
    // Update unique constraint to include organization
    table.dropUnique(["name"]);
    table.unique(["org_id", "name"]);
    
    // Add index
    table.index("org_id", "idx_agent_repo_org");
  });

  // Update git_agent table - no changes needed as it's linked through agent_repository

  // Update run table
  await knex.schema.alterTable("run", (table) => {
    table.uuid("org_id").notNullable();
    
    // Change created_by to UUID
    table.dropColumn("created_by");
    table.uuid("created_by").notNullable();
    
    // Add foreign keys
    table.foreign("org_id").references("id").inTable("organization").onDelete("CASCADE");
    table.foreign("created_by").references("id").inTable("user");
    
    // Add index
    table.index("org_id", "idx_run_org");
  });

  // Update step table - no changes needed as it's linked through run

  // Update workflow_data table - no changes needed as it's linked through run

  // Update input_request table
  await knex.schema.alterTable("input_request", (table) => {
    // Change responded_by to UUID
    table.dropColumn("responded_by");
    table.uuid("responded_by");
    
    // Add foreign key
    table.foreign("responded_by").references("id").inTable("user");
  });

  // Create mcp_server table (referenced in schema but not created before)
  await knex.schema.createTable("mcp_server", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable();
    table.string("name", 255).notNullable();
    table.text("description");
    table.string("type", 50).notNullable(); // HTTP, STDIO, A2A
    table.string("endpoint", 1024).notNullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.jsonb("auth_config"); // Authentication configuration
    
    // Access control
    table.jsonb("allowed_roles").defaultTo('[]');
    table.jsonb("allowed_users").defaultTo('[]');
    
    // Health check
    table.string("health_status", 50);
    table.timestamp("last_health_check_at", { useTz: true });
    
    // Metadata
    table.uuid("created_by").notNullable();
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign("org_id").references("id").inTable("organization").onDelete("CASCADE");
    table.foreign("created_by").references("id").inTable("user");
    
    // Unique constraint
    table.unique(["org_id", "name"]);
    
    // Indexes
    table.index("org_id", "idx_mcp_server_org");
    table.index("is_active", "idx_mcp_server_active");
  });

  // Create external_agent table for A2A agents
  await knex.schema.createTable("external_agent", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable();
    table.string("name", 255).notNullable();
    table.text("description");
    table.string("endpoint", 1024).notNullable();
    table.string("auth_type", 50).notNullable();
    table.jsonb("auth_credentials"); // Encrypted credentials
    table.boolean("is_active").notNullable().defaultTo(true);
    
    // Agent details
    table.jsonb("agent_card"); // A2A agent card
    table.jsonb("skills"); // Agent capabilities
    
    // Health monitoring
    table.string("health_status", 50);
    table.timestamp("last_health_check_at", { useTz: true });
    table.float("average_response_time");
    table.float("error_rate");
    
    // Metadata
    table.uuid("created_by").notNullable();
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign("org_id").references("id").inTable("organization").onDelete("CASCADE");
    table.foreign("created_by").references("id").inTable("user");
    
    // Unique constraint
    table.unique(["org_id", "name"]);
    
    // Indexes
    table.index("org_id", "idx_external_agent_org");
    table.index("is_active", "idx_external_agent_active");
  });

  // Create organization_usage table for tracking
  await knex.schema.createTable("organization_usage", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("org_id").notNullable();
    table.timestamp("period_start", { useTz: true }).notNullable();
    table.timestamp("period_end", { useTz: true }).notNullable();
    table.integer("total_runs").defaultTo(0);
    table.decimal("total_cost", 10, 4).defaultTo(0);
    table.bigInteger("total_tokens").defaultTo(0);
    table.jsonb("runs_by_status").defaultTo('{}');
    table.jsonb("usage_details").defaultTo('{}');
    
    // Foreign key
    table.foreign("org_id").references("id").inTable("organization").onDelete("CASCADE");
    
    // Unique constraint for period
    table.unique(["org_id", "period_start", "period_end"]);
    
    // Indexes
    table.index("org_id", "idx_org_usage_org");
    table.index(["period_start", "period_end"], "idx_org_usage_period");
  });
};

export const down = async (knex) => {
  // Drop tables in reverse order of creation
  await knex.schema.dropTableIfExists("organization_usage");
  await knex.schema.dropTableIfExists("external_agent");
  await knex.schema.dropTableIfExists("mcp_server");
  
  // Remove multi-tenancy from existing tables
  await knex.schema.alterTable("input_request", (table) => {
    table.dropForeign(["responded_by"]);
    table.dropColumn("responded_by");
    table.string("responded_by", 255);
  });
  
  await knex.schema.alterTable("run", (table) => {
    table.dropForeign(["org_id"]);
    table.dropForeign(["created_by"]);
    table.dropColumn("org_id");
    table.dropColumn("created_by");
    table.string("created_by", 255).notNullable();
  });
  
  await knex.schema.alterTable("agent_repository", (table) => {
    table.dropForeign(["org_id"]);
    table.dropForeign(["created_by"]);
    table.dropUnique(["org_id", "name"]);
    table.dropIndex([], "idx_agent_repo_org");
    table.dropColumn("org_id");
    table.dropColumn("created_by");
    table.unique(["name"]);
  });
  
  // Drop user-related tables
  await knex.schema.alterTable("user", (table) => {
    table.dropForeign(["current_org_id"]);
  });
  await knex.schema.dropTableIfExists("organization_user");
  await knex.schema.dropTableIfExists("user");
  await knex.schema.dropTableIfExists("organization");
};