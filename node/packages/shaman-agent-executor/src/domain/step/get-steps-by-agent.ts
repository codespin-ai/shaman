import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import type { StepDbRow } from './types.js';

/**
 * Get steps by agent
 */
export async function getStepsByAgent(
  db: Database,
  runId: string,
  agentName: string
): Promise<Step[]> {
  const results = await db.manyOrNone<StepDbRow>(
    `SELECT * FROM step 
     WHERE run_id = $(runId) 
     AND agent_name = $(agentName)
     ORDER BY start_time ASC`,
    { runId, agentName }
  );
  
  return results.map(mapStepFromDb);
}