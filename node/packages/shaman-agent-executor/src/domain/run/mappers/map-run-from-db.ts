import type { Run, ExecutionState } from '@codespin/shaman-types';
import type { RunDbRow } from '../types.js';

/**
 * Map database row to domain type
 */
export function mapRunFromDb(row: RunDbRow): Run {
  return {
    id: row.id,
    orgId: row.org_id,
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