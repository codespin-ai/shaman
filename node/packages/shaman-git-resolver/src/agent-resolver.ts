import {
  saveAgentRepository,
  getAgentRepositoryByUrl,
  updateAgentRepository
} from '@codespin/shaman-persistence';
import { AgentRepository, GitAgent } from '@codespin/shaman-types';
import { updateGitAgents, discoverAgentsFromDefaultBranch } from './git-discovery.js';
import * as fs from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

const projectsDir = resolve(homedir(), 'projects/shaman');

export async function resolveAgents(repoUrl: string): Promise<GitAgent[]> {
  let repository = await getAgentRepositoryByUrl(repoUrl);
  
  if (!repository) {
    const newRepo: Omit<AgentRepository, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Auto-discovered',
      gitUrl: repoUrl,
      branch: 'main',
      isRoot: false,
      lastSyncCommitHash: null,
      lastSyncAt: null,
      lastSyncStatus: 'NEVER_SYNCED',
      lastSyncErrors: null
    };
    repository = await saveAgentRepository(newRepo);
  }

  const localRepoPath = resolve(projectsDir, repository.id.toString());
  
  const agents = await updateGitAgents(repository, localRepoPath);
  
  const updatedRepo: AgentRepository = {
    ...repository,
    lastSyncAt: new Date(),
    lastSyncStatus: 'SUCCESS'
  };
  await updateAgentRepository(updatedRepo);
  
  return agents;
}

export async function discoverAgents(repoUrl: string): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  return discoverAgentsFromDefaultBranch(repoUrl);
}

export async function ensureProjectsDirectory(): Promise<void> {
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
}