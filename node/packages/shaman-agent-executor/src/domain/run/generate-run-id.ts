/**
 * Generate a run ID
 */
export function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}