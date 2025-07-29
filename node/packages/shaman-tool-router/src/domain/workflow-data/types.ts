/**
 * Type definitions for workflow data domain
 */

/**
 * Database row type for workflow_data table
 * Mirrors the exact database schema
 */
export type WorkflowDataDbRow = {
  id: string;
  run_id: string;
  key: string;
  value: unknown;
  created_by_step_id: string;
  created_by_agent_name: string;
  created_by_agent_source: string;
  created_at: Date;
};