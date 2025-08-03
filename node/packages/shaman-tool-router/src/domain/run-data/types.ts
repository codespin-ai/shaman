/**
 * Type definitions for run data domain
 */

/**
 * Database row type for run_data table
 * Mirrors the exact database schema
 */
export type RunDataDbRow = {
  id: string;
  run_id: string;
  key: string;
  value: unknown;
  created_by_step_id: string;
  created_by_agent_name: string;
  created_by_agent_source: string;
  created_at: Date;
};