import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Query workflow data by pattern
 */
export async function queryWorkflowData(
  db: Database,
  runId: string,
  keyPattern: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId) AND key LIKE $(keyPattern)
     ORDER BY created_at DESC`,
    { runId, keyPattern }
  );
  
  return results.map(mapWorkflowDataFromDb);
}