import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Get run data by run ID and key
 */
export async function getRunData(
  db: Database,
  runId: string,
  key: string
): Promise<RunData[]> {
  const results = await db.manyOrNone<RunDataDbRow>(
    `SELECT * FROM run_data 
     WHERE run_id = $(runId) AND key = $(key)
     ORDER BY created_at DESC`,
    { runId, key }
  );
  
  return results.map(mapRunDataFromDb);
}