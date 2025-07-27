/**
 * Workflow data persistence functions
 */

import type { WorkflowData, AgentSource } from '@codespin/shaman-types';
import { db } from './db.js';
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
 * Query workflow data with pattern matching
 */
export async function queryWorkflowData(
  runId: string,
  pattern: string,
  limit?: number
): Promise<WorkflowData[]> {
  // Convert simple wildcards to SQL LIKE pattern
  const sqlPattern = pattern
    .replace(/\*/g, '%')
    .replace(/\?/g, '_');
  
  const query = `
    SELECT * FROM workflow_data 
    WHERE run_id = $(runId) AND key LIKE $(pattern)
    ORDER BY created_at DESC
    ${limit ? 'LIMIT $(limit)' : ''}
  `;
  
  const results = await db.manyOrNone<WorkflowDataDbRow>(query, {
    runId,
    pattern: sqlPattern,
    limit
  });
  
  return results.map(mapWorkflowDataFromDb);
}

/**
 * List workflow data keys with aggregation
 */
export async function listWorkflowDataKeys(
  runId: string,
  filters?: {
    agentName?: string;
    prefix?: string;
  }
): Promise<Array<{ key: string; count: number; agents: string[] }>> {
  let query = `
    SELECT 
      key,
      COUNT(*)::int as count,
      ARRAY_AGG(DISTINCT created_by_agent_name) as agents
    FROM workflow_data
    WHERE run_id = $(runId)
  `;
  
  const params: Record<string, unknown> = { runId };
  
  if (filters?.agentName) {
    query += ` AND created_by_agent_name = $(agentName)`;
    params.agentName = filters.agentName;
  }
  
  if (filters?.prefix) {
    query += ` AND key LIKE $(prefix)`;
    params.prefix = filters.prefix + '%';
  }
  
  query += ` GROUP BY key ORDER BY key`;
  
  const results = await db.manyOrNone<{ key: string; count: string; agents: string[] }>(query, params);
  
  return results.map(row => ({
    key: row.key,
    count: parseInt(row.count, 10),
    agents: row.agents
  }));
}

/**
 * Get all workflow data for a run
 */
export async function getAllWorkflowData(
  runId: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone<WorkflowDataDbRow>(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId)
     ORDER BY created_at ASC`,
    { runId }
  );
  
  return results.map(mapWorkflowDataFromDb);
}

/**
 * Delete workflow data for a run (cleanup)
 */
export async function deleteWorkflowData(
  runId: string
): Promise<number> {
  const result = await db.result(
    `DELETE FROM workflow_data WHERE run_id = $(runId)`,
    { runId }
  );
  
  return result.rowCount;
}