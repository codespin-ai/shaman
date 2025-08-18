import type { Result } from "@codespin/shaman-core/dist/types/result.js";
import { success, failure } from "@codespin/shaman-core/dist/types/result.js";
import type { ExternalAgent } from "@codespin/shaman-core/dist/types/agent.js";
import type { RegistryResponse, HealthStatus } from "./types.js";

interface RegistryConfig {
  url: string;
  timeout?: number;
  retries?: number;
}

export async function fetchAgentsFromRegistry(
  config: RegistryConfig,
): Promise<Result<ExternalAgent[], string>> {
  try {
    const response = await fetch(`${config.url}/agents`, {
      signal: AbortSignal.timeout(config.timeout || 30000),
    });

    if (!response.ok) {
      return failure(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as RegistryResponse;
    return success(data.agents);
  } catch (error) {
    return failure(
      `Registry fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function healthCheckRegistry(
  config: RegistryConfig,
): Promise<Result<HealthStatus, string>> {
  try {
    const response = await fetch(`${config.url}/health`, {
      signal: AbortSignal.timeout(config.timeout || 10000),
    });

    if (!response.ok) {
      return failure(`Health check failed: HTTP ${response.status}`);
    }

    const status: HealthStatus = {
      healthy: true,
      lastCheck: new Date(),
    };

    return success(status);
  } catch (error) {
    const status: HealthStatus = {
      healthy: false,
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : String(error),
    };

    return success(status);
  }
}

export async function registerAgent(
  config: RegistryConfig,
  agent: ExternalAgent,
): Promise<Result<void, string>> {
  try {
    const response = await fetch(`${config.url}/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agent),
      signal: AbortSignal.timeout(config.timeout || 30000),
    });

    if (!response.ok) {
      return failure(`Registration failed: HTTP ${response.status}`);
    }

    return success(undefined);
  } catch (error) {
    return failure(
      `Registration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
