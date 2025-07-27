/**
 * packages/shaman-workflow-temporal/src/index.ts
 *
 * Temporal workflow engine implementation.
 */

export { createExecutionEngine, createTemporalEngine } from './temporal-adapter.js';
export type { TemporalConfig } from './temporal-adapter.js';

// Export activities initialization for worker setup
export { initializeActivities } from './activities/agent-activities.js';

// Export workflow definitions for worker registration
export { agentWorkflow, executeAgentWorkflow } from './workflows/agent-workflow.js';