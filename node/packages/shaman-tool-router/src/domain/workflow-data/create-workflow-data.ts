import type { WorkflowData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { v4 as uuidv4 } from 'uuid';
import { mapWorkflowDataFromDb } from './mappers/map-workflow-data-from-db.js';
import { mapWorkflowDataToDb } from './mappers/map-workflow-data-to-db.js';
import type { WorkflowDataDbRow } from './types.js';

/**
 * Create a workflow data entry
 */
export async function createWorkflowData(
  db: Database,
  data: Omit<WorkflowData, 'id' | 'createdAt'>
): Promise<WorkflowData> {
  const id = uuidv4();
  const createdAt = new Date();
  const dbData = mapWorkflowDataToDb(data);
  
  const result = await db.one<WorkflowDataDbRow>(
    `INSERT INTO workflow_data 
     (id, run_id, key, value, created_by_step_id, created_by_agent_name, created_by_agent_source, created_at)
     VALUES ($(id), $(run_id), $(key), $(value), $(created_by_step_id), $(created_by_agent_name), $(created_by_agent_source), $(created_at))
     RETURNING *`,
    {
      id,
      run_id: dbData.run_id,
      key: dbData.key,
      value: dbData.value,
      created_by_step_id: dbData.created_by_step_id,
      created_by_agent_name: dbData.created_by_agent_name,
      created_by_agent_source: dbData.created_by_agent_source,
      created_at: createdAt
    }
  );
  
  return mapWorkflowDataFromDb(result);
}