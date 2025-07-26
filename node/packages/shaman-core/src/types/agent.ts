/**
 * @fileoverview Defines the core data structures for agents.
 */

/**
 * Common properties for any agent, internal or external.
 */
export type BaseAgent = {
  readonly name: string;
  readonly description: string;
};

/**
 * LLM Configuration for Git-based agents.
 */
export type AgentLLMConfig = {
  readonly provider: string;
  readonly model: string;
  readonly temperature?: number;
  readonly topP?: number;
};

/**
 * An agent defined in a Git repository, executed by the system.
 */
export type GitAgent = BaseAgent & {
  readonly source: 'git';
  readonly repositoryUrl: string;
  readonly commitHash: string;
  readonly filePath: string;
  readonly prompt: string;
  readonly llm: AgentLLMConfig;
  readonly allowedTools: readonly string[];
  readonly allowedAgents: readonly string[];
};

/**
 * An agent hosted on an external system, accessible via A2A protocol.
 */
export type ExternalAgent = BaseAgent & {
  readonly source: 'external';
  readonly endpoint: string;
  readonly agentCard?: Record<string, unknown>;
};

/**
 * The unified Agent type.
 */
export type Agent = GitAgent | ExternalAgent;
