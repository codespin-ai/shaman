import { GitAgent } from '@codespin/shaman-types';
import { db } from './db.js';

export async function saveGitAgent(agent: Omit<GitAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<GitAgent> {
  const result = await db.one(
    `INSERT INTO git_agent (agent_repository_id, name, description, version, file_path, model, providers, mcp_servers, allowed_agents, tags, last_modified_commit_hash) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
     RETURNING id, agent_repository_id as "agentRepositoryId", name, description, version, file_path as "filePath", 
               model, providers, mcp_servers as "mcpServers", allowed_agents as "allowedAgents", tags, 
               last_modified_commit_hash as "lastModifiedCommitHash", created_at as "createdAt", updated_at as "updatedAt"`,
    [agent.agentRepositoryId, agent.name, agent.description, agent.version, agent.filePath, agent.model, 
     agent.providers, agent.mcpServers, agent.allowedAgents, agent.tags, agent.lastModifiedCommitHash]
  );
  return result;
}

export async function getGitAgent(id: number): Promise<GitAgent | null> {
  const result = await db.oneOrNone(
    `SELECT id, agent_repository_id as "agentRepositoryId", name, description, version, file_path as "filePath", 
            model, providers, mcp_servers as "mcpServers", allowed_agents as "allowedAgents", tags, 
            last_modified_commit_hash as "lastModifiedCommitHash", created_at as "createdAt", updated_at as "updatedAt"
     FROM git_agent WHERE id = $1`,
    [id]
  );
  return result;
}

export async function getGitAgentsByRepositoryId(agentRepositoryId: number): Promise<GitAgent[]> {
  const result = await db.any(
    `SELECT id, agent_repository_id as "agentRepositoryId", name, description, version, file_path as "filePath", 
            model, providers, mcp_servers as "mcpServers", allowed_agents as "allowedAgents", tags, 
            last_modified_commit_hash as "lastModifiedCommitHash", created_at as "createdAt", updated_at as "updatedAt"
     FROM git_agent WHERE agent_repository_id = $1`,
    [agentRepositoryId]
  );
  return result;
}

export async function updateGitAgent(agent: GitAgent): Promise<GitAgent> {
  const result = await db.one(
    `UPDATE git_agent 
     SET agent_repository_id = $2, name = $3, description = $4, version = $5, file_path = $6, 
         model = $7, providers = $8, mcp_servers = $9, allowed_agents = $10, tags = $11, 
         last_modified_commit_hash = $12, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, agent_repository_id as "agentRepositoryId", name, description, version, file_path as "filePath", 
               model, providers, mcp_servers as "mcpServers", allowed_agents as "allowedAgents", tags, 
               last_modified_commit_hash as "lastModifiedCommitHash", created_at as "createdAt", updated_at as "updatedAt"`,
    [agent.id, agent.agentRepositoryId, agent.name, agent.description, agent.version, agent.filePath, 
     agent.model, agent.providers, agent.mcpServers, agent.allowedAgents, agent.tags, agent.lastModifiedCommitHash]
  );
  return result;
}

export async function deleteGitAgent(id: number): Promise<boolean> {
  const result = await db.result(
    'DELETE FROM git_agent WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

export async function getAllGitAgents(): Promise<GitAgent[]> {
  const result = await db.any(
    `SELECT id, agent_repository_id as "agentRepositoryId", name, description, version, file_path as "filePath", 
            model, providers, mcp_servers as "mcpServers", allowed_agents as "allowedAgents", tags, 
            last_modified_commit_hash as "lastModifiedCommitHash", created_at as "createdAt", updated_at as "updatedAt"
     FROM git_agent`
  );
  return result;
}