import type { WorkflowData } from '@codespin/shaman-types';
import type { WorkflowDataDbRow } from '../types.js';

/**
 * Map domain type to database row (for inserts)
 */
export function mapWorkflowDataToDb(data: Omit<WorkflowData, 'id' | 'createdAt'>): Omit<WorkflowDataDbRow, 'id' | 'created_at'> {
  return {
    run_id: data.runId,
    key: data.key,
    value: data.value,
    created_by_step_id: data.createdByStepId,
    created_by_agent_name: data.createdByAgentName,
    created_by_agent_source: data.createdByAgentSource
  };
}