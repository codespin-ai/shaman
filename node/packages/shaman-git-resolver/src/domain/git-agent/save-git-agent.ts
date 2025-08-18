import type { GitAgent } from "@codespin/shaman-types";
import type { Database } from "@codespin/shaman-db";
import { mapGitAgentFromDb } from "./mappers/map-git-agent-from-db.js";
import { mapGitAgentToDb } from "./mappers/map-git-agent-to-db.js";
import type { GitAgentDbRow } from "./types.js";

export async function saveGitAgent(
  db: Database,
  agent: Omit<GitAgent, "id" | "createdAt" | "updatedAt">,
): Promise<GitAgent> {
  const dbData = mapGitAgentToDb(agent);
  const result = await db.one<GitAgentDbRow>(
    `INSERT INTO git_agent 
     (agent_repository_id, name, description, version, file_path, model, providers, mcp_servers, allowed_agents, tags, last_modified_commit_hash) 
     VALUES ($(agent_repository_id), $(name), $(description), $(version), $(file_path), $(model), $(providers), $(mcp_servers), $(allowed_agents), $(tags), $(last_modified_commit_hash)) 
     RETURNING *`,
    dbData,
  );
  return mapGitAgentFromDb(result);
}
