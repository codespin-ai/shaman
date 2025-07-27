/**
 * Step (workflow execution unit) persistence functions
 */

import type { Step, ExecutionState, StepType, AgentSource, Message } from '@codespin/shaman-types';
import { db } from './db.js';

/**
 * Create a new step
 */
export async function createStep(
  step: Omit<Step, 'id' | 'startTime'> & { id?: string }
): Promise<Step> {
  const result = await db.one(
    `INSERT INTO step 
     (id, run_id, parent_step_id, type, status, agent_name, agent_source, 
      input, start_time, tool_name, tool_call_id, messages, metadata)
     VALUES ($(id), $(runId), $(parentStepId), $(type), $(status), $(agentName), 
      $(agentSource), $(input), $(startTime), $(toolName), $(toolCallId), 
      $(messages), $(metadata))
     RETURNING *`,
    {
      id: step.id || generateStepId(),
      runId: step.runId,
      parentStepId: step.parentStepId || null,
      type: step.type,
      status: step.status,
      agentName: step.agentName || null,
      agentSource: step.agentSource || null,
      input: step.input || null,
      startTime: new Date(),
      toolName: step.toolName || null,
      toolCallId: step.toolCallId || null,
      messages: step.messages ? JSON.stringify(step.messages) : null,
      metadata: step.metadata ? JSON.stringify(step.metadata) : null
    }
  );
  
  return mapStepFromDb(result);
}

/**
 * Get a step by ID
 */
export async function getStep(id: string): Promise<Step | null> {
  const result = await db.oneOrNone(
    `SELECT * FROM step WHERE id = $(id)`,
    { id }
  );
  
  return result ? mapStepFromDb(result) : null;
}

/**
 * Update a step
 */
export async function updateStep(
  id: string,
  updates: Partial<Omit<Step, 'id' | 'runId' | 'parentStepId' | 'type'>>
): Promise<Step> {
  const sets = [];
  const params: Record<string, unknown> = { id };
  
  if (updates.status !== undefined) {
    sets.push('status = $(status)');
    params.status = updates.status;
  }
  
  if (updates.output !== undefined) {
    sets.push('output = $(output)');
    params.output = updates.output;
  }
  
  if (updates.error !== undefined) {
    sets.push('error = $(error)');
    params.error = updates.error;
  }
  
  if (updates.endTime !== undefined) {
    sets.push('end_time = $(endTime)');
    params.endTime = updates.endTime;
  }
  
  if (updates.duration !== undefined) {
    sets.push('duration = $(duration)');
    params.duration = updates.duration;
  }
  
  if (updates.promptTokens !== undefined) {
    sets.push('prompt_tokens = $(promptTokens)');
    params.promptTokens = updates.promptTokens;
  }
  
  if (updates.completionTokens !== undefined) {
    sets.push('completion_tokens = $(completionTokens)');
    params.completionTokens = updates.completionTokens;
  }
  
  if (updates.cost !== undefined) {
    sets.push('cost = $(cost)');
    params.cost = updates.cost;
  }
  
  if (updates.messages !== undefined) {
    sets.push('messages = $(messages)');
    params.messages = JSON.stringify(updates.messages);
  }
  
  if (updates.metadata !== undefined) {
    sets.push('metadata = $(metadata)');
    params.metadata = JSON.stringify(updates.metadata);
  }
  
  const result = await db.one(
    `UPDATE step 
     SET ${sets.join(', ')}
     WHERE id = $(id)
     RETURNING *`,
    params
  );
  
  return mapStepFromDb(result);
}

/**
 * Get steps for a run
 */
export async function getStepsByRun(runId: string): Promise<Step[]> {
  const results = await db.manyOrNone(
    `SELECT * FROM step 
     WHERE run_id = $(runId)
     ORDER BY start_time ASC`,
    { runId }
  );
  
  return results.map(mapStepFromDb);
}

/**
 * Get child steps
 */
export async function getChildSteps(parentStepId: string): Promise<Step[]> {
  const results = await db.manyOrNone(
    `SELECT * FROM step 
     WHERE parent_step_id = $(parentStepId)
     ORDER BY start_time ASC`,
    { parentStepId }
  );
  
  return results.map(mapStepFromDb);
}

/**
 * Get active steps in a run
 */
export async function getActiveSteps(runId: string): Promise<Step[]> {
  const results = await db.manyOrNone(
    `SELECT * FROM step 
     WHERE run_id = $(runId) 
     AND status IN ('WORKING', 'INPUT_REQUIRED')
     ORDER BY start_time ASC`,
    { runId }
  );
  
  return results.map(mapStepFromDb);
}

/**
 * Get steps by agent
 */
export async function getStepsByAgent(
  runId: string,
  agentName: string
): Promise<Step[]> {
  const results = await db.manyOrNone(
    `SELECT * FROM step 
     WHERE run_id = $(runId) 
     AND agent_name = $(agentName)
     ORDER BY start_time ASC`,
    { runId, agentName }
  );
  
  return results.map(mapStepFromDb);
}

/**
 * Database row type for step table
 */
type StepDbRow = {
  id: string;
  run_id: string;
  parent_step_id: string | null;
  type: string;
  status: string;
  agent_name: string | null;
  agent_source: string | null;
  input: string | null;
  output: string | null;
  error: string | null;
  start_time: Date | null;
  end_time: Date | null;
  duration: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost: number | null;
  tool_name: string | null;
  tool_call_id: string | null;
  messages: string | null;
  metadata: string | null;
};

/**
 * Helper to map database row to Step type
 */
function mapStepFromDb(row: StepDbRow): Step {
  return {
    id: row.id,
    runId: row.run_id,
    parentStepId: row.parent_step_id || undefined,
    type: row.type as StepType,
    status: row.status as ExecutionState,
    agentName: row.agent_name || undefined,
    agentSource: row.agent_source as AgentSource || undefined,
    input: row.input || undefined,
    output: row.output || undefined,
    error: row.error || undefined,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    duration: row.duration || undefined,
    promptTokens: row.prompt_tokens || undefined,
    completionTokens: row.completion_tokens || undefined,
    cost: row.cost || undefined,
    toolName: row.tool_name || undefined,
    toolCallId: row.tool_call_id || undefined,
    messages: row.messages ? JSON.parse(row.messages) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  };
}

/**
 * Generate a step ID
 */
function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}