import { ExternalAgent } from '@codespin/shaman-core/types/agent.js';

export interface RegistryResponse {
  agents: ExternalAgent[];
  nextPage?: string;
}

export interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  error?: string;
}

export interface RegistryConfig {
  url: string;
  timeout?: number;
  retries?: number;
}