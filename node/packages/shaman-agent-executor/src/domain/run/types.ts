/**
 * Type definitions for run domain
 */

/**
 * Database row type for run table
 * Mirrors the exact database schema
 */
export type RunDbRow = {
  id: string;
  org_id: string;
  status: string;
  initial_input: string;
  total_cost: number;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  created_by: string;
  trace_id: string | null;
  metadata: unknown;
};