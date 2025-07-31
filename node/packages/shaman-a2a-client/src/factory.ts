/**
 * Factory function for creating A2A client
 */

import { A2AClient } from './client.js';
import type { A2AClientConfig } from './types.js';

/**
 * Create an A2A client instance
 */
export function createA2AClient(config: A2AClientConfig): A2AClient {
  return new A2AClient(config);
}