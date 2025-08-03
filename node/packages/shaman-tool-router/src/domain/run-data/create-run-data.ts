import type { RunData } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { v4 as uuidv4 } from 'uuid';
import { mapRunDataFromDb } from './mappers/map-run-data-from-db.js';
import { mapRunDataToDb } from './mappers/map-run-data-to-db.js';
import type { RunDataDbRow } from './types.js';

/**
 * Create a run data entry
 */
export async function createRunData(
  db: Database,
  data: Omit<RunData, 'id' | 'createdAt'>
): Promise<RunData> {
  const id = uuidv4();
  const createdAt = new Date();
  const dbData = mapRunDataToDb(data);
  
  const result = await db.one<RunDataDbRow>(
    `INSERT INTO run_data 
     (id, run_id, key, value, created_by_step_id, created_by_agent_name, created_by_agent_source, created_at)
     VALUES ($(id), $(run_id), $(key), $(value), $(created_by_step_id), $(created_by_agent_name), $(created_by_agent_source), $(created_at))
     RETURNING *`,
    {
      id,
      run_id: dbData.run_id,
      key: dbData.key,
      value: dbData.value,
      created_by_step_id: dbData.created_by_step_id,
      created_by_agent_name: dbData.created_by_agent_name,
      created_by_agent_source: dbData.created_by_agent_source,
      created_at: createdAt
    }
  );
  
  return mapRunDataFromDb(result);
}