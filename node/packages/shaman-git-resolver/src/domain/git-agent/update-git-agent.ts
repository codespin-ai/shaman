import type { GitAgent } from "@codespin/shaman-types";
import type { Database } from "@codespin/shaman-db";
import { mapGitAgentFromDb } from "./mappers/map-git-agent-from-db.js";
import type { GitAgentDbRow } from "./types.js";

export async function updateGitAgent(
  db: Database,
  agent: GitAgent,
): Promise<GitAgent> {
  const result = await db.one<GitAgentDbRow>(
    `UPDATE git_agent 
     SET agent_repository_id = $(agentRepositoryId), name = $(name), description = $(description), version = $(version), file_path = $(filePath), 
         model = $(model), providers = $(providers), mcp_servers = $(mcpServers), allowed_agents = $(allowedAgents), tags = $(tags), 
         last_modified_commit_hash = $(lastModifiedCommitHash), updated_at = CURRENT_TIMESTAMP
     WHERE id = $(id)
     RETURNING *`,
    agent,
  );
  return mapGitAgentFromDb(result);
}
