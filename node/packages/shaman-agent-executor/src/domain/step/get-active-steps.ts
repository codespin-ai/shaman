import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import type { StepDbRow } from './types.js';

/**
 * Get active steps in a run
 */
export async function getActiveSteps(db: Database, runId: string): Promise<Step[]> {
  const results = await db.manyOrNone<StepDbRow>(
    `SELECT * FROM step 
     WHERE run_id = $(runId) 
     AND status IN ('WORKING', 'INPUT_REQUIRED')
     ORDER BY start_time ASC`,
    { runId }
  );
  
  return results.map(mapStepFromDb);
}