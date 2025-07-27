/**
 * packages/shaman-types/src/types.ts
 *
 * This file contains the core TypeScript type definitions for the Shaman project,
 * particularly those related to the database schema.
 *
 * These interfaces use camelCase for property names, which is the standard
 * convention for TypeScript. The mapping to the snake_case column names in the
 * database is handled by the persistence layer.
 */

/**
 * Represents a record in the 'agent_repository' table.
 */
export interface AgentRepository {
  id: number;
  name: string;
  gitUrl: string;
  branch: string;
  isRoot: boolean;
  lastSyncCommitHash: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: 'NEVER_SYNCED' | 'SUCCESS' | 'IN_PROGRESS' | 'FAILED';
  lastSyncErrors: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a record in the 'git_agent' table.
 */
export interface GitAgent {
  id: number;
  agentRepositoryId: number;
  name: string;
  description: string | null;
  version: string | null;
  filePath: string;
  model: string | null;
  providers: Record<string, unknown> | null;
  mcpServers: Record<string, unknown> | null;
  allowedAgents: string[] | null;
  tags: string[] | null;
  lastModifiedCommitHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Execution states for workflow steps and runs
 */
export type ExecutionState =
  | "SUBMITTED"
  | "WORKING"
  | "INPUT_REQUIRED"
  | "BLOCKED_ON_INPUT"
  | "BLOCKED_ON_DEPENDENCY"
  | "COMPLETED"
  | "CANCELED"
  | "FAILED"
  | "REJECTED";

/**
 * Agent source types
 */
export type AgentSource = "GIT" | "A2A_EXTERNAL";

/**
 * Context scope for agent execution
 */
export type ContextScope = "FULL" | "NONE" | "SPECIFIC";

/**
 * Represents a workflow run (top-level execution)
 */
export type Run = {
  readonly id: string;
  readonly status: ExecutionState;
  readonly initialInput: string;
  readonly totalCost: number;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly createdBy: string; // User ID
  readonly traceId?: string;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Step types for granular tracking
 */
export type StepType = 
  | "agent_execution"
  | "llm_call" 
  | "tool_call"
  | "agent_call";

/**
 * Represents a step in workflow execution
 */
export type Step = {
  readonly id: string;
  readonly runId: string;
  readonly parentStepId?: string;
  readonly type: StepType;
  readonly status: ExecutionState;
  readonly agentName?: string;
  readonly agentSource?: AgentSource;
  readonly input?: string;
  readonly output?: string;
  readonly error?: string;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly cost?: number;
  readonly toolName?: string;
  readonly toolCallId?: string;
  readonly messages?: Message[];
  readonly metadata?: Record<string, unknown>;
};

/**
 * Message types in conversations
 */
export type MessageRole = "SYSTEM" | "USER" | "ASSISTANT" | "TOOL";

export type Message = {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly sequenceNumber: number;
  readonly createdAt: Date;
  readonly toolCallId?: string;
  readonly toolCalls?: ToolCall[];
};

/**
 * Tool call information
 */
export type ToolCall = {
  readonly id: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly isSystemTool: boolean;
  readonly isAgentCall: boolean;
};

/**
 * Workflow context for sharing data between agents
 */
export type WorkflowContext = {
  readonly runId: string;
  readonly memory: Map<string, unknown>;
  readonly results: {
    readonly intermediate: Map<string, unknown>;
    readonly final?: unknown;
  };
};

/**
 * Immutable workflow data entry
 */
export type WorkflowData = {
  readonly id: string;
  readonly runId: string;
  readonly key: string;
  readonly value: unknown;
  readonly createdByStepId: string;
  readonly createdByAgentName: string;
  readonly createdByAgentSource: AgentSource;
  readonly createdAt: Date;
};

/**
 * Input request types
 */
export type InputType = "TEXT" | "CHOICE" | "FILE" | "APPROVAL" | "STRUCTURED_DATA";

/**
 * Input request from an agent
 */
export type InputRequest = {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string;
  readonly prompt: string;
  readonly inputType: InputType;
  readonly choices?: readonly string[];
  readonly required: boolean;
  readonly requestedAt: Date;
  readonly timeoutAt?: Date;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Completed input request
 */
export type CompletedInputRequest = {
  readonly id: string;
  readonly prompt: string;
  readonly userResponse: string;
  readonly responseAt: Date;
  readonly respondedBy: string; // User ID
};

/**
 * Agent completion status
 */
export type CompletionStatus = "SUCCESS" | "PARTIAL" | "FAILED";

/**
 * Agent completion result
 */
export type AgentCompletion = {
  readonly result: string;
  readonly status: CompletionStatus;
  readonly confidence: number;
  readonly requiresFollowup: boolean;
  readonly metadata?: Record<string, unknown>;
};
