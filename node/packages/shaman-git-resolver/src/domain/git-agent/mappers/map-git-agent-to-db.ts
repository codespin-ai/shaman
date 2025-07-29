import type { GitAgent } from '@codespin/shaman-types';
import type { GitAgentDbRow } from '../types.js';

/**
 * Map domain type to database row (for inserts/updates)
 */
export function mapGitAgentToDb(agent: Omit<GitAgent, 'id' | 'createdAt' | 'updatedAt'>): Omit<GitAgentDbRow, 'id' | 'created_at' | 'updated_at'> {
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