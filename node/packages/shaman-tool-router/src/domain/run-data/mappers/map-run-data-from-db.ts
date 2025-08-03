import type { RunData, AgentSource } from '@codespin/shaman-types';
import type { RunDataDbRow } from '../types.js';

/**
 * Map database row to domain type
 */
export function mapRunDataFromDb(row: RunDataDbRow): RunData {
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