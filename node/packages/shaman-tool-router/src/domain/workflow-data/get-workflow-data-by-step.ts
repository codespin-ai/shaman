import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Get workflow data by step ID
 */
export async function getWorkflowDataByStep(
  db: Database,
  stepId: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE created_by_step_id = $(stepId)
     ORDER BY created_at DESC`,
    { stepId }
  );
  
  return results.map(mapWorkflowDataFromDb);
}