import type { GitAgent } from "@codespin/shaman-types";
import type { Database } from "@codespin/shaman-db";
import { mapGitAgentFromDb } from "./mappers/map-git-agent-from-db.js";
import type { GitAgentDbRow } from "./types.js";

export async function getGitAgentsByRepositoryId(
  db: Database,
  agentRepositoryId: number,
): Promise<GitAgent[]> {
  const result = await db.any<GitAgentDbRow>(
    `SELECT * FROM git_agent WHERE agent_repository_id = $(agentRepositoryId)`,
    { agentRepositoryId },
  );
  return result.map(mapGitAgentFromDb);
}
