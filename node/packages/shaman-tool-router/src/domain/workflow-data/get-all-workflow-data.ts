import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Get all workflow data for a run
 */
export async function getAllWorkflowData(
  db: Database,
  runId: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId)
     ORDER BY created_at DESC`,
    { runId }
  );
  
  return results.map(mapWorkflowDataFromDb);
}