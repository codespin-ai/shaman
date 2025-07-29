import type { Run } from '@codespin/shaman-types';
import type { Database } from '@codespin/shaman-db';
import { mapRunFromDb } from './mappers/map-run-from-db.js';
import type { RunDbRow } from './types.js';

/**
 * Update a run
 */
export async function updateRun(
  db: Database,
  id: string,
  updates: Partial<Omit<Run, 'id' | 'startTime' | 'createdBy'>>
): Promise<Run> {
  const sets = [];
  const params: Record<string, unknown> = { id };
  
  if (updates.status !== undefined) {
    sets.push('status = $(status)');
    params.status = updates.status;
  }
  
  if (updates.totalCost !== undefined) {
    sets.push('total_cost = $(totalCost)');
    params.totalCost = updates.totalCost;
  }
  
  if (updates.endTime !== undefined) {
    sets.push('end_time = $(endTime)');
    params.endTime = updates.endTime;
  }
  
  if (updates.duration !== undefined) {
    sets.push('duration = $(duration)');
    params.duration = updates.duration;
  }
  
  if (updates.metadata !== undefined) {
    sets.push('metadata = $(metadata)');
    params.metadata = updates.metadata;
  }
  
  const result = await db.one<RunDbRow>(
    `UPDATE run 
     SET ${sets.join(', ')}
     WHERE id = $(id)
     RETURNING *`,
    params
  );
  
  return mapRunFromDb(result);
}