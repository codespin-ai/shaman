/**
 * Rename workflow_data to run_data and job_id to task_id
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  // Rename workflow_data table to run_data
  await knex.schema.renameTable('workflow_data', 'run_data');
  
  // Rename indexes on run_data table
  await knex.raw('ALTER INDEX IF EXISTS idx_workflow_data_run_key RENAME TO idx_run_data_run_key');
  await knex.raw('ALTER INDEX IF EXISTS idx_workflow_data_agent RENAME TO idx_run_data_agent');
  await knex.raw('ALTER INDEX IF EXISTS idx_workflow_data_created RENAME TO idx_run_data_created');
  
  // Rename job_id to task_id in step table
  await knex.schema.alterTable('step', (table) => {
    table.renameColumn('job_id', 'task_id');
  });
  
  // Rename index on step table
  await knex.raw('ALTER INDEX IF EXISTS idx_step_job_id RENAME TO idx_step_task_id');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  // Revert step table changes
  await knex.raw('ALTER INDEX IF EXISTS idx_step_task_id RENAME TO idx_step_job_id');
  
  await knex.schema.alterTable('step', (table) => {
    table.renameColumn('task_id', 'job_id');
  });
  
  // Revert run_data table changes
  await knex.raw('ALTER INDEX IF EXISTS idx_run_data_run_key RENAME TO idx_workflow_data_run_key');
  await knex.raw('ALTER INDEX IF EXISTS idx_run_data_agent RENAME TO idx_workflow_data_agent');
  await knex.raw('ALTER INDEX IF EXISTS idx_run_data_created RENAME TO idx_workflow_data_created');
  
  await knex.schema.renameTable('run_data', 'workflow_data');
};