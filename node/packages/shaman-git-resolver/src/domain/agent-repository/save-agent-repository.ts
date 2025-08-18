import type { AgentRepository } from "@codespin/shaman-types";
import type { Database } from "@codespin/shaman-db";
import { mapAgentRepositoryFromDb } from "./mappers/map-agent-repository-from-db.js";
import { mapAgentRepositoryToDb } from "./mappers/map-agent-repository-to-db.js";
import type { AgentRepositoryDbRow } from "./types.js";

export async function saveAgentRepository(
  db: Database,
  repository: Omit<AgentRepository, "id" | "createdAt" | "updatedAt">,
): Promise<AgentRepository> {
  const dbData = mapAgentRepositoryToDb(repository);
  const result = await db.one<AgentRepositoryDbRow>(
    `INSERT INTO agent_repository 
     (org_id, name, git_url, branch, is_root, last_sync_commit_hash, last_sync_at, last_sync_status, last_sync_errors, created_by) 
     VALUES ($(org_id), $(name), $(git_url), $(branch), $(is_root), $(last_sync_commit_hash), $(last_sync_at), $(last_sync_status), $(last_sync_errors), $(created_by)) 
     RETURNING *`,
    dbData,
  );
  return mapAgentRepositoryFromDb(result);
}
