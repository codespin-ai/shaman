/**
 * packages/shaman-a2a-provider/src/agent-adapter.ts
 * 
 * Functions to adapt GitAgent to A2A protocol format
 */

import { GitAgent } from '@codespin/shaman-types';
import { A2AAgentCard, A2AProviderConfig } from './types.js';

/**
 * Convert a GitAgent to A2A Agent Card format
 */
export function convertToA2ACard(agent: GitAgent, baseUrl: string): A2AAgentCard {
  const basePath = '/a2a/v1'; // TODO: Get from config
  
  return {
    name: agent.name,
    description: agent.description || 'No description available',
    version: agent.version || undefined,
    capabilities: extractCapabilities(agent),
    tags: agent.tags || undefined,
    endpoint: `${baseUrl}${basePath}/agents/${encodeURIComponent(agent.name)}/execute`
  };
}

/**
 * Check if an agent can be exposed via A2A based on configuration
 */
export function canExposeAgent(agent: GitAgent, config: A2AProviderConfig): boolean {
  // Check whitelist
  if (config.allowedAgents && config.allowedAgents.length > 0) {
    return config.allowedAgents.includes(agent.name);
  }
  
  // Check blacklist
  if (config.excludedAgents && config.excludedAgents.length > 0) {
    return !config.excludedAgents.includes(agent.name);
  }
  
  // By default, expose all agents
  return true;
}

/**
 * Extract capabilities from agent configuration
 */
function extractCapabilities(agent: GitAgent): string[] {
  const capabilities: string[] = [];
  
  // Add capabilities based on agent configuration
  if (agent.model) {
    capabilities.push(`llm:${agent.model}`);
  }
  
  if (agent.mcpServers) {
    // Extract tool categories from MCP servers
    Object.keys(agent.mcpServers).forEach(server => {
      capabilities.push(`tools:${server}`);
    });
  }
  
  if (agent.allowedAgents && agent.allowedAgents.length > 0) {
    capabilities.push('delegation');
  }
  
  // Add tag-based capabilities
  if (agent.tags) {
    agent.tags.forEach(tag => {
      if (tag.startsWith('capability:')) {
        capabilities.push(tag.substring('capability:'.length));
      }
    });
  }
  
  return capabilities;
}