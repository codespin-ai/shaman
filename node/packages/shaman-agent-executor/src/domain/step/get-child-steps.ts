import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import type { StepDbRow } from './types.js';

/**
 * Get child steps
 */
export async function getChildSteps(db: Database, parentStepId: string): Promise<Step[]> {
  const results = await db.manyOrNone<StepDbRow>(
    `SELECT * FROM step 
     WHERE parent_step_id = $(parentStepId)
     ORDER BY start_time ASC`,
    { parentStepId }
  );
  
  return results.map(mapStepFromDb);
}