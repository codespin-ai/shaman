import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Query run data by pattern
 */
export async function queryRunData(
  db: Database,
  runId: string,
  keyPattern: string
): Promise<RunData[]> {
  const results = await db.manyOrNone<RunDataDbRow>(
    `SELECT * FROM run_data 
     WHERE run_id = $(runId) AND key LIKE $(keyPattern)
     ORDER BY created_at DESC`,
    { runId, keyPattern }
  );
  
  return results.map(mapRunDataFromDb);
}