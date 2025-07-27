/**
 * Agent repository (Git repos containing agents) persistence functions
 */

import type { AgentRepository } from '@codespin/shaman-types';
import { db } from './db.js';

/**
 * Database row type for agent_repository table
 * Mirrors the exact database schema
 */
type AgentRepositoryDbRow = {
  id: number;
  name: string;
  git_url: string;
  branch: string;
  is_root: boolean;
  last_sync_commit_hash: string | null;
  last_sync_at: Date | null;
  last_sync_status: string;
  last_sync_errors: unknown;
  created_at: Date;
  updated_at: Date;
};

/**
 * Map database row to domain type
 */
function mapAgentRepositoryFromDb(row: AgentRepositoryDbRow): AgentRepository {
  return {
    id: row.id,
    name: row.name,
    gitUrl: row.git_url,
    branch: row.branch,
    isRoot: row.is_root,
    lastSyncCommitHash: row.last_sync_commit_hash,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as AgentRepository['lastSyncStatus'],
    lastSyncErrors: row.last_sync_errors as Record<string, unknown> | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map domain type to database row (for inserts/updates)
 */
function mapAgentRepositoryToDb(repo: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'>): Omit<AgentRepositoryDbRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: repo.name,
    git_url: repo.gitUrl,
    branch: repo.branch,
    is_root: repo.isRoot,
    last_sync_commit_hash: repo.lastSyncCommitHash,
    last_sync_at: repo.lastSyncAt,
    last_sync_status: repo.lastSyncStatus,
    last_sync_errors: repo.lastSyncErrors
  };
}

export async function saveAgentRepository(
  repository: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AgentRepository> {
  const dbData = mapAgentRepositoryToDb(repository);
  const result = await db.one<AgentRepositoryDbRow>(
    `INSERT INTO agent_repository 
     (name, git_url, branch, is_root, last_sync_commit_hash, last_sync_at, last_sync_status, last_sync_errors) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING *`,
    [dbData.name, dbData.git_url, dbData.branch, dbData.is_root, 
     dbData.last_sync_commit_hash, dbData.last_sync_at, dbData.last_sync_status, dbData.last_sync_errors]
  );
  return mapAgentRepositoryFromDb(result);
}

export async function getAgentRepository(id: number): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE id = $1`,
    [id]
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

export async function getAgentRepositoryByUrl(gitUrl: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE git_url = $1`,
    [gitUrl]
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

export async function getAgentRepositoryByUrlAndBranch(gitUrl: string, branch: string): Promise<AgentRepository | null> {
  const result = await db.oneOrNone<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository WHERE git_url = $1 AND branch = $2`,
    [gitUrl, branch]
  );
  return result ? mapAgentRepositoryFromDb(result) : null;
}

export async function updateAgentRepository(repository: AgentRepository): Promise<AgentRepository> {
  const result = await db.one<AgentRepositoryDbRow>(
    `UPDATE agent_repository 
     SET name = $2, git_url = $3, branch = $4, is_root = $5, 
         last_sync_commit_hash = $6, last_sync_at = $7, last_sync_status = $8, last_sync_errors = $9,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [repository.id, repository.name, repository.gitUrl, repository.branch, repository.isRoot,
     repository.lastSyncCommitHash, repository.lastSyncAt, repository.lastSyncStatus, repository.lastSyncErrors]
  );
  return mapAgentRepositoryFromDb(result);
}

export async function deleteAgentRepository(id: number): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM agent_repository WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

export async function getAllAgentRepositories(): Promise<AgentRepository[]> {
  const result = await db.any<AgentRepositoryDbRow>(
    `SELECT * FROM agent_repository ORDER BY name`
  );
  return result.map(mapAgentRepositoryFromDb);
}