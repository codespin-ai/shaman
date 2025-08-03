import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Get all run data for a run
 */
export async function getAllRunData(
  db: Database,
  runId: string
): Promise<RunData[]> {
  const results = await db.manyOrNone<RunDataDbRow>(
    `SELECT * FROM run_data 
     WHERE run_id = $(runId)
     ORDER BY created_at DESC`,
    { runId }
  );
  
  return results.map(mapRunDataFromDb);
}