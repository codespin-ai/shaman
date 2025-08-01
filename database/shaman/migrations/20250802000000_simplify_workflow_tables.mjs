/**
 * Simplify workflow tables to match unified architecture
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // Add missing columns to run table
  await knex.schema.alterTable("run", (table) => {
    table.string("organization_id", 100).notNullable().defaultTo('default');
    table.text("final_output");
    table.string("created_by_type", 20); // user, api_key, system
    table.integer("total_steps").defaultTo(0);
    table.integer("total_tokens_used").defaultTo(0);
    table.timestamps(true, true); // created_at, updated_at
  });

  // Simplify step table - change type to step_type with only 'agent' and 'tool'
  await knex.schema.alterTable("step", (table) => {
    table.renameColumn("type", "step_type");
    
    // Add missing columns for async operations
    table.string("job_id", 100); // BullMQ job ID
    table.string("webhook_id", 100).unique(); // For webhook callbacks
    table.string("async_id", 100); // For A2A task IDs or other async identifiers
    table.string("name", 255); // Unified name field for agent or tool name
    table.integer("retry_count").defaultTo(0);
    table.timestamps(true, true); // created_at, updated_at
  });

  // Add indexes for new columns
  await knex.schema.alterTable("step", (table) => {
    table.index("job_id", "idx_step_job_id");
    table.index("webhook_id", "idx_step_webhook_id");
    table.index("step_type", "idx_step_type");
  });

  // Add message history table for conversation tracking
  await knex.schema.createTable("message", (table) => {
    table.increments("id").primary();
    table.string("step_id", 255).notNullable();
    table.string("role", 20).notNullable(); // user, assistant, system, tool
    table.text("content");
    table.string("tool_call_id", 100); // For tool messages
    table.integer("sequence_number").notNullable();
    table.integer("tokens_used");
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    
    table.foreign("step_id").references("id").inTable("step").onDelete("CASCADE");
    table.unique(["step_id", "sequence_number"]);
    table.index("step_id", "idx_message_step");
  });

  // Add tool execution tracking table
  await knex.schema.createTable("tool_execution", (table) => {
    table.string("id", 26).primary();
    table.string("step_id", 255).notNullable();
    table.string("tool_call_id", 100).notNullable();
    table.string("tool_name", 255).notNullable();
    table.string("tool_type", 50).notNullable(); // platform, mcp, agent_call
    table.string("status", 20).notNullable(); // pending, running, completed, failed
    table.jsonb("input").notNullable();
    table.jsonb("output");
    table.text("error");
    table.timestamp("start_time", { useTz: true });
    table.timestamp("end_time", { useTz: true });
    table.integer("duration");
    table.jsonb("metadata").defaultTo('{}');
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    
    table.foreign("step_id").references("id").inTable("step").onDelete("CASCADE");
    table.index("step_id", "idx_tool_execution_step");
    table.index("status", "idx_tool_execution_status");
  });

  // Add organization index to run table
  await knex.schema.alterTable("run", (table) => {
    table.index("organization_id", "idx_run_organization");
  });

  // Add constraint to step_type
  await knex.raw(`
    ALTER TABLE step 
    ADD CONSTRAINT check_step_type 
    CHECK (step_type IN ('agent', 'tool'))
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // Remove constraint
  await knex.raw(`
    ALTER TABLE step 
    DROP CONSTRAINT IF EXISTS check_step_type
  `);

  // Drop new tables
  await knex.schema.dropTableIfExists("tool_execution");
  await knex.schema.dropTableIfExists("message");

  // Remove new indexes
  await knex.schema.alterTable("step", (table) => {
    table.dropIndex("job_id", "idx_step_job_id");
    table.dropIndex("webhook_id", "idx_step_webhook_id");
    table.dropIndex("step_type", "idx_step_type");
  });

  await knex.schema.alterTable("run", (table) => {
    table.dropIndex("organization_id", "idx_run_organization");
  });

  // Revert step table changes
  await knex.schema.alterTable("step", (table) => {
    table.renameColumn("step_type", "type");
    table.dropColumn("job_id");
    table.dropColumn("webhook_id");
    table.dropColumn("async_id");
    table.dropColumn("name");
    table.dropColumn("retry_count");
    table.dropTimestamps();
  });

  // Revert run table changes
  await knex.schema.alterTable("run", (table) => {
    table.dropColumn("organization_id");
    table.dropColumn("final_output");
    table.dropColumn("created_by_type");
    table.dropColumn("total_steps");
    table.dropColumn("total_tokens_used");
    table.dropTimestamps();
  });
};