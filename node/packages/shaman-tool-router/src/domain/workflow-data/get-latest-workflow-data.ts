import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Get latest workflow data by run ID and key
 */
export async function getLatestWorkflowData(
  db: Database,
  runId: string,
  key: string
): Promise<WorkflowData | null> {
  const result = await db.oneOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId) AND key = $(key)
     ORDER BY created_at DESC
     LIMIT 1`,
    { runId, key }
  );
  
  return result ? mapWorkflowDataFromDb(result) : null;
}