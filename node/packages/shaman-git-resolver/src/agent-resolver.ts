/**
 * @fileoverview Provides a class to resolve agent names to definitions.
 */

import { GitAgent } from '@shaman/core/types/agent.js';
import { GitRepository } from './types.js';
import { discoverAllAgents } from './git-discovery.js';

export class AgentResolver {
  private agents: Map<string, GitAgent> = new Map();
  
  constructor(private repositories: GitRepository[], private baseDir: string) {}

  /**
   * Syncs repositories and refreshes the agent map.
   */
  async refresh(): Promise<void> {
    const { agents, errors } = await discoverAllAgents(this.repositories, this.baseDir);
    if (errors.length > 0) {
      console.error("Errors encountered during agent discovery:", errors);
    }
    this.agents = agents;
  }

  /**
   * Resolves an agent by its full name.
   * @param agentName - The full name of the agent (e.g., "namespace/agent-path").
   * @returns The agent definition or undefined if not found.
   */
  resolve(agentName: string): GitAgent | undefined {
    return this.agents.get(agentName);
  }

  /**
   * Returns a list of all discovered agents.
   * @returns An array of agent definitions.
   */
  listAgents(): GitAgent[] {
    return Array.from(this.agents.values());
  }
}