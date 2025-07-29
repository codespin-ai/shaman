import { getDb } from '@codespin/shaman-db';
import {
  saveAgentRepository,
  getAgentRepositoryByUrlAndBranch,
  updateAgentRepository
} from './domain/agent-repository/index.js';
import type { AgentRepository, GitAgent } from '@codespin/shaman-types';
import { updateGitAgents, discoverAgentsFromBranch } from './git-discovery.js';
import * as fs from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

const projectsDir = resolve(homedir(), 'projects/shaman');

export async function resolveAgents(repoUrl: string, branch: string = 'main', orgId: string = 'system', userId: string = 'system'): Promise<GitAgent[]> {
  const db = getDb();
  let repository = await getAgentRepositoryByUrlAndBranch(db, repoUrl, branch, orgId);
  
  if (!repository) {
    // Extract repository name from URL
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unnamed-repo';
    
    const newRepo: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'> = {
      orgId: orgId,
      name: `${repoName}-${branch}`,
      gitUrl: repoUrl,
      branch: branch,
      isRoot: false,
      lastSyncCommitHash: null,
      lastSyncAt: null,
      lastSyncStatus: 'NEVER_SYNCED',
      lastSyncErrors: null,
      createdBy: userId
    };
    repository = await saveAgentRepository(db, newRepo);
  }

  const localRepoPath = resolve(projectsDir, `${repository.id}-${branch}`);
  
  try {
    const agents = await updateGitAgents(repository, localRepoPath, branch);
    
    // Note: updateGitAgents already updates the repository status on success
    return agents;
  } catch (error) {
    // Update repository status on failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    const updatedRepo: AgentRepository = {
      ...repository,
      lastSyncAt: new Date(),
      lastSyncStatus: 'FAILED',
      lastSyncErrors: { error: errorMessage }
    };
    await updateAgentRepository(db, updatedRepo);
    
    throw error;
  }
}

export async function discoverAgents(repoUrl: string, branch: string = 'main'): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  return discoverAgentsFromBranch(repoUrl, branch);
}

export function ensureProjectsDirectory(): void {
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
}