
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // Run table (workflow instances)
  await knex.schema.createTable("run", (table) => {
    table.string("id", 255).primary();
    table.string("status", 50).notNullable();
    table.text("initial_input").notNullable();
    table.decimal("total_cost", 10, 4).defaultTo(0);
    table.timestamp("start_time", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("end_time", { useTz: true });
    table.integer("duration"); // in milliseconds
    table.string("created_by", 255).notNullable(); // User ID
    table.string("trace_id", 255);
    table.jsonb("metadata");
    
    table.index("status", "idx_run_status");
    table.index("created_by", "idx_run_created_by");
    table.index("start_time", "idx_run_start_time");
  });

  // Step table (execution units within a run)
  await knex.schema.createTable("step", (table) => {
    table.string("id", 255).primary();
    table.string("run_id", 255).notNullable();
    table.string("parent_step_id", 255);
    table.string("type", 50).notNullable(); // agent_execution, llm_call, tool_call, agent_call
    table.string("status", 50).notNullable();
    table.string("agent_name", 255);
    table.string("agent_source", 50); // GIT, A2A_EXTERNAL
    table.text("input");
    table.text("output");
    table.text("error");
    table.timestamp("start_time", { useTz: true });
    table.timestamp("end_time", { useTz: true });
    table.integer("duration"); // in milliseconds
    table.integer("prompt_tokens");
    table.integer("completion_tokens");
    table.decimal("cost", 10, 6);
    table.string("tool_name", 255);
    table.string("tool_call_id", 255);
    table.jsonb("messages"); // Array of message objects
    table.jsonb("metadata");
    
    table.foreign("run_id").references("id").inTable("run").onDelete("CASCADE");
    table.foreign("parent_step_id").references("id").inTable("step");
    
    table.index("run_id", "idx_step_run_id");
    table.index("parent_step_id", "idx_step_parent");
    table.index("status", "idx_step_status");
    table.index("agent_name", "idx_step_agent");
  });

  // Workflow data table (immutable data storage for agent collaboration)
  await knex.schema.createTable("workflow_data", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("run_id", 255).notNullable();
    table.string("key", 255).notNullable();
    table.jsonb("value").notNullable();
    table.string("created_by_step_id", 255).notNullable();
    table.string("created_by_agent_name", 255).notNullable();
    table.string("created_by_agent_source", 50).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    
    table.foreign("run_id").references("id").inTable("run").onDelete("CASCADE");
    table.foreign("created_by_step_id").references("id").inTable("step");
    
    table.index(["run_id", "key"], "idx_workflow_data_run_key");
    table.index(["run_id", "created_by_agent_name"], "idx_workflow_data_agent");
    table.index("created_at", "idx_workflow_data_created");
  });

  // Input request table
  await knex.schema.createTable("input_request", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("run_id", 255).notNullable();
    table.string("step_id", 255).notNullable();
    table.text("prompt").notNullable();
    table.string("input_type", 50).notNullable(); // TEXT, CHOICE, FILE, APPROVAL, STRUCTURED_DATA
    table.jsonb("choices"); // Array of choices for CHOICE type
    table.boolean("required").notNullable().defaultTo(true);
    table.timestamp("requested_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("timeout_at", { useTz: true });
    table.jsonb("metadata");
    
    // Response fields (filled when user responds)
    table.text("user_response");
    table.timestamp("response_at", { useTz: true });
    table.string("responded_by", 255); // User ID
    
    table.foreign("run_id").references("id").inTable("run").onDelete("CASCADE");
    table.foreign("step_id").references("id").inTable("step");
    
    table.index("run_id", "idx_input_request_run");
    table.index("step_id", "idx_input_request_step");
    table.index(["run_id", "response_at"], "idx_input_request_pending");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // Drop tables in reverse order to respect foreign key constraints
  await knex.schema.dropTableIfExists("input_request");
  await knex.schema.dropTableIfExists("workflow_data");
  await knex.schema.dropTableIfExists("step");
  await knex.schema.dropTableIfExists("run");
};
