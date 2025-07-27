/**
 * Agent resolution logic
 */

import type { Result } from '@codespin/shaman-workflow-core';
import type { AgentDefinition } from './types.js';
import matter from 'gray-matter';

/**
 * Parse agent markdown file to extract definition
 */
export function parseAgentMarkdown(content: string): Result<AgentDefinition> {
  try {
    const { data: frontmatter, content: body } = matter(content);
    
    // Validate required fields
    if (!frontmatter.name || typeof frontmatter.name !== 'string') {
      return {
        success: false,
        error: new Error('Agent must have a name in frontmatter')
      };
    }

    // Build agent definition
    const agent: AgentDefinition = {
      name: frontmatter.name,
      description: frontmatter.description || '',
      version: frontmatter.version,
      model: frontmatter.model,
      systemPrompt: body.trim() || frontmatter.systemPrompt,
      mcpServers: frontmatter.mcpServers || {},
      allowedAgents: Array.isArray(frontmatter.allowedAgents) 
        ? frontmatter.allowedAgents 
        : frontmatter.allowedAgents 
          ? [frontmatter.allowedAgents]
          : [],
      maxIterations: frontmatter.maxIterations || 10,
      temperature: frontmatter.temperature,
      contextScope: frontmatter.contextScope || 'FULL'
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