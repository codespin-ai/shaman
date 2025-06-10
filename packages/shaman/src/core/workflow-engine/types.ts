// TODO: Define Workflow Engine Types
// Exported types:
// - type WorkflowRun = { id: string; status: ExecutionState; steps: WorkflowStep[]; ... }
// - type WorkflowStep = { id: string; status: ExecutionState; agentName: string; ... }
// - type ExecutionContext = { runId: string; stepId: string; callStack: string[]; ... }
// - type DAGNode = { stepId: string; dependencies: string[]; dependents: string[]; ... }
// - type CompletionResult = { status: CompletionStatus; result: string; ... }
// - type ExecutionMetadata = { startTime: Date; endTime?: Date; cost: number; ... }
// - type RunAgentInput = { agentName: string; input: string; contextScope?: string; ... }
// - type AgentCompletion = { result: string; status: CompletionStatus; confidence: number; ... }
//
// Exported validation functions:
// - validateRunInput(input: RunAgentInput): boolean
// - validateExecutionState(state: ExecutionState): boolean
// - validateDAGStructure(nodes: DAGNode[]): boolean
//
// Core workflow execution types with validation
