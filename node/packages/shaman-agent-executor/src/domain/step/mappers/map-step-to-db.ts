import type { Step } from '@codespin/shaman-types';
import type { StepDbRow } from '../types.js';

/**
 * Map domain type to database row (for inserts/updates)
 */
export function mapStepToDb(step: Omit<Step, 'id' | 'startTime'> & { id?: string }): Partial<StepDbRow> {
  return {
    id: step.id,
    run_id: step.runId,
    parent_step_id: step.parentStepId || null,
    type: step.type,
    status: step.status,
    agent_name: step.agentName || null,
    agent_source: step.agentSource || null,
    input: step.input || null,
    output: step.output || null,
    error: step.error || null,
    tool_name: step.toolName || null,
    tool_call_id: step.toolCallId || null,
    messages: step.messages || null,
    metadata: step.metadata || null,
    end_time: step.endTime || null,
    duration: step.duration || null,
    prompt_tokens: step.promptTokens || null,
    completion_tokens: step.completionTokens || null,
    cost: step.cost || null
  };
}