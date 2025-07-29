/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable("agent_repository", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable().unique();
    table.string("git_url").notNullable();
    table.string("branch").notNullable();
    table.boolean("is_root").notNullable().defaultTo(false);
    table.string("last_sync_commit_hash", 40);
    table.timestamp("last_sync_at", { useTz: true });
    table.string("last_sync_status").notNullable().defaultTo("NEVER_SYNCED");
    table.jsonb("last_sync_errors");
    table.timestamps(true, true); // creates created_at and updated_at with timezone
  });

  await knex.schema.createTable("git_agent", (table) => {
    table.increments("id").primary();
    table.integer("agent_repository_id").unsigned().notNullable();
    table.string("name").notNullable();
    table.text("description");
    table.string("version");
    table.string("file_path", 1024).notNullable();

    // Agent configuration from frontmatter
    table.string("model");
    table.jsonb("providers");
    table.jsonb("mcp_servers");
    table.jsonb("allowed_agents");
    table.jsonb("tags");

    // Git metadata for traceability
    table.string("last_modified_commit_hash", 40);

    table.timestamps(true, true);

    table
      .foreign("agent_repository_id")
      .references("id")
      .inTable("agent_repository") // Corrected to singular
      .onDelete("CASCADE");
    
    table.unique(["agent_repository_id", "file_path"]);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Drop in reverse order of creation to respect foreign key constraints
  await knex.schema.dropTableIfExists("git_agent");
  await knex.schema.dropTableIfExists("agent_repository");
}
