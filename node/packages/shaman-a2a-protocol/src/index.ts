/**
 * @codespin/shaman-a2a-protocol
 * 
 * Pure A2A protocol types from the official specification.
 * These types are the canonical reference for A2A v0.3.0.
 */

// Re-export all types from the canonical types file
export * from './types.js';

// Convenience type guards
export function isTextPart(part: any): part is import('./types.js').TextPart {
  return part && part.kind === 'text';
}

export function isFilePart(part: any): part is import('./types.js').FilePart {
  return part && part.kind === 'file';
}

export function isDataPart(part: any): part is import('./types.js').DataPart {
  return part && part.kind === 'data';
}

export function isMessage(obj: any): obj is import('./types.js').Message {
  return obj && 
    typeof obj === 'object' &&
    (obj.role === 'user' || obj.role === 'agent') &&
    Array.isArray(obj.parts);
}

export function isTask(obj: any): obj is import('./types.js').Task {
  return obj && 
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    obj.status && 
    typeof obj.status.state === 'string';
}