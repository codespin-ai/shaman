import { AgentRepository } from '@codespin/shaman-types';
import { db } from './db.js';

export async function saveAgentRepository(repository: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentRepository> {
  const result = await db.one(
    `INSERT INTO agent_repository (name, git_url, branch, is_root, last_sync_commit_hash, last_sync_at, last_sync_status, last_sync_errors) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING id, name, git_url as "gitUrl", branch, is_root as "isRoot", 
               last_sync_commit_hash as "lastSyncCommitHash", last_sync_at as "lastSyncAt", 
               last_sync_status as "lastSyncStatus", last_sync_errors as "lastSyncErrors",
               created_at as "createdAt", updated_at as "updatedAt"`,
    [repository.name, repository.gitUrl, repository.branch, repository.isRoot, 
     repository.lastSyncCommitHash, repository.lastSyncAt, repository.lastSyncStatus, repository.lastSyncErrors]
  );
  return result;
}

export async function getAgentRepository(id: number): Promise<AgentRepository | null> {
  const result = await db.oneOrNone(
    `SELECT id, name, git_url as "gitUrl", branch, is_root as "isRoot", 
            last_sync_commit_hash as "lastSyncCommitHash", last_sync_at as "lastSyncAt", 
            last_sync_status as "lastSyncStatus", last_sync_errors as "lastSyncErrors",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM agent_repository WHERE id = $1`,
    [id]
  );
  return result;
}

export async function getAgentRepositoryByUrl(gitUrl: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone(
    `SELECT id, name, git_url as "gitUrl", branch, is_root as "isRoot", 
            last_sync_commit_hash as "lastSyncCommitHash", last_sync_at as "lastSyncAt", 
            last_sync_status as "lastSyncStatus", last_sync_errors as "lastSyncErrors",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM agent_repository WHERE git_url = $1`,
    [gitUrl]
  );
  return result;
}

export async function getAgentRepositoryByUrlAndBranch(gitUrl: string, branch: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone(
    `SELECT id, name, git_url as "gitUrl", branch, is_root as "isRoot", 
            last_sync_commit_hash as "lastSyncCommitHash", last_sync_at as "lastSyncAt", 
            last_sync_status as "lastSyncStatus", last_sync_errors as "lastSyncErrors",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM agent_repository WHERE git_url = $1 AND branch = $2`,
    [gitUrl, branch]
  );
  return result;
}

export async function updateAgentRepository(repository: AgentRepository): Promise<AgentRepository> {
  const result = await db.one(
    `UPDATE agent_repository 
     SET name = $2, git_url = $3, branch = $4, is_root = $5, 
         last_sync_commit_hash = $6, last_sync_at = $7, last_sync_status = $8, last_sync_errors = $9,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, name, git_url as "gitUrl", branch, is_root as "isRoot", 
               last_sync_commit_hash as "lastSyncCommitHash", last_sync_at as "lastSyncAt", 
               last_sync_status as "lastSyncStatus", last_sync_errors as "lastSyncErrors",
               created_at as "createdAt", updated_at as "updatedAt"`,
    [repository.id, repository.name, repository.gitUrl, repository.branch, repository.isRoot,
     repository.lastSyncCommitHash, repository.lastSyncAt, repository.lastSyncStatus, repository.lastSyncErrors]
  );
  return result;
}

export async function deleteAgentRepository(id: number): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM agent_repository WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

export async function getAllAgentRepositories(): Promise<AgentRepository[]> {
  const result = await db.any(
    `SELECT id, name, git_url as "gitUrl", branch, is_root as "isRoot", 
            last_sync_commit_hash as "lastSyncCommitHash", last_sync_at as "lastSyncAt", 
            last_sync_status as "lastSyncStatus", last_sync_errors as "lastSyncErrors",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM agent_repository`
  );
  return result;
}