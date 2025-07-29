import type { Run } from '@codespin/shaman-types';
import type { RunDbRow } from '../types.js';

/**
 * Map domain type to database row (for inserts/updates)
 */
export function mapRunToDb(run: Omit<Run, 'id' | 'startTime'> & { id?: string }): Partial<RunDbRow> {
  return {
    id: run.id,
    org_id: run.orgId,
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