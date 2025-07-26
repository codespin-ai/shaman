/**
 * @fileoverview Defines types for the external agent registry.
 */

import { ExternalAgent } from '@shaman/core/types/agent.js';

export type ExternalAgentAuthConfig = {
  type: 'none' | 'apiKey' | 'bearer';
  token?: string;
  header?: string;
};

export type ExternalAgentConfig = {
  name: string;
  url: string;
  auth: ExternalAgentAuthConfig;
  healthCheck?: {
    interval: number; // in seconds
    timeout: number; // in milliseconds
  };
};

export type RegisteredAgent = ExternalAgent & {
  config: ExternalAgentConfig;
  lastHealthCheck?: {
    status: 'healthy' | 'unhealthy';
    timestamp: number;
    error?: string;
  };
};
