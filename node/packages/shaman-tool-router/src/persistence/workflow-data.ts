/**
 * Workflow data persistence functions
 */

import type { WorkflowData, AgentSource } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database row type for workflow_data table
 * Mirrors the exact database schema
 */
type WorkflowDataDbRow = {
  id: string;
  run_id: string;
  key: string;
  value: unknown;
  created_by_step_id: string;
  created_by_agent_name: string;
  created_by_agent_source: string;
  created_at: Date;
};

/**
 * Map database row to domain type
 */
function mapWorkflowDataFromDb(row: WorkflowDataDbRow): WorkflowData {
  return {
    id: row.id,
    runId: row.run_id,
    key: row.key,
    value: row.value,
    createdByStepId: row.created_by_step_id,
    createdByAgentName: row.created_by_agent_name,
    createdByAgentSource: row.created_by_agent_source as AgentSource,
    createdAt: row.created_at
  };
}

/**
 * Map domain type to database row (for inserts)
 */
function mapWorkflowDataToDb(data: Omit<WorkflowData, 'id' | 'createdAt'>): Omit<WorkflowDataDbRow, 'id' | 'created_at'> {
  return {
    run_id: data.runId,
    key: data.key,
    value: data.value,
    created_by_step_id: data.createdByStepId,
    created_by_agent_name: data.createdByAgentName,
    created_by_agent_source: data.createdByAgentSource
  };
}

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