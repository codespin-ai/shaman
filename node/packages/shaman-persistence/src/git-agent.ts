/**
 * Git agent persistence functions
 */

import type { GitAgent } from '@codespin/shaman-types';
import { db } from './db.js';

/**
 * Database row type for git_agent table
 * Mirrors the exact database schema
 */
type GitAgentDbRow = {
  id: number;
  agent_repository_id: number;
  name: string;
  description: string | null;
  version: string | null;
  file_path: string;
  model: string | null;
  providers: unknown;
  mcp_servers: unknown;
  allowed_agents: unknown;
  tags: unknown;
  last_modified_commit_hash: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Map database row to domain type
 */
function mapGitAgentFromDb(row: GitAgentDbRow): GitAgent {
  return {
    id: row.id,
    agentRepositoryId: row.agent_repository_id,
    name: row.name,
    description: row.description,
    version: row.version,
    filePath: row.file_path,
    model: row.model,
    providers: row.providers as Record<string, unknown> | null,
    mcpServers: row.mcp_servers as Record<string, unknown> | null,
    allowedAgents: row.allowed_agents as string[] | null,
    tags: row.tags as string[] | null,
    lastModifiedCommitHash: row.last_modified_commit_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map domain type to database row (for inserts/updates)
 */
function mapGitAgentToDb(agent: Omit<GitAgent, 'id' | 'createdAt' | 'updatedAt'>): Omit<GitAgentDbRow, 'id' | 'created_at' | 'updated_at'> {
  return {
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
    last_modified_commit_hash: agent.lastModifiedCommitHash
  };
}

export async function saveGitAgent(agent: Omit<GitAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitAgent> {
  const dbData = mapGitAgentToDb(agent);
  const result = await db.one<GitAgentDbRow>(
    `INSERT INTO git_agent 
     (agent_repository_id, name, description, version, file_path, model, providers, mcp_servers, allowed_agents, tags, last_modified_commit_hash) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
     RETURNING *`,
    [dbData.agent_repository_id, dbData.name, dbData.description, dbData.version, dbData.file_path, 
     dbData.model, dbData.providers, dbData.mcp_servers, dbData.allowed_agents, dbData.tags, 
     dbData.last_modified_commit_hash]
  );
  return mapGitAgentFromDb(result);
}

export async function getGitAgent(id: number): Promise<GitAgent | null> {
  const result = await db.oneOrNone<GitAgentDbRow>(
    `SELECT * FROM git_agent WHERE id = $1`,
    [id]
  );
  return result ? mapGitAgentFromDb(result) : null;
}

export async function getGitAgentsByRepositoryId(agentRepositoryId: number): Promise<GitAgent[]> {
  const result = await db.any<GitAgentDbRow>(
    `SELECT * FROM git_agent WHERE agent_repository_id = $1`,
    [agentRepositoryId]
  );
  return result.map(mapGitAgentFromDb);
}

export async function updateGitAgent(agent: GitAgent): Promise<GitAgent> {
  const result = await db.one<GitAgentDbRow>(
    `UPDATE git_agent 
     SET agent_repository_id = $2, name = $3, description = $4, version = $5, file_path = $6, 
         model = $7, providers = $8, mcp_servers = $9, allowed_agents = $10, tags = $11, 
         last_modified_commit_hash = $12, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [agent.id, agent.agentRepositoryId, agent.name, agent.description, agent.version, agent.filePath, 
     agent.model, agent.providers, agent.mcpServers, agent.allowedAgents, agent.tags, agent.lastModifiedCommitHash]
  );
  return mapGitAgentFromDb(result);
}

export async function deleteGitAgent(id: number): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM git_agent WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

export async function getAllGitAgents(): Promise<GitAgent[]> {
  const result = await db.any<GitAgentDbRow>(
    `SELECT * FROM git_agent`
  );
  return result.map(mapGitAgentFromDb);
}