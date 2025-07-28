/**
 * Adapter to map GraphQL resolver needs to actual persistence functions
 */

import { 
  getAgentRepository,
  getAgentRepositoryByUrl,
  getAllAgentRepositories as getRepos,
  saveAgentRepository,
  updateAgentRepository as updateRepo,
  deleteAgentRepository as deleteRepo,
  getGitAgentsByRepositoryId,
  getAllGitAgents,
  getRun,
  listRuns,
  getRunsNeedingInput as getRuns,
  createRun as createNewRun,
  updateRun,
  getStep,
} from '@codespin/shaman-persistence';
import type { Result } from '@codespin/shaman-core';
import type { User } from './types.js';
import type { AgentRepository, GitAgent, Run, Step } from '@codespin/shaman-types';

// Re-export getAllAgentRepositories
export const getAllAgentRepositories = getRepos;

// User management (stubs for now)
export async function getUserById(id: number): Promise<Result<User>> {
  // TODO: Implement user table in persistence
  return {
    success: false,
    error: new Error('User management not implemented'),
  };
}

export async function getAllUsers(limit: number, offset: number): Promise<Result<User[]>> {
  return {
    success: true,
    data: [],
  };
}

export async function createUser(data: Partial<User>): Promise<Result<User>> {
  return {
    success: false,
    error: new Error('User management not implemented'),
  };
}

export async function updateUser(id: number, data: Partial<User>): Promise<Result<User>> {
  return {
    success: false,
    error: new Error('User management not implemented'),
  };
}

// Repository management adapters
export async function getAgentRepositoryByName(name: string): Promise<Result<AgentRepository>> {
  const repos = await getAllAgentRepositories();
  const repo = repos.find(r => r.name === name);
  return repo 
    ? { success: true, data: repo }
    : { success: false, error: new Error('Repository not found') };
}

export async function createAgentRepository(data: Partial<AgentRepository>): Promise<Result<AgentRepository>> {
  try {
    // Ensure required fields are present
    const repoData = {
      name: data.name || '',
      gitUrl: data.gitUrl || '',
      branch: data.branch || 'main',
      isRoot: data.isRoot || false,
      lastSyncCommitHash: null,
      lastSyncAt: null,
      lastSyncStatus: 'NEVER_SYNCED' as const,
      lastSyncErrors: null,
    };
    const repo = await saveAgentRepository(repoData);
    return { success: true, data: repo };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export async function updateAgentRepository(name: string, data: Partial<AgentRepository>): Promise<Result<AgentRepository>> {
  const repos = await getAllAgentRepositories();
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
    const updated = await updateRepo(updatedRepo);
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export async function deleteAgentRepository(name: string): Promise<Result<boolean>> {
  const repos = await getAllAgentRepositories();
  const repo = repos.find(r => r.name === name);
  if (!repo) {
    return { success: false, error: new Error('Repository not found') };
  }
  
  const deleted = await deleteRepo(repo.id);
  return { success: true, data: deleted };
}

// Git agent adapters
export async function getGitAgentByName(name: string): Promise<Result<GitAgent>> {
  const agents = await getAllGitAgents();
  const agent = agents.find(a => a.name === name);
  return agent
    ? { success: true, data: agent }
    : { success: false, error: new Error('Agent not found') };
}

export async function getGitAgentsByRepository(repoName: string, limit: number, offset: number): Promise<Result<GitAgent[]>> {
  const repos = await getAllAgentRepositories();
  const repo = repos.find(r => r.name === repoName);
  if (!repo) {
    return { success: true, data: [] };
  }
  
  const agents = await getGitAgentsByRepositoryId(repo.id);
  // Apply limit and offset
  const paged = agents.slice(offset, offset + limit);
  return { success: true, data: paged };
}

export async function searchGitAgents(filters: Record<string, unknown>, limit: number, offset: number): Promise<Result<GitAgent[]>> {
  // TODO: Implement filtering
  const agents = await getAllGitAgents();
  const paged = agents.slice(offset, offset + limit);
  return { success: true, data: paged };
}

// Run management adapters
export async function getRunById(id: number): Promise<Result<Run>> {
  const run = await getRun(id.toString());
  return run
    ? { success: true, data: run }
    : { success: false, error: new Error('Run not found') };
}

export async function getRunsByUser(userId?: number, limit?: number, offset?: number): Promise<Result<Run[]>> {
  const runs = await listRuns({
    createdBy: userId?.toString(),
    limit,
    offset,
  });
  return { success: true, data: runs };
}

export async function getRunsNeedingInput(userId?: number, limit?: number): Promise<Result<Run[]>> {
  const runs = await getRuns(limit);
  // TODO: Filter by userId if provided
  return { success: true, data: runs };
}

export async function createRun(data: Partial<Run>): Promise<Result<Run>> {
  try {
    // Ensure required fields are present
    const runData = {
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
    const run = await createNewRun(runData);
    return { success: true, data: run };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export async function updateRunStatus(runId: string, status: string): Promise<Result<void>> {
  try {
    await updateRun(runId, { status: status as any });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Sync operations (stubs)
export function syncRepository(_gitUrl: string, _branch: string): Result<void> {
  // TODO: Trigger actual git sync
  return { success: true, data: undefined };
}

// Step management
export async function getStepById(id: string): Promise<Result<Step>> {
  const step = await getStep(id);
  return step
    ? { success: true, data: step }
    : { success: false, error: new Error('Step not found') };
}

// Additional repository management
export async function getAgentRepositoryById(id: number): Promise<Result<AgentRepository>> {
  const repo = await getAgentRepository(id);
  return repo
    ? { success: true, data: repo }
    : { success: false, error: new Error('Repository not found') };
}

// Agent execution stub
export function executeAgent(_agentName: string, _options: unknown): void {
  // TODO: Implement actual agent execution using shaman-agent-executor
  // This is a placeholder that will be replaced with actual implementation
}