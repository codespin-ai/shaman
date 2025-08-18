import type { GitAgent } from "@codespin/shaman-types";
import type { GitAgentDbRow } from "../types.js";

/**
 * Map database row to domain type
 */
export function mapGitAgentFromDb(row: GitAgentDbRow): GitAgent {
  return {
    id: row.id,
    agentRepositoryId: row.agent_repository_id,
    name: row.name,
    description: row.description,
    version: row.version,
    filePath: row.file_path,
    model: row.model,
    providers: row.providers as Record<string, unknown> | null,
    mcpServers: row.mcp_servers as Record<string, unknown> | null,
    allowedAgents: row.allowed_agents as string[] | null,
    tags: row.tags as string[] | null,
    lastModifiedCommitHash: row.last_modified_commit_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
