/**
 * Run (workflow instance) persistence functions
 */

import type { Run, ExecutionState } from '@codespin/shaman-types';
import { db } from './db.js';

/**
 * Create a new run
 */
export async function createRun(
  run: Omit<Run, 'id' | 'startTime'> & { id?: string }
): Promise<Run> {
  const dbData = mapRunToDb(run);
  const result = await db.one<RunDbRow>(
    `INSERT INTO run 
     (id, status, initial_input, total_cost, start_time, created_by, trace_id, metadata)
     VALUES ($(id), $(status), $(initial_input), $(total_cost), $(start_time), $(created_by), $(trace_id), $(metadata))
     RETURNING *`,
    {
      id: dbData.id || generateRunId(),
      status: dbData.status,
      initial_input: dbData.initial_input,
      total_cost: dbData.total_cost,
      start_time: new Date(),
      created_by: dbData.created_by,
      trace_id: dbData.trace_id,
      metadata: dbData.metadata
    }
  );
  
  return mapRunFromDb(result);
}

/**
 * Get a run by ID
 */
export async function getRun(id: string): Promise<Run | null> {
  const result = await db.oneOrNone<RunDbRow>(
    `SELECT * FROM run WHERE id = $(id)`,
    { id }
  );
  
  return result ? mapRunFromDb(result) : null;
}

/**
 * Update a run
 */
export async function updateRun(
  id: string,
  updates: Partial<Omit<Run, 'id' | 'startTime' | 'createdBy'>>
): Promise<Run> {
  const sets = [];
  const params: Record<string, unknown> = { id };
  
  if (updates.status !== undefined) {
    sets.push('status = $(status)');
    params.status = updates.status;
  }
  
  if (updates.totalCost !== undefined) {
    sets.push('total_cost = $(totalCost)');
    params.totalCost = updates.totalCost;
  }
  
  if (updates.endTime !== undefined) {
    sets.push('end_time = $(endTime)');
    params.endTime = updates.endTime;
  }
  
  if (updates.duration !== undefined) {
    sets.push('duration = $(duration)');
    params.duration = updates.duration;
  }
  
  if (updates.metadata !== undefined) {
    sets.push('metadata = $(metadata)');
    params.metadata = updates.metadata;
  }
  
  const result = await db.one<RunDbRow>(
    `UPDATE run 
     SET ${sets.join(', ')}
     WHERE id = $(id)
     RETURNING *`,
    params
  );
  
  return mapRunFromDb(result);
}

/**
 * List runs with filters
 */
export async function listRuns(filters: {
  status?: ExecutionState;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}): Promise<Run[]> {
  let query = 'SELECT * FROM run WHERE 1=1';
  const params: Record<string, unknown> = {};
  
  if (filters.status) {
    query += ' AND status = $(status)';
    params.status = filters.status;
  }
  
  if (filters.createdBy) {
    query += ' AND created_by = $(createdBy)';
    params.createdBy = filters.createdBy;
  }
  
  if (filters.createdAfter) {
    query += ' AND start_time >= $(createdAfter)';
    params.createdAfter = filters.createdAfter;
  }
  
  if (filters.createdBefore) {
    query += ' AND start_time <= $(createdBefore)';
    params.createdBefore = filters.createdBefore;
  }
  
  query += ' ORDER BY start_time DESC';
  
  if (filters.limit) {
    query += ' LIMIT $(limit)';
    params.limit = filters.limit;
  }
  
  if (filters.offset) {
    query += ' OFFSET $(offset)';
    params.offset = filters.offset;
  }
  
  const results = await db.manyOrNone<RunDbRow>(query, params);
  return results.map(mapRunFromDb);
}

/**
 * Get runs needing input
 */
export async function getRunsNeedingInput(limit?: number): Promise<Run[]> {
  const query = `
    SELECT * FROM run 
    WHERE status IN ('INPUT_REQUIRED', 'BLOCKED_ON_INPUT')
    ORDER BY start_time DESC
    ${limit ? 'LIMIT $(limit)' : ''}
  `;
  
  const results = await db.manyOrNone<RunDbRow>(query, { limit });
  return results.map(mapRunFromDb);
}

/**
 * Database row type for run table
 * Mirrors the exact database schema
 */
type RunDbRow = {
  id: string;
  status: string;
  initial_input: string;
  total_cost: number;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  created_by: string;
  trace_id: string | null;
  metadata: unknown;
};

/**
 * Map database row to domain type
 */
function mapRunFromDb(row: RunDbRow): Run {
  return {
    id: row.id,
    status: row.status as ExecutionState,
    initialInput: row.initial_input,
    totalCost: row.total_cost,
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration || undefined,
    createdBy: row.created_by,
    traceId: row.trace_id || undefined,
    metadata: row.metadata as Record<string, unknown> | undefined
  };
}

/**
 * Map domain type to database row (for inserts/updates)
 */
function mapRunToDb(run: Omit<Run, 'id' | 'startTime'> & { id?: string }): Partial<RunDbRow> {
  return {
    id: run.id,
    status: run.status,
    initial_input: run.initialInput,
    total_cost: run.totalCost,
    created_by: run.createdBy,
    trace_id: run.traceId || null,
    metadata: run.metadata || null,
    end_time: run.endTime || null,
    duration: run.duration || null
  };
}

/**
 * Generate a run ID
 */
function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}