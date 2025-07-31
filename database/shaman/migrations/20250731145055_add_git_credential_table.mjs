/**
 * Add git_credential table for storing Git authentication tokens
 * 
 * This table stores encrypted Personal Access Tokens (PATs) for Git repositories
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable("git_credential", (table) => {
    table.increments("id").primary();
    table.integer("repository_id").notNullable();
    table.string("provider", 50).notNullable(); // github, gitlab, bitbucket, etc.
    table.string("username", 255).notNullable(); // Git username
    table.text("encrypted_token").notNullable(); // Encrypted PAT
    table.string("token_name", 255); // Optional name for the token
    table.timestamp("expires_at", { useTz: true }); // Token expiration
    table.timestamp("last_used_at", { useTz: true }); // Track usage
    table.timestamps(true, true);
    
    // Foreign key
    table.foreign("repository_id").references("id").inTable("agent_repository").onDelete("CASCADE");
    
    // Indexes
    table.index("repository_id", "idx_git_credential_repo");
    table.index("provider", "idx_git_credential_provider");
    
    // Unique constraint - one credential per repository
    table.unique(["repository_id"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTableIfExists("git_credential");
};