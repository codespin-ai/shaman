import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import type { StepDbRow } from './types.js';

/**
 * Get a step by ID
 */
export async function getStep(db: Database, id: string): Promise<Step | null> {
  const result = await db.oneOrNone<StepDbRow>(
    `SELECT * FROM step WHERE id = $(id)`,
    { id }
  );
  
  return result ? mapStepFromDb(result) : null;
}