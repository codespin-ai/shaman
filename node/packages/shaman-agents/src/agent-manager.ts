/**
 * packages/shaman-agents/src/agent-manager.ts
 * 
 * Core agent management functions that unify git and external sources
 */

import type { GitAgent } from '@codespin/shaman-types';
import type { ExternalAgent } from '@codespin/shaman-core/dist/types/agent.js';
import type { Result } from '@codespin/shaman-core/dist/types/result.js';
import { success, failure } from '@codespin/shaman-core/dist/types/result.js';

import { fetchAgentsFromRegistry } from '@codespin/shaman-external-registry';
import { getAllGitAgents } from '@codespin/shaman-persistence';
import { resolveAgents } from '@codespin/shaman-git-resolver';
import type { 
  UnifiedAgent, 
  AgentSearchOptions, 
  AgentResolveOptions,
  AgentsConfig,
  AgentResolution 
} from './types.js';

/**
 * Get all available agents from both git repositories and external registries
 */
export async function getAllAgents(
  config: AgentsConfig,
  options: AgentSearchOptions = {}
): Promise<Result<UnifiedAgent[], string>> {
  try {
    const agents: UnifiedAgent[] = [];
    const errors: string[] = [];

    // Get agents from git repositories
    if (options.source === 'git' || options.source === 'all' || !options.source) {
      try {
        const gitAgents = await getAllGitAgents();
        
        // Filter by repository if specified
        const filteredGitAgents = options.repository
          ? gitAgents.filter(_agent => {
              // TODO: Need to join with agent_repository table to filter by repository URL
              return true;
            })
          : gitAgents;

        // Filter by tags if specified
        const tagFilteredAgents = options.tags && options.tags.length > 0
          ? filteredGitAgents.filter(agent => 
              agent.tags && options.tags!.some(tag => agent.tags!.includes(tag))
            )
          : filteredGitAgents;

        for (const agent of tagFilteredAgents) {
          agents.push({
            source: 'git' as const,
            agent
          });
        }
      } catch (error) {
        errors.push(`Git agents error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Get agents from external registries
    if (options.source === 'external' || options.source === 'all' || !options.source) {
      if (config.externalRegistries) {
        for (const registry of config.externalRegistries) {
          try {
            const result = await fetchAgentsFromRegistry({
              url: registry.url,
              timeout: registry.timeout
            });

            if (result.success) {
              for (const agent of result.data) {
                agents.push({
                  source: 'external' as const,
                  agent
                });
              }
            } else {
              errors.push(`Registry ${registry.url}: ${result.error}`);
            }
          } catch (error) {
            errors.push(`Registry ${registry.url}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    // If we have some agents despite errors, return success with agents
    if (agents.length > 0) {
      return success(agents);
    }

    // If no agents and we have errors, return the errors
    if (errors.length > 0) {
      return failure(`Failed to fetch agents: ${errors.join('; ')}`);
    }

    // No agents, no errors - return empty list
    return success([]);
  } catch (error) {
    return failure(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resolve a specific agent by name, checking both git and external sources
 */
export async function resolveAgent(
  agentName: string,
  config: AgentsConfig,
  options: AgentResolveOptions = {}
): Promise<Result<AgentResolution | null, string>> {
  try {
    // Check preferred source first if specified
    if (options.preferredSource === 'git') {
      const gitResult = await resolveFromGit(agentName, options.branch);
      if (gitResult) return success(gitResult);
    } else if (options.preferredSource === 'external') {
      const externalResult = await resolveFromExternal(agentName, config);
      if (externalResult) return success(externalResult);
    }

    // Check both sources
    const gitResult = await resolveFromGit(agentName, options.branch);
    if (gitResult) return success(gitResult);

    const externalResult = await resolveFromExternal(agentName, config);
    if (externalResult) return success(externalResult);

    return success(null);
  } catch (error) {
    return failure(`Failed to resolve agent ${agentName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a specific agent by name
 */
export async function getAgent(
  agentName: string,
  config: AgentsConfig,
  options: AgentResolveOptions = {}
): Promise<Result<UnifiedAgent | null, string>> {
  const resolutionResult = await resolveAgent(agentName, config, options);
  
  if (!resolutionResult.success) {
    return failure(resolutionResult.error);
  }

  if (!resolutionResult.data) {
    return success(null);
  }

  return success(resolutionResult.data.agent);
}

/**
 * Search for agents by various criteria
 */
export async function searchAgents(
  query: string,
  config: AgentsConfig,
  options: AgentSearchOptions = {}
): Promise<Result<UnifiedAgent[], string>> {
  const allAgentsResult = await getAllAgents(config, options);
  
  if (!allAgentsResult.success) {
    return failure(allAgentsResult.error);
  }

  const queryLower = query.toLowerCase();
  const filtered = allAgentsResult.data.filter(unifiedAgent => {
    if (unifiedAgent.source === 'git') {
      const agent = unifiedAgent.agent;
      
      // Search in name and description
      if (agent.name.toLowerCase().includes(queryLower)) {
        return true;
      }
      
      if (agent.description && agent.description.toLowerCase().includes(queryLower)) {
        return true;
      }

      // Search in tags
      if (agent.tags) {
        return agent.tags.some((tag: string) => tag.toLowerCase().includes(queryLower));
      }
    } else {
      const agent = unifiedAgent.agent;
      
      // Search in name and description for external agents
      if (agent.name.toLowerCase().includes(queryLower)) {
        return true;
      }
      
      if (agent.description && agent.description.toLowerCase().includes(queryLower)) {
        return true;
      }
    }

    return false;
  });

  return success(filtered);
}

/**
 * Sync agents from configured git repositories
 */
export async function syncGitRepositories(
  config: AgentsConfig
): Promise<Result<{ synced: number; errors: string[] }, string>> {
  if (!config.gitRepositories || config.gitRepositories.length === 0) {
    return success({ synced: 0, errors: [] });
  }

  let synced = 0;
  const errors: string[] = [];

  for (const repo of config.gitRepositories) {
    try {
      await resolveAgents(repo.url, repo.branch || 'main');
      synced++;
    } catch (error) {
      errors.push(`${repo.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return success({ synced, errors });
}

// Helper functions

async function resolveFromGit(
  agentName: string, 
  _branch?: string
): Promise<AgentResolution | null> {
  try {
    // Get all git agents from the database
    const gitAgents = await getAllGitAgents();
    
    // Find agent by name
    const agent = gitAgents.find((a: GitAgent) => a.name === agentName);
    
    if (agent) {
      return {
        agent: {
          source: 'git' as const,
          agent
        },
        resolvedFrom: 'git' as const
        // TODO: Add repository information when we join with agent_repository table
      };
    }
  } catch (error) {
    console.error(`Error resolving git agent ${agentName}:`, error);
  }
  
  return null;
}

async function resolveFromExternal(
  agentName: string,
  config: AgentsConfig
): Promise<AgentResolution | null> {
  if (!config.externalRegistries) {
    return null;
  }

  for (const registry of config.externalRegistries) {
    try {
      const result = await fetchAgentsFromRegistry({
        url: registry.url,
        timeout: registry.timeout
      });

      if (result.success) {
        const agent = result.data.find((a: ExternalAgent) => a.name === agentName);
        if (agent) {
          return {
            agent: {
              source: 'external' as const,
              agent
            },
            resolvedFrom: 'external' as const,
            registryUrl: registry.url
          };
        }
      }
    } catch (error) {
      console.error(`Error checking registry ${registry.url}:`, error);
    }
  }

  return null;
}