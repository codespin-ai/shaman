/**
 * @fileoverview Performs periodic health checks for external agents.
 */

import { ExternalAgentRegistry } from './external-registry.js';

export class HealthMonitor {
  private intervalId?: NodeJS.Timeout;

  constructor(private registry: ExternalAgentRegistry) {}

  /**
   * Starts the periodic health checks.
   */
  start(): void {
    if (this.intervalId) {
      this.stop();
    }
    this.runChecks(); // Run once immediately
    const checkInterval = this.getShortestInterval();
    if (checkInterval > 0) {
      this.intervalId = setInterval(() => this.runChecks(), checkInterval * 1000);
    }
  }

  /**
   * Stops the periodic health checks.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private getShortestInterval(): number {
    const agents = this.registry.listAgents();
    if (agents.length === 0) return 0;
    return agents.reduce((min, agent) => {
      const interval = agent.config.healthCheck?.interval;
      return interval && interval < min ? interval : min;
    }, Infinity);
  }

  private async runChecks(): Promise<void> {
    const agents = this.registry.listAgents();
    for (const agent of agents) {
      if (agent.config.healthCheck) {
        // In a real implementation, we would make an HTTP request.
        // For this stub, we'll just simulate a health check.
        const isHealthy = Math.random() > 0.2; // 80% chance of being healthy
        this.registry.updateHealthStatus(
          agent.name,
          isHealthy ? 'healthy' : 'unhealthy',
          isHealthy ? undefined : 'Simulated health check failure.'
        );
      }
    }
  }
}