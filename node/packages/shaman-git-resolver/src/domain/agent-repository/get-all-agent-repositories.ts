import type { AgentRepository } from "@codespin/shaman-types";
import type { Database } from "@codespin/shaman-db";
import { mapAgentRepositoryFromDb } from "./mappers/map-agent-repository-from-db.js";
import type { AgentRepositoryDbRow } from "./types.js";

export async function getAllAgentRepositories(
  db: Database,
  orgId: string,
): Promise<AgentRepository[]> {
  const result = await db.any<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE org_id = $(orgId) ORDER BY name`,
    { orgId },
  );
  return result.map(mapAgentRepositoryFromDb);
}
