import type { GitAgent } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapGitAgentFromDb } from './mappers/map-git-agent-from-db.js';
import type { GitAgentDbRow } from './types.js';

export async function getAllGitAgents(db: Database, orgId?: string): Promise<GitAgent[]> {
  let query = `SELECT ga.* FROM git_agent ga`;
  const params: Record<string, unknown> = {};
  
  if (orgId) {
    query += ` JOIN agent_repository ar ON ga.agent_repository_id = ar.id WHERE ar.org_id = $(orgId)`;
    params.orgId = orgId;
  }
  
  const result = await db.any<GitAgentDbRow>(query, params);
  return result.map(mapGitAgentFromDb);
}