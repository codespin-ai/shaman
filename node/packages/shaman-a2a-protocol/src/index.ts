/**
 * @codespin/shaman-a2a-protocol
 * 
 * Pure A2A protocol types from the official specification.
 * These types are the canonical reference for A2A v0.3.0.
 */

// Re-export all types from the canonical types file
export * from './types.js';

import type { TextPart, FilePart, DataPart, Message, Task } from './types.js';

// Convenience type guards
export function isTextPart(part: unknown): part is TextPart {
  return part !== null && 
    typeof part === 'object' && 
    'kind' in part && 
    part.kind === 'text';
}

export function isFilePart(part: unknown): part is FilePart {
  return part !== null && 
    typeof part === 'object' && 
    'kind' in part && 
    part.kind === 'file';
}

export function isDataPart(part: unknown): part is DataPart {
  return part !== null && 
    typeof part === 'object' && 
    'kind' in part && 
    part.kind === 'data';
}

export function isMessage(obj: unknown): obj is Message {
  return obj !== null && 
    typeof obj === 'object' &&
    'role' in obj &&
    'parts' in obj &&
    (obj.role === 'user' || obj.role === 'agent') &&
    Array.isArray(obj.parts);
}

export function isTask(obj: unknown): obj is Task {
  return obj !== null && 
    typeof obj === 'object' &&
    'id' in obj &&
    'status' in obj &&
    typeof obj.id === 'string' &&
    typeof obj.status === 'object' && 
    obj.status !== null &&
    'state' in obj.status &&
    typeof obj.status.state === 'string';
}