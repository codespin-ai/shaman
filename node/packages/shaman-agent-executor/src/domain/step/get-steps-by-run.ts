import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import type { StepDbRow } from './types.js';

/**
 * Get steps for a run
 */
export async function getStepsByRun(db: Database, runId: string): Promise<Step[]> {
  const results = await db.manyOrNone<StepDbRow>(
    `SELECT * FROM step 
     WHERE run_id = $(runId)
     ORDER BY start_time ASC`,
    { runId }
  );
  
  return results.map(mapStepFromDb);
}