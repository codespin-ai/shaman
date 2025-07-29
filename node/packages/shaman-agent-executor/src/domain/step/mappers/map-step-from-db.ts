import type { Step, ExecutionState, StepType, AgentSource, Message } from '@codespin/shaman-types';
import type { StepDbRow } from '../types.js';

/**
 * Map database row to domain type
 */
export function mapStepFromDb(row: StepDbRow): Step {
  return {
    id: row.id,
    runId: row.run_id,
    parentStepId: row.parent_step_id || undefined,
    type: row.type as StepType,
    status: row.status as ExecutionState,
    agentName: row.agent_name || undefined,
    agentSource: row.agent_source ? row.agent_source as AgentSource : undefined,
    input: row.input || undefined,
    output: row.output || undefined,
    error: row.error || undefined,
    startTime: row.start_time,
    endTime: row.end_time || undefined,
    duration: row.duration || undefined,
    promptTokens: row.prompt_tokens || undefined,
    completionTokens: row.completion_tokens || undefined,
    cost: row.cost || undefined,
    toolName: row.tool_name || undefined,
    toolCallId: row.tool_call_id || undefined,
    messages: row.messages as Message[] | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined
  };
}