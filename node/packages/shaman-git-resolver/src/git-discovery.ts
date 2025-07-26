/**
 * @fileoverview Orchestrates the discovery of agents from multiple Git repositories.
 */

import { GitRepository } from './types.js';
import { GitAgent } from '@shaman/core/dist/types/agent.js';
import { syncRepository } from './git-manager.js';
import { discoverAgents as discoverAgentsInRepo } from './agent-discovery.js';
import * as path from 'path';

export type DiscoveryResult = {
    agents: Map<string, GitAgent>;
    errors: any[];
};

/**
 * Clones/updates all repositories and discovers all agents within them.
 * @param repositories - A list of repositories to scan.
 * @param baseDir - The base directory for storing cloned repositories.
 * @returns A discovery result with a map of agents and a list of errors.
 */
export async function discoverAllAgents(
    repositories: GitRepository[],
    baseDir: string
): Promise<DiscoveryResult> {
    const allErrors: any[] = [];
    const allAgents: GitAgent[] = [];

    for (const repo of repositories) {
        const syncResult = await syncRepository(repo, baseDir);
        if (!syncResult.success) {
            allErrors.push({ repo: repo.name, error: syncResult.error, step: 'sync' });
            continue;
        }
        const commitHash = syncResult.data;
        const { agents, errors } = await discoverAgentsInRepo(repo, commitHash, baseDir);
        if (errors.length > 0) {
            allErrors.push({ repo: repo.name, errors, step: 'parse' });
        }
        allAgents.push(...agents);
    }

    const agentMap = new Map<string, GitAgent>();
    for (const agent of allAgents) {
        const repo = repositories.find(r => r.url === agent.repositoryUrl);
        const agentDir = path.dirname(agent.filePath);
        
        const normalizedAgentPath = agentDir.replace(/\\/g, '/');

        const agentName = repo?.isRoot 
            ? normalizedAgentPath
            : `${repo.name}/${normalizedAgentPath}`;
        
        if (agentMap.has(agentName)) {
            allErrors.push({ 
                error: `Duplicate agent name "${agentName}" found.`,
                file1: agentMap.get(agentName)?.filePath,
                file2: agent.filePath,
                repo: repo?.name
            });
        }
        agentMap.set(agentName, { ...agent, name: agentName });
    }

    return { agents: agentMap, errors: allErrors };
}