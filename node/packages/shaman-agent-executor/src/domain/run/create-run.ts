import type { Run } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunFromDb } from './mappers/map-run-from-db.js';
import { mapRunToDb } from './mappers/map-run-to-db.js';
import { generateRunId } from './generate-run-id.js';
import type { RunDbRow } from './types.js';

/**
 * Create a new run
 */
export async function createRun(
  db: Database,
  run: Omit<Run, 'id' | 'startTime'> & { id?: string }
): Promise<Run> {
  const dbData = mapRunToDb(run);
  const result = await db.one<RunDbRow>(
    `INSERT INTO run 
     (id, org_id, status, initial_input, total_cost, start_time, created_by, trace_id, metadata)
     VALUES ($(id), $(org_id), $(status), $(initial_input), $(total_cost), $(start_time), $(created_by), $(trace_id), $(metadata))
     RETURNING *`,
    {
      id: dbData.id || generateRunId(),
      org_id: dbData.org_id,
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