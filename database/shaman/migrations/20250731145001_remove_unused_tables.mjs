/**
 * Remove unused tables that were created but never implemented
 * 
 * This migration removes:
 * - mcp_server: MCP integration removed from API design
 * - external_agent: External agents handled via A2A protocol, not stored in DB
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // Drop tables
  await knex.schema.dropTableIfExists('external_agent');
  await knex.schema.dropTableIfExists('mcp_server');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // Recreate mcp_server table
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

  // Recreate external_agent table
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
};