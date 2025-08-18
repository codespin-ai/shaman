/**
 * Type definitions for git agent domain
 */

/**
 * Database row type for git_agent table
 * Mirrors the exact database schema
 */
export type GitAgentDbRow = {
  id: number;
  agent_repository_id: number;
  name: string;
  description: string | null;
  version: string | null;
  file_path: string;
  model: string | null;
  providers: unknown;
  mcp_servers: unknown;
  allowed_agents: unknown;
  tags: unknown;
  last_modified_commit_hash: string | null;
  created_at: Date;
  updated_at: Date;
};
