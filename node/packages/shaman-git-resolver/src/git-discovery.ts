import { GitAgent, AgentRepository } from '@codespin/shaman-types';
import { saveGitAgent, getGitAgentsByRepositoryId, updateGitAgent } from '@codespin/shaman-persistence';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';
import fs from 'fs';
import { resolve, join } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

export async function updateGitAgents(repository: AgentRepository, localPath: string): Promise<GitAgent[]> {
  await ensureLocalRepo(repository.gitUrl, localPath);
  
  const agentFiles = await findAgentFiles(localPath);
  const agents = await parseAgentFiles(agentFiles);
  
  const existingAgents = await getGitAgentsByRepositoryId(repository.id);
  const result: GitAgent[] = [];
  
  for (const agent of agents) {
    const existing = existingAgents.find(e => e.filePath === agent.filePath);
    
    if (existing) {
      const updated = { ...existing, ...agent, agentRepositoryId: repository.id };
      const savedAgent = await updateGitAgent(updated);
      result.push(savedAgent);
    } else {
      const newAgent = { ...agent, agentRepositoryId: repository.id };
      const savedAgent = await saveGitAgent(newAgent);
      result.push(savedAgent);
    }
  }
  
  return result;
}

export async function discoverAgentsFromDefaultBranch(repoUrl: string): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  const tempDir = `/tmp/shaman-discovery-${Date.now()}`;
  
  try {
    await git.clone({
      fs,
      http,
      dir: tempDir,
      url: repoUrl,
      depth: 1,
      singleBranch: true
    });
    
    const agentFiles = await findAgentFiles(tempDir);
    return await parseAgentFiles(agentFiles);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function ensureLocalRepo(repoUrl: string, localPath: string): Promise<void> {
  if (!fs.existsSync(localPath)) {
    await git.clone({
      fs,
      http,
      dir: localPath,
      url: repoUrl
    });
  } else {
    await git.fetch({
      fs,
      http,
      dir: localPath,
      ref: 'refs/heads/main'
    });
    
    await git.checkout({
      fs,
      dir: localPath,
      ref: 'main'
    });
  }
}

async function findAgentFiles(repoPath: string): Promise<string[]> {
  const pattern = join(repoPath, '**/agent.md');
  return glob(pattern);
}

async function parseAgentFiles(files: string[]): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  const agents: Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[] = [];
  
  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const parsed = matter(content);
    
    agents.push({
      name: parsed.data.name || 'Unnamed Agent',
      description: parsed.data.description || null,
      version: parsed.data.version || null,
      filePath: file,
      model: parsed.data.model || null,
      providers: parsed.data.providers || null,
      mcpServers: parsed.data.mcpServers || null,
      allowedAgents: parsed.data.allowedAgents || null,
      tags: parsed.data.tags || null,
      lastModifiedCommitHash: null
    });
  }
  
  return agents;
}