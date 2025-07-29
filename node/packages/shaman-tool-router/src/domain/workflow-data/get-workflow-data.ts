import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Get workflow data by run ID and key
 */
export async function getWorkflowData(
  db: Database,
  runId: string,
  key: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId) AND key = $(key)
     ORDER BY created_at DESC`,
    { runId, key }
  );
  
  return results.map(mapWorkflowDataFromDb);
}