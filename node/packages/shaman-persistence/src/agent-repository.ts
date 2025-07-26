/**
 * packages/shaman-persistence/src/agent-repository.ts
 *
 * This module provides functions for interacting with the 'agent_repository' table.
 */

import { AgentRepository } from '@shaman/types';
import { IDatabase } from 'pg-promise';
import { db } from './db.js';

// Helper to convert snake_case from DB to camelCase
function toCamelCase(obj: any): AgentRepository {
  return {
    id: obj.id,
    name: obj.name,
    gitUrl: obj.git_url,
    branch: obj.branch,
    isRoot: obj.is_root,
    lastSyncCommitHash: obj.last_sync_commit_hash,
    lastSyncAt: obj.last_sync_at,
    lastSyncStatus: obj.last_sync_status,
    lastSyncErrors: obj.last_sync_errors,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at,
  };
}

export async function findAgentRepositoryByName(
  name: string,
): Promise<AgentRepository | null> {
  const result = await db.oneOrNone('SELECT * FROM agent_repository WHERE name = $1', name);
  return result ? toCamelCase(result) : null;
}

export async function listAgentRepositories(): Promise<AgentRepository[]> {
  const result = await db.manyOrNone('SELECT * FROM agent_repository ORDER BY name');
  return result.map(toCamelCase);
}

export async function updateAgentRepositorySyncStatus(
  id: number,
  status: AgentRepository['lastSyncStatus'],
  commitHash?: string,
  errors?: any,
): Promise<AgentRepository> {
  const query = `
    UPDATE agent_repository
    SET
      last_sync_status = $1,
      last_sync_at = NOW(),
      last_sync_commit_hash = $2,
      last_sync_errors = $3,
      updated_at = NOW()
    WHERE id = $4
    RETURNING *;
  `;
  const result = await db.one(query, [status, commitHash, errors ? JSON.stringify(errors) : null, id]);
  return toCamelCase(result);
}
