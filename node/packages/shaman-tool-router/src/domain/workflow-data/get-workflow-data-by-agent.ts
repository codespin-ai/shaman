import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Get workflow data by agent
 */
export async function getWorkflowDataByAgent(
  db: Database,
  runId: string,
  agentName: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId) AND created_by_agent_name = $(agentName)
     ORDER BY created_at DESC`,
    { runId, agentName }
  );
  
  return results.map(mapWorkflowDataFromDb);
}