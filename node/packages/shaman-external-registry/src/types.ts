import type { ExternalAgent } from "@codespin/shaman-core/dist/types/agent.js";

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
