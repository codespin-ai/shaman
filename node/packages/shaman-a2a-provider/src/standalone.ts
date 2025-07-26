/**
 * packages/shaman-a2a-provider/src/standalone.ts
 * 
 * Standalone A2A provider server
 */

import { createA2AServer } from './a2a-server.js';
import { A2AProviderConfig } from './types.js';
import { AgentsConfig } from '@codespin/shaman-agents';

/**
 * Start a standalone A2A provider server
 */
export async function startA2AProvider(
  config: A2AProviderConfig,
  agentsConfig: AgentsConfig
): Promise<void> {
  const port = config.port || 3001;
  const app = createA2AServer(config, agentsConfig);
  
  app.listen(port, () => {
    console.log(`Shaman A2A Provider started on port ${port}`);
    console.log(`Base path: ${config.basePath || '/a2a/v1'}`);
    console.log(`Health check: http://localhost:${port}${config.basePath || '/a2a/v1'}/health`);
    console.log(`Agent discovery: http://localhost:${port}${config.basePath || '/a2a/v1'}/agents`);
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