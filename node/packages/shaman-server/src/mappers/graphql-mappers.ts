/**
 * Mappers from domain types to GraphQL types
 * 
 * These functions convert internal domain models to the GraphQL API representation.
 * This layer allows the API to present a different view than the internal domain.
 */

import type * as Domain from '@codespin/shaman-types';
import * as GQL from '../generated/graphql.js';

/**
 * Maps domain AgentRepository to GraphQL AgentRepository
 */
export function mapAgentRepositoryToGraphQL(
  repo: Domain.AgentRepository
): GQL.AgentRepository {
  return {
    id: repo.id.toString(),
    name: repo.name,
    gitUrl: repo.gitUrl,
    branch: repo.branch,
    isRoot: repo.isRoot,
    isActive: true, // TODO: Add isActive to domain type
    readOnly: false, // TODO: Add readOnly to domain type
    syncInterval: '5m', // TODO: Add syncInterval to domain type
    authType: 'token', // TODO: Add authType to domain type
    
    // Sync status
    lastSyncCommitHash: repo.lastSyncCommitHash,
    lastSyncAt: repo.lastSyncAt,
    lastSyncStatus: mapSyncStatusToGraphQL(repo.lastSyncStatus),
    lastSyncErrors: repo.lastSyncErrors ? mapSyncErrorsToGraphQL(repo.lastSyncErrors) : [],
    
    // These will be populated by resolvers
    agents: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }, totalCount: 0 },
    branches: [],
    tags: [],
    
    // Metadata
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
    createdBy: undefined as unknown as GQL.User // Will be populated by resolver
  };
}

/**
 * Maps domain GitAgent to GraphQL Agent
 */
export function mapGitAgentToGraphQL(
  agent: Domain.GitAgent,
  repository: Domain.AgentRepository
): GQL.Agent {
  return {
    name: agent.name,
    description: agent.description || '',
    source: GQL.AgentSource.Git,
    tags: agent.tags || [],
    
    // Git-specific details
    gitDetails: {
      version: agent.version || '1.0.0',
      repository: mapAgentRepositoryToGraphQL(repository),
      filePath: agent.filePath,
      gitCommit: agent.lastModifiedCommitHash || '',
      lastModified: agent.updatedAt,
      
      model: agent.model,
      providers: agent.providers ? Object.keys(agent.providers) : [],
      mcpServers: mapMcpServersToGraphQL(agent.mcpServers),
      allowedAgents: agent.allowedAgents || [],
      examples: [], // TODO: Add examples to domain type
      contextScope: GQL.ContextScope.Full // TODO: Add contextScope to domain type
    },
    
    // External details not applicable for Git agents
    externalDetails: null,
    
    // Analytics - would be populated from metrics
    usageCount: 0,
    lastUsed: null,
    averageExecutionTime: null,
    successRate: null
  };
}

/**
 * Maps domain Run to GraphQL Run
 */
export function mapRunToGraphQL(run: Domain.Run): GQL.Run {
  return {
    id: run.id,
    status: mapExecutionStateToGraphQL(run.status),
    initialInput: run.initialInput,
    totalCost: run.totalCost,
    startTime: run.startTime,
    endTime: run.endTime || null,
    duration: run.duration || null,
    
    // These will be populated by resolvers
    steps: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }, totalCount: 0 },
    workflowData: [],
    pendingInputRequests: [],
    dagStatus: {
      activeSteps: [],
      blockedSteps: [],
      completedSteps: [],
      totalSteps: 0,
      maxDepth: 0,
      criticalPath: []
    },
    
    // Metadata
    traceId: run.traceId || null,
    createdBy: undefined as unknown as GQL.User // Will be populated by resolver
  };
}

/**
 * Maps domain Step to GraphQL Step
 */
