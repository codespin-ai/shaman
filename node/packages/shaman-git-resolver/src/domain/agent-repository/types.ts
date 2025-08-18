/**
 * Type definitions for agent repository domain
 */

/**
 * Database row type for agent_repository table
 * Mirrors the exact database schema
 */
export type AgentRepositoryDbRow = {
  id: number;
  org_id: string;
  name: string;
  git_url: string;
  branch: string;
  is_root: boolean;
  last_sync_commit_hash: string | null;
  last_sync_at: Date | null;
  last_sync_status: string;
  last_sync_errors: unknown;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};
