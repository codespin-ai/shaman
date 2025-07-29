import type { Run } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunFromDb } from './mappers/map-run-from-db.js';
import type { RunDbRow } from './types.js';

/**
 * Get runs needing input
 */
export async function getRunsNeedingInput(db: Database, orgId: string, limit?: number): Promise<Run[]> {
  const query = `
    SELECT * FROM run 
    WHERE org_id = $(orgId) AND status IN ('INPUT_REQUIRED', 'BLOCKED_ON_INPUT')
    ORDER BY start_time DESC
    ${limit ? 'LIMIT $(limit)' : ''}
  `;
  
  const results = await db.manyOrNone<RunDbRow>(query, { orgId, limit });
  return results.map(mapRunFromDb);
}