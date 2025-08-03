import type { Result } from '@codespin/shaman-core';

export interface RunOptions {
  id: string;
  name: string;
  data: unknown;
  organizationId: string;
}

export interface RunStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  result?: unknown;
}

/**
 * Start a run
 */
export async function startRun(options: RunOptions): Promise<Result<{ id: string }, Error>> {
  // TODO: Implement with BullMQ
  return {
    success: true,
    data: { id: options.id }
  };
}

/**
 * Get run status
 */
export async function getRunStatus(id: string, _organizationId: string): Promise<Result<RunStatus, Error>> {
  // TODO: Implement with BullMQ
  return {
    success: true,
    data: {
      id,
      status: 'active'
    }
  };
}

/**
 * Cancel a run
 */
export async function cancelRun(_id: string, _organizationId: string): Promise<Result<void, Error>> {
  // TODO: Implement with BullMQ
  return {
    success: true,
    data: undefined
  };
}