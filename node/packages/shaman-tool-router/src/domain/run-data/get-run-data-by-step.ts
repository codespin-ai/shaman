import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Get run data by step ID
 */
export async function getRunDataByStep(
  db: Database,
  stepId: string
): Promise<RunData[]> {
  const results = await db.manyOrNone<RunDataDbRow>(
    `SELECT * FROM run_data 
     WHERE created_by_step_id = $(stepId)
     ORDER BY created_at DESC`,
    { stepId }
  );
  
  return results.map(mapRunDataFromDb);
}