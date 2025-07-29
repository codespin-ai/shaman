import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import type { StepDbRow } from './types.js';

/**
 * Update a step
 */
export async function updateStep(
  db: Database,
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
    params.messages = updates.messages;
  }
  
  if (updates.metadata !== undefined) {
    sets.push('metadata = $(metadata)');
    params.metadata = updates.metadata;
  }
  
  const result = await db.one<StepDbRow>(
    `UPDATE step 
     SET ${sets.join(', ')}
     WHERE id = $(id)
     RETURNING *`,
    params
  );
  
  return mapStepFromDb(result);
}