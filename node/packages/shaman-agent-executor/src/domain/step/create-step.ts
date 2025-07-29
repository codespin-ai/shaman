import type { Step } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapStepFromDb } from './mappers/map-step-from-db.js';
import { mapStepToDb } from './mappers/map-step-to-db.js';
import { generateStepId } from './generate-step-id.js';
import type { StepDbRow } from './types.js';

/**
 * Create a new step
 */
export async function createStep(
  db: Database,
  step: Omit<Step, 'id' | 'startTime'> & { id?: string }
): Promise<Step> {
  const dbData = mapStepToDb(step);
  const result = await db.one<StepDbRow>(
    `INSERT INTO step 
     (id, run_id, parent_step_id, type, status, agent_name, agent_source, 
      input, start_time, tool_name, tool_call_id, messages, metadata)
     VALUES ($(id), $(run_id), $(parent_step_id), $(type), $(status), $(agent_name), 
      $(agent_source), $(input), $(start_time), $(tool_name), $(tool_call_id), 
      $(messages), $(metadata))
     RETURNING *`,
    {
      id: dbData.id || generateStepId(),
      run_id: dbData.run_id,
      parent_step_id: dbData.parent_step_id,
      type: dbData.type,
      status: dbData.status,
      agent_name: dbData.agent_name,
      agent_source: dbData.agent_source,
      input: dbData.input,
      start_time: new Date(),
      tool_name: dbData.tool_name,
      tool_call_id: dbData.tool_call_id,
      messages: dbData.messages,
      metadata: dbData.metadata
    }
  );
  
  return mapStepFromDb(result);
}