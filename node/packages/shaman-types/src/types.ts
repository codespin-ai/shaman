/**
 * packages/shaman-types/src/types.ts
 *
 * This file contains the core TypeScript type definitions for the Shaman project,
 * particularly those related to the database schema.
 *
 * These interfaces use camelCase for property names, which is the standard
 * convention for TypeScript. The mapping to the snake_case column names in the
 * database is handled by the persistence layer.
 */

/**
 * Represents a record in the 'agent_repository' table.
 */
export interface AgentRepository {
  id: number;
  name: string;
  gitUrl: string;
  branch: string;
  isRoot: boolean;
  lastSyncCommitHash: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: 'NEVER_SYNCED' | 'SUCCESS' | 'IN_PROGRESS' | 'FAILED';
  lastSyncErrors: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a record in the 'git_agent' table.
 */
export interface GitAgent {
  id: number;
  agentRepositoryId: number;
  name: string;
  description: string | null;
  version: string | null;
  filePath: string;
  model: string | null;
  providers: Record<string, any> | null;
  mcpServers: Record<string, any> | null;
  allowedAgents: string[] | null;
  tags: string[] | null;
  lastModifiedCommitHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}
