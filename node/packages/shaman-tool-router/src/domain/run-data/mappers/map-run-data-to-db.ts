import type { RunData } from '@codespin/shaman-types';
import type { RunDataDbRow } from '../types.js';

/**
 * Map domain type to database row (for inserts)
 */
export function mapRunDataToDb(data: Omit<RunData, 'id' | 'createdAt'>): Omit<RunDataDbRow, 'id' | 'created_at'> {
  return {
    run_id: data.runId,
    key: data.key,
    value: data.value,
    created_by_step_id: data.createdByStepId,
    created_by_agent_name: data.createdByAgentName,
    created_by_agent_source: data.createdByAgentSource
  };
}