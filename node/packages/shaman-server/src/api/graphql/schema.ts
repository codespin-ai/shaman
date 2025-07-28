/**
 * GraphQL schema definition
 */

import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # =============================================================================
  #  SCALARS
  # =============================================================================
  
  scalar DateTime
  scalar ToolCallID
  scalar JSON
  scalar EmailAddress
  scalar Upload
  
  # =============================================================================
  #  ENUMS
  # =============================================================================
  
  enum ExecutionState {
    SUBMITTED
    WORKING
    INPUT_REQUIRED
    BLOCKED_ON_INPUT
    BLOCKED_ON_DEPENDENCY
    COMPLETED
    CANCELED
    FAILED
    REJECTED
  }
  
  enum AgentSource {
    GIT
    A2A_EXTERNAL
  }
  
  enum ContextScope {
    FULL
    NONE
    SPECIFIC
  }
  
  enum McpServerType {
    HTTP
    STDIO
    A2A
  }
  
  enum McpServerSource {
    CONFIG
    API
  }
  
  enum MessageRole {
    SYSTEM
    USER
    ASSISTANT
    TOOL
  }
  
  enum UserRole {
    USER
    ADMIN
    SUPER_ADMIN
  }
  
  enum SortDirection {
    ASC
    DESC
  }
  
  enum AgentSortField {
    NAME
    CREATED_AT
    UPDATED_AT
    USAGE_COUNT
    SUCCESS_RATE
    RELEVANCE
    LAST_MODIFIED
  }
  
  enum CompletionStatus {
    SUCCESS
    PARTIAL
    FAILED
  }
  
  enum InputType {
    TEXT
    CHOICE
    FILE
    APPROVAL
    STRUCTURED_DATA
  }
  
  enum SyncStatus {
    SUCCESS
    IN_PROGRESS
    FAILED
    NEVER_SYNCED
  }
  
  # =============================================================================
  #  INTERFACES
  # =============================================================================
  
  interface Timestamped {
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  interface Owned {
    createdBy: User!
  }
  
  interface Message {
    id: ID!
    role: MessageRole!
    content: String!
    sequenceNumber: Int!
    createdAt: DateTime!
  }
  
  # =============================================================================
  #  CORE TYPES
  # =============================================================================
  
  type User {
    id: ID!
    email: EmailAddress!
    name: String!
    role: UserRole!
    isActive: Boolean!
    createdAt: DateTime!
    lastLoginAt: DateTime
  }
  
  type AgentRepository implements Timestamped & Owned {
    id: ID!
    name: String!
    gitUrl: String!
    branch: String!
    isRoot: Boolean!
    isActive: Boolean!
    readOnly: Boolean!
    syncInterval: String!
    lastSyncCommit: String
    lastSyncAt: DateTime
    lastSyncStatus: SyncStatus!
    agentCount: Int!
    discoveredAgents: [GitAgent!]!
    syncErrors: [SyncError!]!
    authType: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
  }
  
  type SyncError {
    message: String!
    filePath: String
    timestamp: DateTime!
    errorType: String!
  }
  
  type GitCommit {
    hash: String!
    message: String!
    author: String!
    timestamp: DateTime!
    changedFiles: [String!]!
  }
  
  type GitAgent {
    name: String!
    description: String!
    version: String!
    tags: [String!]!
    model: String
    providers: [String!]!
    mcpServers: JSON!
    allowedAgents: [String!]!
    examples: [String!]!
    contextScope: ContextScope!
    
    # Git metadata
    repository: AgentRepository!
    filePath: String!
    gitCommit: String!
    lastModified: DateTime!
    
    # Computed properties
    isNamespaced: Boolean!
    fullPath: String!
    
    # Analytics
    usageCount: Int!
    lastUsed: DateTime
    averageExecutionTime: Float
    successRate: Float
  }
  
  type ExternalA2AAgent implements Timestamped & Owned {
    id: ID!
    name: String!
    description: String!
    endpoint: String!
    agentCard: JSON!
    authConfig: JSON!
    isActive: Boolean!
    lastHealthCheck: DateTime
    healthStatus: String!
    skills: [ExternalA2ASkill!]!
    usageCount: Int!
    averageResponseTime: Float
    errorRate: Float
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
  }
  
  type ExternalA2ASkill {
    id: String!
    name: String!
    description: String!
    tags: [String!]!
    examples: [String!]!
    inputModes: [String!]!
    outputModes: [String!]!
  }
  
  type McpServer implements Timestamped & Owned {
    id: ID!
    name: String!
    description: String
    type: McpServerType!
    source: McpServerSource!
    endpoint: String!
    isActive: Boolean!
    agentCard: JSON
    healthStatus: String
    lastHealthCheckAt: DateTime
    tools: [Tool!]!
    toolCount: Int!
    supportsExplicitCompletion: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
  }
  
  type Tool {
    id: ID!
    name: String!
    description: String!
    schema: JSON!
    mcpServer: McpServer!
    usageCount: Int!
    lastUsedAt: DateTime
    averageExecutionTime: Float
    successRate: Float
    isSystemTool: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  type Agent {
    name: String!
    description: String!
    version: String!
    source: AgentSource!
    
    # Git agent fields
    gitAgent: GitAgent
    
    # External A2A agent fields
    externalA2AAgent: ExternalA2AAgent
    
    # Common computed fields
    tags: [String!]!
    usageCount: Int!
    lastUsed: DateTime
    averageExecutionTime: Float
    successRate: Float
    analytics: AgentAnalytics!
  }
  
  type AgentAnalytics {
    totalRuns: Int!
    successRate: Float!
    averageExecutionTime: Float!
    averageCost: Float!
    userRating: Float
    usageGrowth: Float!
    peakUsageHours: [Int!]!
    commonFailureReasons: [String!]!
    costTrend: [CostDataPoint!]!
    performanceTrend: [PerformanceDataPoint!]!
    completionReliability: Float!
    averageChildAgents: Float!
    inputRequestFrequency: Float!
    agentCallFrequency: Float!
    circularCallAttempts: Int!
  }
  
  type CostDataPoint {
    date: DateTime!
    totalCost: Float!
    averageCost: Float!
    runCount: Int!
  }
  
  type PerformanceDataPoint {
    date: DateTime!
    averageExecutionTime: Float!
    successRate: Float!
    runCount: Int!
  }
  
  # =============================================================================
  #  MESSAGE TYPES
  # =============================================================================
  
  type SystemMessage implements Message {
    id: ID!
    role: MessageRole!
    content: String!
    sequenceNumber: Int!
    createdAt: DateTime!
  }
  
  type UserMessage implements Message {
    id: ID!
    role: MessageRole!
    content: String!
    sequenceNumber: Int!
    createdAt: DateTime!
  }
  
  type AssistantMessage implements Message {
    id: ID!
    role: MessageRole!
    content: String!
    sequenceNumber: Int!
    toolCalls: [ToolCall!]!
    createdAt: DateTime!
  }
  
  type ToolResponseMessage implements Message {
    id: ID!
    role: MessageRole!
    content: String!
    sequenceNumber: Int!
    toolCallId: ToolCallID!
    createdAt: DateTime!
  }
  
  # =============================================================================
  #  EXECUTION TYPES
  # =============================================================================
  
  type InputRequest {
    id: ID!
    runId: ID!
    stepId: ID!
    prompt: String!
    inputType: InputType!
    choices: [String!]
    required: Boolean!
    requestedAt: DateTime!
    timeoutAt: DateTime
    metadata: JSON
  }
  
  type CompletedInputRequest {
    id: ID!
    prompt: String!
    userResponse: String!
    responseAt: DateTime!
    respondedBy: User!
  }
  
  type AgentCompletion {
    result: String!
    status: CompletionStatus!
    confidence: Float!
    requiresFollowup: Boolean!
    metadata: JSON
  }
  
  type AgentCallInfo {
    callerAgentName: String!
    targetAgentName: String!
    targetAgentSource: AgentSource!
    input: String!
    contextScope: ContextScope!
    callDepth: Int!
    callStack: [String!]!
    
    # Git-specific info
    gitRepository: String
    gitCommit: String
    
    # A2A-specific info
    a2aEndpoint: String
    a2aTaskId: String
  }
  
  type Step {
    id: ID!
    status: ExecutionState!
    input: String
    output: String
    error: String
    startTime: DateTime
    endTime: DateTime
    duration: Float
    messages: [Message!]!
    promptTokens: Int
    completionTokens: Int
    cost: Float
    
    # Relationships
    run: Run!
    agentName: String!
    agentSource: AgentSource!
    parentSteps: [Step!]!
    childSteps: [Step!]!
    
    # Input handling
    inputRequest: InputRequest
    inputHistory: [CompletedInputRequest!]!
    
    # Completion
    completion: AgentCompletion
    
    # Agent calling information
    agentCallInfo: AgentCallInfo
    
    # Blocking relationships
    blockingDependencies: [Step!]!
    
    # Tool usage
    toolCalls: [ToolCall!]!
    agentCalls: [Step!]!
    
    # Git versioning (for git-based agents)
    gitRepository: String
    gitCommit: String
    gitFilePath: String
    
    # Tracing
    spanId: String
  }
  
  type DAGStatus {
    interactableSteps: [Step!]!
    blockedSteps: [Step!]!
    activeSteps: [Step!]!
    cancellableSubgraphs: [[Step!]!]!
    agentCallGraph: [[Step!]!]!
  }
  
  type Run {
    id: ID!
    status: ExecutionState!
    initialInput: String!
    totalCost: Float!
    startTime: DateTime!
    endTime: DateTime
    duration: Float
    steps: [Step!]!
    stepCount: Int!
    
    # DAG-specific status
    dagStatus: DAGStatus!
    
    # Current pending input request across the run
    pendingInputRequest: InputRequest
    
    # Agent call statistics
    totalAgentCalls: Int!
    maxCallDepth: Int!
    uniqueAgentsInvolved: Int!
    gitAgentsUsed: [String!]!
    externalAgentsUsed: [String!]!
    
    # Tracing
    traceId: String
    
    # Ownership
    createdBy: User!
  }
  
  # =============================================================================
  #  STREAMING TYPES
  # =============================================================================
  
  type TokenChunk {
    content: String!
    timestamp: DateTime!
  }
  
  type LogChunk {
    message: String!
    level: String!
    timestamp: DateTime!
  }
  
  type ToolCall {
    id: ToolCallID!
    toolName: String!
    input: JSON!
    isSystemTool: Boolean!
    isAgentCall: Boolean!
  }
  
  type ToolCallStartChunk {
    toolCallId: ToolCallID!
    toolName: String!
    input: JSON!
    isSystemTool: Boolean!
    isAgentCall: Boolean!
    timestamp: DateTime!
  }
  
  type ToolStreamChunk {
    toolCallId: ToolCallID!
    payload: StreamChunk!
    timestamp: DateTime!
  }
  
  type ToolResultChunk {
    toolCallId: ToolCallID!
    output: JSON!
    success: Boolean!
    timestamp: DateTime!
  }
  
  type CompletionChunk {
    stepId: ID!
    completion: AgentCompletion!
    timestamp: DateTime!
  }
  
  type InputRequestChunk {
    inputRequest: InputRequest!
    timestamp: DateTime!
  }
  
  type AgentCallStartChunk {
    parentStepId: ID!
    childStepId: ID!
    agentName: String!
    agentSource: AgentSource!
    input: String!
    callDepth: Int!
    timestamp: DateTime!
  }
  
  type AgentCallCompleteChunk {
    parentStepId: ID!
    childStepId: ID!
    agentName: String!
    agentSource: AgentSource!
    completion: AgentCompletion!
    timestamp: DateTime!
  }
  
  union StreamChunk =
      TokenChunk
    | LogChunk
    | ToolCallStartChunk
    | ToolStreamChunk
    | ToolResultChunk
    | CompletionChunk
    | InputRequestChunk
    | AgentCallStartChunk
    | AgentCallCompleteChunk
  
  # =============================================================================
  #  SEARCH & DISCOVERY TYPES
  # =============================================================================
  
  type AgentSearchResult {
    agents: [AgentSearchMatch!]!
    totalCount: Int!
    suggestedTags: [String!]!
    facets: SearchFacets!
  }
  
  type AgentSearchMatch {
    agent: Agent!
    relevanceScore: Float!
    matchedFields: [String!]!
    matchedTags: [String!]!
    snippet: String
  }
  
  type SearchFacets {
    sources: [SourceFacet!]!
    repositories: [RepositoryFacet!]!
    tags: [TagFacet!]!
    providers: [ProviderFacet!]!
    versions: [VersionFacet!]!
  }
  
  type SourceFacet {
    source: AgentSource!
    count: Int!
  }
  
  type RepositoryFacet {
    repository: AgentRepository!
    count: Int!
  }
  
  type TagFacet {
    tag: String!
    count: Int!
  }
  
  type ProviderFacet {
    providerName: String!
    count: Int!
  }
  
  type VersionFacet {
    version: String!
    count: Int!
  }
  
  # =============================================================================
  #  ANALYTICS TYPES
  # =============================================================================
  
  type SystemUsageStats {
    totalRuns: Int!
    totalAgents: Int!
    totalGitAgents: Int!
    totalExternalAgents: Int!
    totalUsers: Int!
    totalCost: Float!
    averageRunDuration: Float!
    topAgents: [Agent!]!
    topUsers: [User!]!
    pendingInputRequests: Int!
    averageCompletionTime: Float!
    totalAgentCalls: Int!
    averageCallDepth: Float!
    circularCallAttempts: Int!
    gitRepositoriesActive: Int!
    externalAgentsHealthy: Int!
  }
  
  type CostAnalytics {
    totalCost: Float!
    costByModel: [ModelCostBreakdown!]!
    costByAgent: [AgentCostBreakdown!]!
    costBySource: [SourceCostBreakdown!]!
    costTrend: [CostDataPoint!]!
    projectedMonthlyCost: Float!
  }
  
  type ModelCostBreakdown {
    model: String!
    totalCost: Float!
    percentage: Float!
    tokenCount: Int!
  }
  
  type AgentCostBreakdown {
    agentName: String!
    totalCost: Float!
    percentage: Float!
    runCount: Int!
  }
  
  type SourceCostBreakdown {
    source: AgentSource!
    totalCost: Float!
    percentage: Float!
    runCount: Int!
  }
  
  type SystemAlert {
    id: ID!
    type: String!
    message: String!
    severity: String!
    timestamp: DateTime!
    metadata: JSON
  }
  
  # =============================================================================
  #  INPUT TYPES
  # =============================================================================
  
  input CreateUserInput {
    email: EmailAddress!
    name: String!
    role: UserRole = USER
  }
  
  input UpdateUserInput {
    name: String
    role: UserRole
    isActive: Boolean
  }
  
  input AddAgentRepositoryInput {
    name: String!
    gitUrl: String!
    branch: String = "main"
    isRoot: Boolean = false
    syncInterval: String = "5m"
    authType: String!
    sshKeyPath: String
    authToken: String
    webhookSecret: String
    readOnly: Boolean = false
  }
  
  input UpdateAgentRepositoryInput {
    gitUrl: String
    branch: String
    isRoot: Boolean
    syncInterval: String
    authType: String
    sshKeyPath: String
    authToken: String
    webhookSecret: String
    readOnly: Boolean
    isActive: Boolean
  }
  
  input CreateMcpServerInput {
    name: String!
    description: String
    type: McpServerType!
    endpoint: String!
    apiKey: String
  }
  
  input UpdateMcpServerInput {
    name: String
    description: String
    endpoint: String
    apiKey: String
  }
  
  input RegisterExternalA2AAgentInput {
    name: String!
    description: String
    endpoint: String!
    authConfig: ExternalA2AAuthInput!
    autoDiscover: Boolean = true
    healthCheckInterval: String = "5m"
  }
  
  input UpdateExternalA2AAgentInput {
    description: String
    authConfig: ExternalA2AAuthInput
    healthCheckInterval: String
    isActive: Boolean
  }
  
  input ExternalA2AAuthInput {
    type: String!
    apiKey: String
    oauthClientId: String
    oauthClientSecret: String
    oauthTokenUrl: String
    basicUsername: String
    basicPassword: String
  }
  
  input AgentSearchInput {
    query: String
    source: AgentSource
    repositoryName: String
    tags: [String!]
    providers: [String!]
    minVersion: String
    isActive: Boolean
    hasExternalAccess: Boolean
    createdBy: ID
  }
  
  input GitAgentFilters {
    repositoryName: String
    tags: [String!]
    hasAllowedAgents: Boolean
    lastModifiedAfter: DateTime
    lastModifiedBefore: DateTime
  }
  
  input AgentSortInput {
    field: AgentSortField!
    direction: SortDirection!
  }
  
  input RunAgentInput {
    agentName: String!
    input: String!
    contextScope: ContextScope
    maxCallDepth: Int
    gitCommit: String
  }
  
  input FilterMemoriesInput {
    runId: ID
    agentName: String
    key: String
    createdAfter: DateTime
    createdBefore: DateTime
  }
  
  input FilterRunsInput {
    status: ExecutionState
    agentName: String
    agentSource: AgentSource
    createdBy: ID
    createdAfter: DateTime
    createdBefore: DateTime
    hasInputRequests: Boolean
    hasAgentCalls: Boolean
    hasExternalCalls: Boolean
    minCallDepth: Int
    maxCallDepth: Int
    gitRepository: String
    gitCommit: String
  }
  
  # =============================================================================
  #  QUERY TYPE
  # =============================================================================
  
  type Query {
    # --- User Management ---
    me: User
    user(id: ID!): User
    users(limit: Int = 20, offset: Int = 0): [User!]!
    
    # --- Git Repository Management ---
    agentRepository(name: String!): AgentRepository
    agentRepositories: [AgentRepository!]!
    gitBranches(repositoryName: String!): [String!]!
    gitTags(repositoryName: String!): [String!]!
    
    # --- Agent Discovery ---
    agent(name: String!): Agent
    gitAgent(name: String!): GitAgent
    gitAgents(
      filters: GitAgentFilters
      limit: Int = 50
      offset: Int = 0
    ): [GitAgent!]!
    agentGitHistory(agentName: String!, limit: Int = 10): [GitCommit!]!
    
    # --- External A2A Management ---
    externalA2AAgent(id: ID): ExternalA2AAgent
    externalA2AAgents(limit: Int = 50, offset: Int = 0): [ExternalA2AAgent!]!
    
    # --- Agent Search & Discovery ---
    searchAgents(
      filters: AgentSearchInput!
      sort: AgentSortInput
      limit: Int = 20
      offset: Int = 0
    ): AgentSearchResult!
    
    recommendAgents(basedOnAgent: String, forUser: ID, limit: Int = 10): [Agent!]!
    
    # --- MCP Servers ---
    mcpServer(id: ID!): McpServer
    mcpServers(source: McpServerSource, type: McpServerType): [McpServer!]!
    
    tool(id: ID!): Tool
    tools(mcpServerId: ID, limit: Int = 100, offset: Int = 0): [Tool!]!
    systemTools: [Tool!]!
    
    # --- Execution & Monitoring ---
    run(id: ID!): Run
    runs(filters: FilterRunsInput, limit: Int = 20, offset: Int = 0): [Run!]!
    
    # Find all runs needing input across the system
    runsNeedingInput(limit: Int = 50): [Run!]!
    
    # Agent call analysis
    agentCallGraph(runId: ID!): JSON!
    circularCallAttempts(agentName: String, timeRange: String = "24h"): [JSON!]!
    
    # --- Analytics & Reporting ---
    agentAnalytics(agentName: String!, timeRange: String = "30d"): AgentAnalytics!
    systemUsageStats(timeRange: String = "30d"): SystemUsageStats!
    costAnalytics(timeRange: String = "30d"): CostAnalytics!
    
    # --- A2A Integration ---
    a2aAgentCard: JSON!
    a2aExposedAgents: [String!]!
  }
  
  # =============================================================================
  #  MUTATION TYPE
  # =============================================================================
  
  type Mutation {
    # --- User Management ---
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deactivateUser(id: ID!): Boolean!
    
    # --- Git Repository Management ---
    addAgentRepository(input: AddAgentRepositoryInput!): AgentRepository!
    updateAgentRepository(
      name: String!
      input: UpdateAgentRepositoryInput!
    ): AgentRepository!
    removeAgentRepository(name: String!): Boolean!
    syncAgentRepository(name: String!): AgentRepository!
    syncAllAgentRepositories: [AgentRepository!]!
    switchRepositoryBranch(name: String!, branch: String!): AgentRepository!
    
    # --- External A2A Management ---
    registerExternalA2AAgent(
      input: RegisterExternalA2AAgentInput!
    ): ExternalA2AAgent!
    updateExternalA2AAgent(
      id: ID!
      input: UpdateExternalA2AAgentInput!
    ): ExternalA2AAgent!
    removeExternalA2AAgent(id: ID!): Boolean!
    refreshExternalA2AAgent(id: ID!): ExternalA2AAgent!
    testExternalA2AConnection(id: ID!): Boolean!
    
    # --- MCP Server Management ---
    createMcpServer(input: CreateMcpServerInput!): McpServer!
    updateMcpServer(id: ID!, input: UpdateMcpServerInput!): McpServer!
    removeMcpServer(id: ID!): Boolean!
    refreshMcpServer(id: ID!): McpServer!
    testMcpServerConnection(id: ID!): Boolean!
    
    # --- Execution Control ---
    runAgents(inputs: [RunAgentInput!]!): [Run!]!
    terminateRun(id: ID!): Run!
    pauseRun(id: ID!): Run!
    resumeRun(id: ID!, userInput: String): Run!
    
    # --- Step-level Control ---
    cancelStep(stepId: ID!, reason: String): Step!
    cancelSubgraph(rootStepId: ID!, reason: String): [Step!]!
    
    # --- Input Response ---
    provideInput(
      runId: ID!
      inputRequestId: ID!
      response: String!
      attachments: [Upload!]
    ): Run!
    
    skipInput(runId: ID!, inputRequestId: ID!, useDefault: String): Run!
  }
  
  # =============================================================================
  #  SUBSCRIPTION TYPE
  # =============================================================================
  
  type Subscription {
    # --- Real-time Execution ---
    runUpdated(runId: ID!): Run!
    stepStream(stepId: ID!): StreamChunk!
    
    # --- Input Requests ---
    inputRequested: InputRequest!
    inputRequestResolved(runId: ID!): CompletedInputRequest!
    
    # --- Agent Calls ---
    agentCallStarted(runId: ID): AgentCallStartChunk!
    agentCallCompleted(runId: ID): AgentCallCompleteChunk!
    
    # --- Git Repository Events ---
    repositorySynced: AgentRepository!
    agentDiscovered: GitAgent!
    agentUpdated: GitAgent!
    
    # --- External A2A Events ---
    externalAgentHealthChanged: ExternalA2AAgent!
    
    # --- System Events ---
    systemAlert: SystemAlert!
    agentCompleted(runId: ID): Step!
  }
`;