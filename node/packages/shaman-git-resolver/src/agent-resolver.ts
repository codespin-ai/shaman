/**
 * packages/shaman-git-resolver/src/agent-resolver.ts
 *
 * This is the main orchestration module for the git-resolver package.
 * It coordinates the process of syncing a repository and updating the database.
 */

import {
  findAgentRepositoryByName,
  updateAgentRepositorySyncStatus,
  upsertGitAgent,
  deleteGitAgentsByFilePaths
} from '@shaman/persistence';
import { AgentRepository, GitAgent } from '@shaman/types';
import path from 'path';
import {
  cloneOrPull,
  getLatestCommitHash
} from './git-manager.js';
import {
  findAgentFiles,
  parseAgentFile,
  ParsedAgentFile
} from './agent-discovery.js';

export async function syncRepository(name: string): Promise<void> {
  const repo = await findAgentRepositoryByName(name);
  if (!repo) {
    throw new Error(`Repository '${name}' not found in the database.`);
  }

  await updateAgentRepositorySyncStatus(repo.id, 'IN_PROGRESS');

  try {
    const repoDir = await cloneOrPull(repo.gitUrl, repo.branch, repo.name);
    const latestCommitHash = await getLatestCommitHash(repo.name);

    if (repo.lastSyncCommitHash === latestCommitHash) {
      await updateAgentRepositorySyncStatus(repo.id, 'SUCCESS', latestCommitHash);
      console.log(`Repository '${name}' is already up-to-date.`);
      return;
    }

    const agentFilePaths = await findAgentFiles(repoDir);
    const agentsToKeep: string[] = [];

    for (const filePath of agentFilePaths) {
      const parsedFile = await parseAgentFile(filePath);
      const relativePath = path.relative(repoDir, filePath);
      agentsToKeep.push(relativePath);

      const agentData: Omit<GitAgent, 'id' | 'createdAt' | 'updatedAt'> = {
        agentRepositoryId: repo.id,
        name: parsedFile.frontmatter.name || path.basename(relativePath, '.md'),
        description: parsedFile.frontmatter.description || null,
        version: parsedFile.frontmatter.version || null,
        filePath: relativePath,
        model: parsedFile.frontmatter.model || null,
        providers: parsedFile.frontmatter.providers || null,
        mcpServers: parsedFile.frontmatter.mcpServers || null,
        allowedAgents: parsedFile.frontmatter.allowedAgents || null,
        tags: parsedFile.frontmatter.tags || null,
        lastModifiedCommitHash: latestCommitHash,
      };

      await upsertGitAgent(agentData);
    }

    // Delete agents that are no longer in the repository
    await deleteGitAgentsByFilePaths(repo.id, agentsToKeep);
    await updateAgentRepositorySyncStatus(repo.id, 'SUCCESS', latestCommitHash);

    console.log(`Successfully synced repository '${name}' at commit ${latestCommitHash}`);
  } catch (error: any) {
    await updateAgentRepositorySyncStatus(repo.id, 'FAILED', repo.lastSyncCommitHash, { message: error.message, stack: error.stack });
    throw error;
  }
}
