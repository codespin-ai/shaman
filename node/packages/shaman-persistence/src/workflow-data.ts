/**
 * Workflow data persistence functions
 */

import type { WorkflowData, AgentSource } from '@codespin/shaman-types';
import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a workflow data entry
 */
export async function createWorkflowData(
  data: Omit<WorkflowData, 'id' | 'createdAt'>
): Promise<WorkflowData> {
  const id = uuidv4();
  const createdAt = new Date();
  
  const result = await db.one(
    `INSERT INTO workflow_data 
     (id, run_id, key, value, created_by_step_id, created_by_agent_name, created_by_agent_source, created_at)
     VALUES ($(id), $(runId), $(key), $(value), $(createdByStepId), $(createdByAgentName), $(createdByAgentSource), $(createdAt))
     RETURNING *`,
    {
      id,
      runId: data.runId,
      key: data.key,
      value: JSON.stringify(data.value),
      createdByStepId: data.createdByStepId,
      createdByAgentName: data.createdByAgentName,
      createdByAgentSource: data.createdByAgentSource,
      createdAt
    }
  );
  
  return {
    id: result.id,
    runId: result.run_id,
    key: result.key,
    value: JSON.parse(result.value),
    createdByStepId: result.created_by_step_id,
    createdByAgentName: result.created_by_agent_name,
    createdByAgentSource: result.created_by_agent_source,
    createdAt: result.created_at
  };
}

/**
 * Get workflow data by run ID and key
 */
export async function getWorkflowData(
  runId: string,
  key: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId) AND key = $(key)
     ORDER BY created_at DESC`,
    { runId, key }
  );
  
  return results.map(row => ({
    id: row.id,
    runId: row.run_id,
    key: row.key,
    value: JSON.parse(row.value),
    createdByStepId: row.created_by_step_id,
    createdByAgentName: row.created_by_agent_name,
    createdByAgentSource: row.created_by_agent_source,
    createdAt: row.created_at
  }));
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
  
  const results = await db.manyOrNone(query, {
    runId,
    pattern: sqlPattern,
    limit
  });
  
  return results.map(row => ({
    id: row.id,
    runId: row.run_id,
    key: row.key,
    value: JSON.parse(row.value),
    createdByStepId: row.created_by_step_id,
    createdByAgentName: row.created_by_agent_name,
    createdByAgentSource: row.created_by_agent_source,
    createdAt: row.created_at
  }));
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
  
  const params: any = { runId };
  
  if (filters?.agentName) {
    query += ` AND created_by_agent_name = $(agentName)`;
    params.agentName = filters.agentName;
  }
  
  if (filters?.prefix) {
    query += ` AND key LIKE $(prefix)`;
    params.prefix = filters.prefix + '%';
  }
  
  query += ` GROUP BY key ORDER BY key`;
  
  const results = await db.manyOrNone(query, params);
  
  return results.map(row => ({
    key: row.key,
    count: row.count,
    agents: row.agents
  }));
}

/**
 * Get all workflow data for a run
 */
export async function getAllWorkflowData(
  runId: string
): Promise<WorkflowData[]> {
  const results = await db.manyOrNone(
    `SELECT * FROM workflow_data 
     WHERE run_id = $(runId)
     ORDER BY created_at ASC`,
    { runId }
  );
  
  return results.map(row => ({
    id: row.id,
    runId: row.run_id,
    key: row.key,
    value: JSON.parse(row.value),
    createdByStepId: row.created_by_step_id,
    createdByAgentName: row.created_by_agent_name,
    createdByAgentSource: row.created_by_agent_source,
    createdAt: row.created_at
  }));
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