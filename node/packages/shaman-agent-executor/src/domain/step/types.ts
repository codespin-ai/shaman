/**
 * Type definitions for step domain
 */

/**
 * Database row type for step table
 * Mirrors the exact database schema
 */
export type StepDbRow = {
  id: string;
  run_id: string;
  parent_step_id: string | null;
  type: string;
  status: string;
  agent_name: string | null;
  agent_source: string | null;
  input: string | null;
  output: string | null;
  error: string | null;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  tool_name: string | null;
  tool_call_id: string | null;
  messages: unknown;
  metadata: unknown;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost: number | null;
};