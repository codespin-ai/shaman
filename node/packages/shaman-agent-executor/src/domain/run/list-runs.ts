import type { Run, ExecutionState } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunFromDb } from './mappers/map-run-from-db.js';
import type { RunDbRow } from './types.js';

/**
 * List runs with filters
 */
export async function listRuns(db: Database, orgId: string, filters: {
  status?: ExecutionState;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}): Promise<Run[]> {
  let query = 'SELECT * FROM run WHERE org_id = $(orgId)';
  const params: Record<string, unknown> = { orgId };
  
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