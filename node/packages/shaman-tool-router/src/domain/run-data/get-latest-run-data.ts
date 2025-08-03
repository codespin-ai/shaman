import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Get latest run data by run ID and key
 */
export async function getLatestRunData(
  db: Database,
  runId: string,
  key: string
): Promise<RunData | null> {
  const result = await db.oneOrNone<RunDataDbRow>(
    `SELECT * FROM run_data 
     WHERE run_id = $(runId) AND key = $(key)
     ORDER BY created_at DESC
     LIMIT 1`,
    { runId, key }
  );
  
  return result ? mapRunDataFromDb(result) : null;
}