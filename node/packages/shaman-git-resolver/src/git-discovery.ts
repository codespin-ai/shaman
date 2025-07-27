import type { GitAgent, AgentRepository } from '@codespin/shaman-types';
import { saveGitAgent, getGitAgentsByRepositoryId, updateGitAgent, deleteGitAgent, updateAgentRepository } from '@codespin/shaman-persistence';
import fs from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { getLatestCommitHash, getFileCommitHash } from './git-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function updateGitAgents(repository: AgentRepository, localPath: string, branch: string = 'main'): Promise<GitAgent[]> {
  // First ensure the local repo is up to date
  await ensureLocalRepo(repository.gitUrl, localPath, branch);
  
  // Get the current commit hash
  const currentCommitHash = await getLatestCommitHash(localPath, branch);
  
  // If the commit hash hasn't changed, return cached agents from DB
  if (repository.lastSyncCommitHash === currentCommitHash) {
    // Repository hasn't changed, using cached agents
    return await getGitAgentsByRepositoryId(repository.id);
  }

  // Find all agent files
  const agentFiles = await findAgentFiles(localPath);
  const agentsWithHashes = await parseAgentFilesWithCommitHashes(agentFiles, localPath, branch);
  
  const existingAgents = await getGitAgentsByRepositoryId(repository.id);
  const result: GitAgent[] = [];
  const processedFilePaths = new Set<string>();
  
  for (const agentData of agentsWithHashes) {
    processedFilePaths.add(agentData.filePath);
    const existing = existingAgents.find(e => e.filePath === agentData.filePath);
    
    if (existing) {
      // Only update if the file's commit hash has changed
      if (existing.lastModifiedCommitHash !== agentData.lastModifiedCommitHash) {
        // Updating agent - file changed
        const updated = { ...existing, ...agentData, agentRepositoryId: repository.id };
        const savedAgent = await updateGitAgent(updated);
        result.push(savedAgent);
      } else {

        result.push(existing);
      }
    } else {

      const newAgent = { ...agentData, agentRepositoryId: repository.id };
      const savedAgent = await saveGitAgent(newAgent);
      result.push(savedAgent);
    }
  }
  
  // Delete agents that no longer exist in the repository
  for (const existing of existingAgents) {
    if (!processedFilePaths.has(existing.filePath)) {

      await deleteGitAgent(existing.id);
    }
  }
  
  // Update the repository's last sync commit hash
  await updateAgentRepository({
    ...repository,
    lastSyncCommitHash: currentCommitHash,
    lastSyncAt: new Date(),
    lastSyncStatus: 'SUCCESS'
  });
  
  return result;
}

export async function discoverAgentsFromBranch(repoUrl: string, branch: string = 'main'): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  const tempDir = `/tmp/shaman-discovery-${Date.now()}`;
  
  try {
    // Clone the repository to a temporary directory
    await execAsync(`git clone --single-branch --branch ${branch} --depth 1 ${repoUrl} ${tempDir}`);
    
    const agentFiles = await findAgentFiles(tempDir);
    return await parseAgentFilesWithCommitHashes(agentFiles, tempDir, branch);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

// Backward compatibility alias
export async function discoverAgentsFromDefaultBranch(repoUrl: string): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  return discoverAgentsFromBranch(repoUrl, 'main');
}

async function ensureLocalRepo(repoUrl: string, localPath: string, branch: string = 'main'): Promise<void> {
  if (!fs.existsSync(localPath)) {
    // Clone the repository
    await execAsync(`git clone --single-branch --branch ${branch} ${repoUrl} ${localPath}`);
  } else {
    // Update existing repository
    await execAsync(`git fetch origin ${branch}`, { cwd: localPath });
    await execAsync(`git checkout ${branch}`, { cwd: localPath });
    await execAsync(`git reset --hard origin/${branch}`, { cwd: localPath });
  }
}

async function findAgentFiles(repoPath: string): Promise<string[]> {
  const pattern = join(repoPath, '**/agent.md');
  return glob(pattern);
}

async function _parseAgentFiles(files: string[]): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  const agents: Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[] = [];
  
  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const parsed = matter(content);
    
    agents.push({
      name: (parsed.data.name as string) || 'Unnamed Agent',
      description: (parsed.data.description as string | null) || null,
      version: (parsed.data.version as string | null) || null,
      filePath: file,
      model: (parsed.data.model as string | null) || null,
      providers: (parsed.data.providers as Record<string, unknown> | null) || null,
      mcpServers: (parsed.data.mcpServers as Record<string, unknown> | null) || null,
      allowedAgents: (parsed.data.allowedAgents as string[] | null) || null,
      tags: (parsed.data.tags as string[] | null) || null,
      lastModifiedCommitHash: null
    });
  }
  
  return agents;
}

async function parseAgentFilesWithCommitHashes(files: string[], repoPath: string, branch: string = 'main'): Promise<Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[]> {
  const agents: Omit<GitAgent, 'id' | 'agentRepositoryId' | 'createdAt' | 'updatedAt'>[] = [];
  
  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const parsed = matter(content);
    
    // Get the commit hash for this specific file
    const fileCommitHash = await getFileCommitHash(repoPath, file, branch);
    
    agents.push({
      name: (parsed.data.name as string) || 'Unnamed Agent',
      description: (parsed.data.description as string | null) || null,
      version: (parsed.data.version as string | null) || null,
      filePath: file,
      model: (parsed.data.model as string | null) || null,
      providers: (parsed.data.providers as Record<string, unknown> | null) || null,
      mcpServers: (parsed.data.mcpServers as Record<string, unknown> | null) || null,
      allowedAgents: (parsed.data.allowedAgents as string[] | null) || null,
      tags: (parsed.data.tags as string[] | null) || null,
      lastModifiedCommitHash: fileCommitHash
    });
  }
  
  return agents;
}