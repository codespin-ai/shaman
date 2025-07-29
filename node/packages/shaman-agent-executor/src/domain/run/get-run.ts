import type { Run } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunFromDb } from './mappers/map-run-from-db.js';
import type { RunDbRow } from './types.js';

/**
 * Get a run by ID
 */
export async function getRun(db: Database, id: string, orgId: string): Promise<Run | null> {
  const result = await db.oneOrNone<RunDbRow>(
    `SELECT * FROM run WHERE id = $(id) AND org_id = $(orgId)`,
    { id, orgId }
  );
  
  return result ? mapRunFromDb(result) : null;
}