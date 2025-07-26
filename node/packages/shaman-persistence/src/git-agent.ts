/**
 * packages/shaman-persistence/src/git-agent.ts
 *
 * This module provides functions for interacting with the 'git_agent' table.
 */

import { GitAgent } from '@shaman/types';
import pgPromise, { IDatabase } from 'pg-promise';
import { db } from './db.js';

const pgp = pgPromise({});

// Helper to convert snake_case from DB to camelCase
function toCamelCase(obj: any): GitAgent {
  return {
    id: obj.id,
    agentRepositoryId: obj.agent_repository_id,
    name: obj.name,
    description: obj.description,
    version: obj.version,
    filePath: obj.file_path,
    model: obj.model,
    providers: obj.providers,
    mcpServers: obj.mcp_servers,
    allowedAgents: obj.allowed_agents,
    tags: obj.tags,
    lastModifiedCommitHash: obj.last_modified_commit_hash,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at,
  };
}

export async function upsertGitAgent(agent: Omit<GitAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitAgent> {
  const now = new Date();

  const agentWithDbKeys = {
    agent_repository_id: agent.agentRepositoryId,
    name: agent.name,
    description: agent.description,
    version: agent.version,
    file_path: agent.filePath,
    model: agent.model,
    providers: agent.providers,
    mcp_servers: agent.mcpServers,
    allowed_agents: agent.allowedAgents,
    tags: agent.tags,
    last_modified_commit_hash: agent.lastModifiedCommitHash,
    created_at: now,
    updated_at: now,
  };

  const cs = new pgp.helpers.ColumnSet(Object.keys(agentWithDbKeys), { table: 'git_agent' });
  
  const query = `
    INSERT INTO git_agent AS t (agent_repository_id, name, description, version, file_path, model, providers, mcp_servers, allowed_agents, tags, last_modified_commit_hash, created_at, updated_at)
    VALUES ($/agent_repository_id/, $/name/, $/description/, $/version/, $/file_path/, $/model/, $/providers/, $/mcp_servers/, $/allowed_agents/, $/tags/, $/last_modified_commit_hash/, $/created_at/, $/updated_at/)
    ON CONFLICT (agent_repository_id, file_path)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      version = EXCLUDED.version,
      model = EXCLUDED.model,
      providers = EXCLUDED.providers,
      mcp_servers = EXCLUDED.mcp_servers,
      allowed_agents = EXCLUDED.allowed_agents,
      tags = EXCLUDED.tags,
      last_modified_commit_hash = EXCLUDED.last_modified_commit_hash,
      updated_at = NOW()
    RETURNING *;
  `;

  const result = await db.one(query, agentWithDbKeys);
  return toCamelCase(result);
}

export async function deleteGitAgentsByFilePaths(repoId: number, filePathsToKeep: string[]): Promise<void> {
  await db.none('DELETE FROM git_agent WHERE agent_repository_id = $1 AND file_path NOT IN ($2:list)', [repoId, filePathsToKeep]);
}
