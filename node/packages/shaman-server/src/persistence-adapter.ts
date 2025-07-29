/**
 * Adapter to map GraphQL resolver needs to actual persistence functions
 */

import { getDb } from '@codespin/shaman-db';
import { 
  getAgentRepository,
  getAllAgentRepositories as getRepos,
  saveAgentRepository,
  updateAgentRepository as updateRepo,
  deleteAgentRepository as deleteRepo,
  getGitAgentsByRepositoryId,
  getAllGitAgents,
} from '@codespin/shaman-git-resolver';
import {
  getRun,
  listRuns,
  getRunsNeedingInput as getRuns,
  createRun as createNewRun,
  updateRun,
  getStep,
} from '@codespin/shaman-agent-executor';
import type { Result } from '@codespin/shaman-core';
import type { User } from './types.js';
import type { AgentRepository, GitAgent, Run, Step, ExecutionState } from '@codespin/shaman-types';

// Re-export getAllAgentRepositories with db
export const getAllAgentRepositories = (orgId: string) => {
  const db = getDb();
  return getRepos(db, orgId);
};

// User management (stubs for now)
export async function getUserById(_id: string): Promise<Result<User>> {
  // TODO: Implement user table in persistence
  return {
    success: false,
    error: new Error('User management not implemented'),
  };
}

export async function getAllUsers(_limit: number, _offset: number): Promise<Result<User[]>> {
  return {
    success: true,
    data: [],
  };
}

export async function createUser(_data: Partial<User>): Promise<Result<User>> {
  return {
    success: false,
    error: new Error('User management not implemented'),
  };
}

export async function updateUser(_id: string, _data: Partial<User>): Promise<Result<User>> {
  return {
    success: false,
    error: new Error('User management not implemented'),
  };
}

// Repository management adapters
export async function getAgentRepositoryByName(name: string, orgId: string): Promise<Result<AgentRepository>> {
  const repos = await getAllAgentRepositories(orgId);
  const repo = repos.find(r => r.name === name);
  return repo 
    ? { success: true, data: repo }
    : { success: false, error: new Error('Repository not found') };
}

export async function createAgentRepository(data: Partial<AgentRepository>): Promise<Result<AgentRepository>> {
  try {
    // Ensure required fields are present
    const repoData = {
      orgId: data.orgId || '',
      name: data.name || '',
      gitUrl: data.gitUrl || '',
      branch: data.branch || 'main',
      isRoot: data.isRoot || false,
      lastSyncCommitHash: null,
      lastSyncAt: null,
      lastSyncStatus: 'NEVER_SYNCED' as const,
      lastSyncErrors: null,
      createdBy: data.createdBy || '',
    };
    const db = getDb();
    const repo = await saveAgentRepository(db, repoData);
    return { success: true, data: repo };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export async function updateAgentRepository(name: string, orgId: string, data: Partial<AgentRepository>): Promise<Result<AgentRepository>> {
  const repos = await getAllAgentRepositories(orgId);
  const repo = repos.find(r => r.name === name);
  if (!repo) {
    return { success: false, error: new Error('Repository not found') };
  }
  
  try {
    // Merge the updates with the existing repository
    const updatedRepo = {
      ...repo,
      ...data,
      id: repo.id, // Ensure ID doesn't get overwritten
    };
    const db = getDb();
    const updated = await updateRepo(db, updatedRepo);
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export async function deleteAgentRepository(name: string, orgId: string): Promise<Result<boolean>> {
  const repos = await getAllAgentRepositories(orgId);
  const repo = repos.find(r => r.name === name);
  if (!repo) {
    return { success: false, error: new Error('Repository not found') };
  }
  
  const db = getDb();
  const deleted = await deleteRepo(db, repo.id);
  return { success: true, data: deleted };
}

// Git agent adapters
export async function getGitAgentByName(name: string, orgId: string): Promise<Result<GitAgent>> {
  const db = getDb();
  const agents = await getAllGitAgents(db, orgId);
  const agent = agents.find(a => a.name === name);
  return agent
    ? { success: true, data: agent }
    : { success: false, error: new Error('Agent not found') };
}

export async function getGitAgentsByRepository(repoName: string, orgId: string, limit: number, offset: number): Promise<Result<GitAgent[]>> {
  const repos = await getAllAgentRepositories(orgId);
  const repo = repos.find(r => r.name === repoName);
  if (!repo) {
    return { success: true, data: [] };
  }
  
  const db = getDb();
  const agents = await getGitAgentsByRepositoryId(db, repo.id);
  // Apply limit and offset
  const paged = agents.slice(offset, offset + limit);
  return { success: true, data: paged };
}

export async function searchGitAgents(orgId: string, filters: Record<string, unknown>, limit: number, offset: number): Promise<Result<GitAgent[]>> {
  // TODO: Implement filtering
  const db = getDb();
  const agents = await getAllGitAgents(db, orgId);
  const paged = agents.slice(offset, offset + limit);
  return { success: true, data: paged };
}

// Run management adapters
export async function getRunById(id: string, orgId: string): Promise<Result<Run>> {
  const db = getDb();
  const run = await getRun(db, id, orgId);
  return run
    ? { success: true, data: run }
    : { success: false, error: new Error('Run not found') };
}

export async function getRunsByUser(orgId: string, userId?: string, limit?: number, offset?: number): Promise<Result<Run[]>> {
  const db = getDb();
  const runs = await listRuns(db, orgId, {
    createdBy: userId,
    limit,
    offset,
  });
  return { success: true, data: runs };
}

export async function getRunsNeedingInput(orgId: string, userId?: string, limit?: number): Promise<Result<Run[]>> {
  const db = getDb();
  const runs = await getRuns(db, orgId, limit);
  // TODO: Filter by userId if provided
  return { success: true, data: runs };
}

export async function createRun(data: Partial<Run>): Promise<Result<Run>> {
  try {
    // Ensure required fields are present
    const runData = {
      orgId: data.orgId || '',
      status: data.status || 'SUBMITTED' as const,
      initialInput: data.initialInput || '',
      createdBy: data.createdBy || '',
      agentOverrides: null,
      sessionStore: null,
      completionOutput: null,
      endTime: undefined,
      totalCost: 0,
      totalTokens: 0,
    };
    const db = getDb();
    const run = await createNewRun(db, runData);
    return { success: true, data: run };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export async function updateRunStatus(runId: string, status: string): Promise<Result<void>> {
  try {
    const db = getDb();
    await updateRun(db, runId, { status: status as ExecutionState });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Sync operations (stubs)
export async function syncRepository(_gitUrl: string, _branch: string): Promise<Result<void>> {
  // TODO: Trigger actual git sync
  return { success: true, data: undefined };
}

// Step management
export async function getStepById(id: string): Promise<Result<Step>> {
  const db = getDb();
  const step = await getStep(db, id);
  return step
    ? { success: true, data: step }
    : { success: false, error: new Error('Step not found') };
}

// Additional repository management
export async function getAgentRepositoryById(id: number, orgId: string): Promise<Result<AgentRepository>> {
  const db = getDb();
  const repo = await getAgentRepository(db, id, orgId);
  return repo
    ? { success: true, data: repo }
    : { success: false, error: new Error('Repository not found') };
}

// Agent execution stub
export function executeAgent(_agentName: string, _options: unknown): void {
  // TODO: Implement actual agent execution using shaman-agent-executor
  // This is a placeholder that will be replaced with actual implementation
}