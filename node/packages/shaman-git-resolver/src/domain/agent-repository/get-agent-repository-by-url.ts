import type { AgentRepository } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapAgentRepositoryFromDb } from './mappers/map-agent-repository-from-db.js';
import type { AgentRepositoryDbRow } from './types.js';

export async function getAgentRepositoryByUrl(db: Database, gitUrl: string, orgId: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE git_url = $(gitUrl) AND org_id = $(orgId)`,
    { gitUrl, orgId }
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}