export function mapStepToGraphQL(step: Domain.Step): GQL.Step {
  return {
    id: step.id,
    type: mapStepTypeToGraphQL(step.type),
    status: mapExecutionStateToGraphQL(step.status),
    agentName: step.agentName || null,
    agentSource: step.agentSource ? mapAgentSourceToGraphQL(step.agentSource) : null,
    input: step.input || null,
    output: step.output || null,
    error: step.error ? mapErrorToGraphQL(step.error) : null,
    
    // Timing
    startTime: step.startTime || null,
    endTime: step.endTime || null,
    duration: step.duration || null,
    
    // These will be populated by resolvers
    run: undefined as unknown as GQL.Run,
    parentStep: null,
    childSteps: [],
    messages: [],
    
    // Token usage
    promptTokens: step.promptTokens || null,
    completionTokens: step.completionTokens || null,
    cost: step.cost || null,
    
    // Tool/Agent calls
    toolName: step.toolName || null,
    toolCallId: step.toolCallId || null,
    
    // Completion
    completion: null, // TODO: Map completion when available
    
    // Input handling
    inputRequest: null // Will be populated by resolver
  };
}

/**
 * Maps domain Message to GraphQL Message
 */
export function mapMessageToGraphQL(message: Domain.Message): GQL.Message {
  return {
    id: message.id,
    role: mapMessageRoleToGraphQL(message.role),
    content: message.content,
    sequenceNumber: message.sequenceNumber,
    createdAt: message.createdAt,
    
    // Optional fields
    toolCallId: message.toolCallId || null,
    toolCalls: message.toolCalls ? message.toolCalls.map(mapToolCallToGraphQL) : null
  };
}

/**
 * Maps domain WorkflowData to GraphQL WorkflowData
 */
export function mapWorkflowDataToGraphQL(data: Domain.WorkflowData): GQL.WorkflowData {
  return {
    id: data.id,
    runId: data.runId,
    key: data.key,
    value: {
      type: typeof data.value,
      data: JSON.stringify(data.value)
    },
    createdByStepId: data.createdByStepId,
    createdByAgentName: data.createdByAgentName,
    createdByAgentSource: mapAgentSourceToGraphQL(data.createdByAgentSource),
    createdAt: data.createdAt
  };
}

/**
 * Maps domain InputRequest to GraphQL InputRequest
 */
export function mapInputRequestToGraphQL(
  request: Domain.InputRequest,
  response?: Domain.CompletedInputRequest
): GQL.InputRequest {
  return {
    id: request.id,
    runId: request.runId,
    stepId: request.stepId,
    prompt: request.prompt,
    inputType: mapInputTypeToGraphQL(request.inputType),
    choices: request.choices ? [...request.choices] : null,
    required: request.required,
    requestedAt: request.requestedAt,
    timeoutAt: request.timeoutAt || null,
    
    // Response fields (if completed)
    userResponse: response?.userResponse || null,
    responseAt: response?.responseAt || null,
    respondedBy: null, // Will be populated by resolver
    
    // Metadata
    metadata: request.metadata ? mapMetadataToGraphQL(request.metadata) : null
  };
}

// ===== Helper Mappers =====

function mapSyncStatusToGraphQL(status: Domain.AgentRepository['lastSyncStatus']): GQL.SyncStatus {
  switch (status) {
    case 'NEVER_SYNCED': return GQL.SyncStatus.NeverSynced;
    case 'SUCCESS': return GQL.SyncStatus.Success;
    case 'IN_PROGRESS': return GQL.SyncStatus.InProgress;
    case 'FAILED': return GQL.SyncStatus.Failed;
  }
}

function mapSyncErrorsToGraphQL(errors: Record<string, unknown>): GQL.Error[] {
  // Convert error object to array of Error types
  return Object.entries(errors).map(([key, value]) => ({
    code: GQL.ErrorCode.InternalError,
    message: String(value),
    timestamp: new Date(),
    context: {
      gitCommit: null,
      agentName: null,
      repositoryName: null,
      filePath: key,
      lineNumber: null,
      validationErrors: null
    }
  }));
}

function mapMcpServersToGraphQL(mcpServers: unknown): GQL.McpServerAccess[] {
  if (!mcpServers || typeof mcpServers !== 'object') return [];
  
  const servers = mcpServers as Record<string, unknown>;
  return Object.entries(servers).map(([serverName, access]) => {
    if (access === '*' || access === null || access === '') {
      return {
        serverName,
        accessType: GQL.McpAccessType.AllTools,
        allowedTools: null
      };
    } else if (Array.isArray(access)) {
      if (access.length === 0) {
        return {
          serverName,
          accessType: GQL.McpAccessType.NoAccess,
          allowedTools: null
        };
      } else {
        return {
          serverName,
          accessType: GQL.McpAccessType.SpecificTools,
          allowedTools: access.filter(tool => typeof tool === 'string')
        };
      }
    }
    
    // Default to no access for unknown formats
    return {
      serverName,
      accessType: GQL.McpAccessType.NoAccess,
      allowedTools: null
    };
  });
}

