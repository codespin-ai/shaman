/**
 * Agent resolution logic
 */

import type { Result } from '@codespin/shaman-core';
import type { AgentDefinition } from './types.js';
import matter from 'gray-matter';

/**
 * Agent frontmatter type
 */
type AgentFrontmatter = {
  name?: unknown;
  description?: unknown;
  version?: unknown;
  model?: unknown;
  systemPrompt?: unknown;
  mcpServers?: unknown;
  allowedAgents?: unknown;
  maxIterations?: unknown;
  temperature?: unknown;
  contextScope?: unknown;
};

/**
 * Parse agent markdown file to extract definition
 */
export function parseAgentMarkdown(content: string): Result<AgentDefinition> {
  try {
    const { data, content: body } = matter(content);
    const frontmatter = data as AgentFrontmatter;
    
    // Validate required fields
    if (!frontmatter.name || typeof frontmatter.name !== 'string') {
      return {
        success: false,
        error: new Error('Agent must have a name in frontmatter')
      };
    }

    // Build agent definition with proper type checking
    const agent: AgentDefinition = {
      name: frontmatter.name,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      version: typeof frontmatter.version === 'string' ? frontmatter.version : undefined,
      model: typeof frontmatter.model === 'string' ? frontmatter.model : undefined,
      systemPrompt: body.trim() || (typeof frontmatter.systemPrompt === 'string' ? frontmatter.systemPrompt : undefined),
      mcpServers: typeof frontmatter.mcpServers === 'object' && frontmatter.mcpServers !== null ? frontmatter.mcpServers as Record<string, string[] | '*' | null> : {},
      allowedAgents: Array.isArray(frontmatter.allowedAgents) 
        ? frontmatter.allowedAgents.filter((a): a is string => typeof a === 'string')
        : typeof frontmatter.allowedAgents === 'string'
          ? [frontmatter.allowedAgents]
          : [],
      maxIterations: typeof frontmatter.maxIterations === 'number' ? frontmatter.maxIterations : 10,
      temperature: typeof frontmatter.temperature === 'number' ? frontmatter.temperature : undefined,
      contextScope: frontmatter.contextScope === 'FULL' || frontmatter.contextScope === 'NONE' || frontmatter.contextScope === 'SPECIFIC' 
        ? frontmatter.contextScope 
        : 'FULL'
    };

    return { success: true, data: agent };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Failed to parse agent markdown')
    };
  }
}

/**
 * Create an agent resolver that uses the shaman-agents package
 */
export function createAgentResolver(
  agentSource: {
    getAgent: (name: string) => Promise<{ content: string } | null>;
  }
): (name: string) => Promise<Result<AgentDefinition>> {
  return async (name: string) => {
    try {
      // Get agent from source (Git or A2A)
      const agent = await agentSource.getAgent(name);
      
      if (!agent) {
        return {
          success: false,
          error: new Error(`Agent ${name} not found`)
        };
      }

      // Parse the agent definition
      return parseAgentMarkdown(agent.content);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(`Failed to resolve agent ${name}`)
      };
    }
  };
}

/**
 * Validate agent can call another agent
 */
export function canAgentCall(
  caller: AgentDefinition,
  targetName: string
): boolean {
  // If no allowedAgents specified, allow all
  if (!caller.allowedAgents || caller.allowedAgents.length === 0) {
    return true;
  }

  // Check if target is in allowed list
  return caller.allowedAgents.includes(targetName) || 
         caller.allowedAgents.includes('*');
}

/**
 * Get MCP servers available to an agent
 */
export function getAgentMcpServers(
  agent: AgentDefinition
): Array<{ name: string; tools: string[] | '*' }> {
  if (!agent.mcpServers) {
    return [];
  }

  return Object.entries(agent.mcpServers)
    .filter(([_, tools]) => tools !== null)
    .map(([name, tools]) => ({
      name,
      tools: tools === '*' ? '*' : tools as string[]
    }));
}