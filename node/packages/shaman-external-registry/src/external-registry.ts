/**
 * @fileoverview Manages the registration and resolution of external A2A agents.
 */

import { Result, success, failure } from '@shaman/core/types/result.js';
import { A2AAgent } from '@shaman/core/types/agent.js';
import { ExternalAgentConfig, RegisteredAgent } from './types.js';

export class ExternalAgentRegistry {
  private agents = new Map<string, RegisteredAgent>();

  constructor(private initialConfig: ExternalAgentConfig[] = []) {
    for (const config of this.initialConfig) {
      this.registerAgent(config);
    }
  }

  /**
   * Registers a new external agent or updates an existing one.
   * @param config - The configuration of the external agent.
   * @returns A result indicating success or an error.
   */
  registerAgent(config: ExternalAgentConfig): Result<true, Error> {
    // In a real implementation, we would fetch the agent card from the URL.
    // For this stub, we'll create a placeholder agent definition.
    const agent: A2AAgent = {
      name: config.name,
      description: `External agent at ${config.url}`,
      source: 'a2a',
      endpoint: config.url,
      // Placeholder values
      agentCard: {},
      authConfig: {},
      skills: [],
    };

    this.agents.set(agent.name, { ...agent, config });
    return success(true);
  }

  /**
   * Unregisters an agent.
   * @param agentName - The name of the agent to unregister.
   */
  unregisterAgent(agentName: string): void {
    this.agents.delete(agentName);
  }

  /**
   * Resolves an agent by name.
   * @param agentName - The name of the agent to resolve.
   * @returns The registered agent or undefined if not found.
   */
  resolve(agentName: string): RegisteredAgent | undefined {
    return this.agents.get(agentName);
  }

  /**
   * Lists all registered agents.
   * @returns An array of all registered agents.
   */
  listAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Updates the health status of a registered agent.
   * @param agentName - The name of the agent.
   * @param status - The new health status.
   * @param error - An optional error message if unhealthy.
   */
  updateHealthStatus(
    agentName: string,
    status: 'healthy' | 'unhealthy',
    error?: string
  ): void {
    const agent = this.agents.get(agentName);
    if (agent) {
      agent.lastHealthCheck = {
        status,
        timestamp: Date.now(),
        error,
      };
    }
  }
}