function mapExecutionStateToGraphQL(state: Domain.ExecutionState): GQL.ExecutionState {
  switch (state) {
    case 'SUBMITTED': return GQL.ExecutionState.Submitted;
    case 'WORKING': return GQL.ExecutionState.Working;
    case 'INPUT_REQUIRED': return GQL.ExecutionState.InputRequired;
    case 'BLOCKED_ON_INPUT': return GQL.ExecutionState.BlockedOnInput;
    case 'BLOCKED_ON_DEPENDENCY': return GQL.ExecutionState.BlockedOnDependency;
    case 'COMPLETED': return GQL.ExecutionState.Completed;
    case 'CANCELED': return GQL.ExecutionState.Canceled;
    case 'FAILED': return GQL.ExecutionState.Failed;
    case 'REJECTED': return GQL.ExecutionState.Rejected;
  }
}

function mapStepTypeToGraphQL(type: Domain.StepType): GQL.StepType {
  switch (type) {
    case 'agent_execution': return GQL.StepType.AgentExecution;
    case 'llm_call': return GQL.StepType.LlmCall;
    case 'tool_call': return GQL.StepType.ToolCall;
    case 'agent_call': return GQL.StepType.AgentCall;
  }
}

function mapAgentSourceToGraphQL(source: Domain.AgentSource): GQL.AgentSource {
  switch (source) {
    case 'GIT': return GQL.AgentSource.Git;
    case 'A2A_EXTERNAL': return GQL.AgentSource.A2AExternal;
  }
}

function mapMessageRoleToGraphQL(role: Domain.MessageRole): GQL.MessageRole {
  switch (role) {
    case 'SYSTEM': return GQL.MessageRole.System;
    case 'USER': return GQL.MessageRole.User;
    case 'ASSISTANT': return GQL.MessageRole.Assistant;
    case 'TOOL': return GQL.MessageRole.Tool;
  }
}

function mapInputTypeToGraphQL(type: Domain.InputType): GQL.InputType {
  switch (type) {
    case 'TEXT': return GQL.InputType.Text;
    case 'CHOICE': return GQL.InputType.Choice;
    case 'FILE': return GQL.InputType.File;
    case 'APPROVAL': return GQL.InputType.Approval;
    case 'STRUCTURED_DATA': return GQL.InputType.StructuredData;
  }
}

function mapToolCallToGraphQL(toolCall: Domain.ToolCall): GQL.ToolCall {
  return {
    id: toolCall.id,
    toolName: toolCall.toolName,
    input: {
      parameters: Object.entries(toolCall.input as Record<string, unknown>).map(([name, value]) => ({
        name,
        value: String(value),
        type: typeof value
      }))
    },
    isSystemTool: toolCall.isSystemTool,
    isAgentCall: toolCall.isAgentCall
  };
}

function mapErrorToGraphQL(error: string): GQL.Error {
  return {
    code: GQL.ErrorCode.InternalError,
    message: error,
    timestamp: new Date(),
    context: null
  };
}

function mapMetadataToGraphQL(metadata: Record<string, unknown>): GQL.MetadataField[] {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: String(value)
  }));
}

/**
 * Maps domain AgentCompletion to GraphQL AgentCompletion
 */
export function mapAgentCompletionToGraphQL(completion: Domain.AgentCompletion): GQL.AgentCompletion {
  return {
    result: completion.result,
    status: mapCompletionStatusToGraphQL(completion.status),
    confidence: completion.confidence,
    requiresFollowup: completion.requiresFollowup,
    metadata: completion.metadata ? mapMetadataToGraphQL(completion.metadata) : null
  };
}

function mapCompletionStatusToGraphQL(status: Domain.CompletionStatus): GQL.CompletionStatus {
  switch (status) {
    case 'SUCCESS': return GQL.CompletionStatus.Success;
    case 'PARTIAL': return GQL.CompletionStatus.Partial;
    case 'FAILED': return GQL.CompletionStatus.Failed;
  }
}