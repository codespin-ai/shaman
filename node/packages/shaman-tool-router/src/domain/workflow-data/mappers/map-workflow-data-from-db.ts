import type { WorkflowData, AgentSource } from '@codespin/shaman-types';
import type { WorkflowDataDbRow } from '../types.js';

/**
 * Map database row to domain type
 */
export function mapWorkflowDataFromDb(row: WorkflowDataDbRow): WorkflowData {
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