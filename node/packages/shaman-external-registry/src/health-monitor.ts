/**
 * @fileoverview Performs periodic health checks for external agents.
 */

import { healthCheckRegistry } from './external-registry.js';
import type { RegistryConfig } from './types.js';
import { createLogger } from '@codespin/shaman-logger';

export class HealthMonitor {
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(private configs: RegistryConfig[]) {}

  /**
   * Starts the periodic health checks.
   */
  start(): void {
    if (this.intervalId) {
      this.stop();
    }
    void this.runChecks(); // Run once immediately
    const checkInterval = this.getShortestInterval();
    if (checkInterval > 0) {
      this.intervalId = setInterval(() => {
        void this.runChecks();
      }, checkInterval * 1000);
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
    if (this.configs.length === 0) return 0;
    return this.configs.reduce((min: number, config: RegistryConfig) => {
      const interval = config.timeout || 30000;
      return interval < min ? interval : min;
    }, Infinity);
  }

  private async runChecks(): Promise<void> {
    for (const config of this.configs) {
      try {
        const result = await healthCheckRegistry(config);
        if (result.success) {
          // Health check passed for ${config.url}
        } else {
          const logger = createLogger('HealthMonitor');
          logger.error(`Health check failed for ${config.url}: ${result.error}`);
        }
      } catch (error) {
        const logger = createLogger('HealthMonitor');
        logger.error(`Health check error for ${config.url}:`, error);
      }
    }
  }
}