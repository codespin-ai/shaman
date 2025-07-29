import type { AgentRepository } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapAgentRepositoryFromDb } from './mappers/map-agent-repository-from-db.js';
import type { AgentRepositoryDbRow } from './types.js';

export async function updateAgentRepository(db: Database, repository: AgentRepository): Promise<AgentRepository> {
  const result = await db.one<AgentRepositoryDbRow>(
    `UPDATE agent_repository 
     SET name = $(name), git_url = $(gitUrl), branch = $(branch), is_root = $(isRoot), 
         last_sync_commit_hash = $(lastSyncCommitHash), last_sync_at = $(lastSyncAt), last_sync_status = $(lastSyncStatus), last_sync_errors = $(lastSyncErrors),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $(id)
     RETURNING *`,
    repository
  );
  return mapAgentRepositoryFromDb(result);
}