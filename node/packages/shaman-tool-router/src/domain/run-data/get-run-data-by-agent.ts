import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Get run data by agent
 */
export async function getRunDataByAgent(
  db: Database,
  runId: string,
  agentName: string
): Promise<RunData[]> {
  const results = await db.manyOrNone<RunDataDbRow>(
    `SELECT * FROM run_data 
     WHERE run_id = $(runId) AND created_by_agent_name = $(agentName)
     ORDER BY created_at DESC`,
    { runId, agentName }
  );
  
  return results.map(mapRunDataFromDb);
}