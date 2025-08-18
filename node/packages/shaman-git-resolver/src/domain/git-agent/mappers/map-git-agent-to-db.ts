import type { GitAgent } from "@codespin/shaman-types";
import type { GitAgentDbRow } from "../types.js";

/**
 * Map domain type to database row (for inserts/updates)
 */
export function mapGitAgentToDb(
  agent: Omit<GitAgent, "id" | "createdAt" | "updatedAt">,
): Omit<GitAgentDbRow, "id" | "created_at" | "updated_at"> {
  return {
    agent_repository_id: agent.agentRepositoryId,
    name: agent.name,
    description: agent.description,
    version: agent.version ?? null,
    file_path: agent.filePath,
    model: agent.model ?? null,
    providers: agent.providers ?? null,
    mcp_servers: agent.mcpServers ?? null,
    allowed_agents: agent.allowedAgents ?? null,
    tags: agent.tags,
    last_modified_commit_hash: agent.lastModifiedCommitHash,
  };
}
