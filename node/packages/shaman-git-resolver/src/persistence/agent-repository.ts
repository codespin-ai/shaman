/**
 * Agent repository (Git repos containing agents) persistence functions
 */

import type { AgentRepository } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';

/**
 * Database row type for agent_repository table
 * Mirrors the exact database schema
 */
type AgentRepositoryDbRow = {
  id: number;
  org_id: string;
  name: string;
  git_url: string;
  branch: string;
  is_root: boolean;
  last_sync_commit_hash: string | null;
  last_sync_at: Date | null;
  last_sync_status: string;
  last_sync_errors: unknown;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

/**
 * Map database row to domain type
 */
function mapAgentRepositoryFromDb(row: AgentRepositoryDbRow): AgentRepository {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    gitUrl: row.git_url,
    branch: row.branch,
    isRoot: row.is_root,
    lastSyncCommitHash: row.last_sync_commit_hash,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as AgentRepository['lastSyncStatus'],
    lastSyncErrors: row.last_sync_errors as Record<string, unknown> | null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map domain type to database row (for inserts/updates)
 */
function mapAgentRepositoryToDb(repo: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'>): Omit<AgentRepositoryDbRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    org_id: repo.orgId,
    name: repo.name,
    git_url: repo.gitUrl,
    branch: repo.branch,
    is_root: repo.isRoot,
    last_sync_commit_hash: repo.lastSyncCommitHash,
    last_sync_at: repo.lastSyncAt,
    last_sync_status: repo.lastSyncStatus,
    last_sync_errors: repo.lastSyncErrors,
    created_by: repo.createdBy
  };
}

export async function saveAgentRepository(
  db: Database,
  repository: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AgentRepository> {
  const dbData = mapAgentRepositoryToDb(repository);
  const result = await db.one<AgentRepositoryDbRow>(
    `INSERT INTO agent_repository 
     (org_id, name, git_url, branch, is_root, last_sync_commit_hash, last_sync_at, last_sync_status, last_sync_errors, created_by) 
     VALUES ($(org_id), $(name), $(git_url), $(branch), $(is_root), $(last_sync_commit_hash), $(last_sync_at), $(last_sync_status), $(last_sync_errors), $(created_by)) 
     RETURNING *`,
    dbData
  );
  return mapAgentRepositoryFromDb(result);
}

export async function getAgentRepository(db: Database, id: number, orgId: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE id = $(id) AND org_id = $(orgId)`,
    { id, orgId }
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

export async function getAgentRepositoryByUrl(db: Database, gitUrl: string, orgId: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE git_url = $(gitUrl) AND org_id = $(orgId)`,
    { gitUrl, orgId }
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

export async function getAgentRepositoryByUrlAndBranch(db: Database, gitUrl: string, branch: string, orgId: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE git_url = $(gitUrl) AND branch = $(branch) AND org_id = $(orgId)`,
    { gitUrl, branch, orgId }
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

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

export async function deleteAgentRepository(db: Database, id: number): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM agent_repository WHERE id = $(id)',
    { id }
  );
  return result.rowCount > 0;
}

export async function getAllAgentRepositories(db: Database, orgId: string): Promise<AgentRepository[]> {
  const result = await db.any<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE org_id = $(orgId) ORDER BY name`,
    { orgId }
  );
  return result.map(mapAgentRepositoryFromDb);
}