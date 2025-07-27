/**
 * packages/shaman-a2a-provider/src/standalone.ts
 * 
 * Standalone A2A provider server
 */

import { createA2AServer } from './a2a-server.js';
import type { A2AProviderConfig } from './types.js';
import type { AgentsConfig } from '@codespin/shaman-agents';

/**
 * Start a standalone A2A provider server
 */
export function startA2AProvider(
  config: A2AProviderConfig,
  agentsConfig: AgentsConfig
): void {
  const port = config.port || 3001;
  const app = createA2AServer(config, agentsConfig);
  
  app.listen(port, () => {
    console.error(`Shaman A2A Provider started on port ${port}`);
    console.error(`Base path: ${config.basePath || '/a2a/v1'}`);
    console.error(`Health check: http://localhost:${port}${config.basePath || '/a2a/v1'}/health`);
    console.error(`Agent discovery: http://localhost:${port}${config.basePath || '/a2a/v1'}/agents`);
  });
}

/**
 * Default configuration for development
 */
export const defaultA2AConfig: A2AProviderConfig = {
  port: 3001,
  basePath: '/a2a/v1',
  authentication: {
    type: 'none'
  },
  rateLimiting: {
    enabled: false,
    maxRequests: 100,
    windowMs: 60000 // 1 minute
  },
  metadata: {
    organizationName: 'Shaman Development',
    documentation: 'https://github.com/codespin-ai/shaman'
  }
};