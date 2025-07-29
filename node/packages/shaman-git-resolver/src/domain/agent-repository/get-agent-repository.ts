import type { AgentRepository } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapAgentRepositoryFromDb } from './mappers/map-agent-repository-from-db.js';
import type { AgentRepositoryDbRow } from './types.js';

export async function getAgentRepository(db: Database, id: number, orgId: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE id = $(id) AND org_id = $(orgId)`,
    { id, orgId }
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}