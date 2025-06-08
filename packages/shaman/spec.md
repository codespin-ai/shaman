# Shaman AI Agent Coordination Framework

## 1. Overview & Philosophy

Shaman is a comprehensive, enterprise-grade backend framework designed to be the central orchestration hub in a federated agent ecosystem. It serves simultaneously as:

- **Internal Agent Orchestrator:** A robust platform for defining, versioning, and executing complex workflows with native agents.
- **A2A Gateway:** A fully compliant Agent2Agent (A2A) protocol implementation that can both consume external agents and expose internal agents.
- **Enterprise Control Plane:** A manageable, observable, and scalable system with directories, tags, permissions, and comprehensive audit trails.

### Core Principles:

- **API-First Architecture:** Every operation is accessible via a comprehensive GraphQL API, ensuring language-agnostic integration.
- **Protocol Interoperability:** Native support for MCP (Model Context Protocol) and A2A (Agent2Agent) standards.
- **Dynamic Execution:** Workflows unfold dynamically based on agent decisions, forming complex DAGs at runtime.
- **Pluggable Infrastructure:** All critical components (workflow engines, providers, storage) are swappable via adapter patterns.
- **Observable by Design:** OpenTelemetry-first architecture with structured logging and comprehensive metrics.
- **Enterprise-Ready:** Built-in support for directories, tagging, versioning, authentication, authorization, and audit trails.

## 2. Comprehensive Concepts & Terminology

### 2.1 Core Entities

- **Provider:** A configured LLM service endpoint (OpenAI, Anthropic, Groq, local Ollama). Defined statically in configuration with connection details and authentication credentials.

- **Prompt Template:** A versioned, reusable template for system prompts. Contains instructions with `{{prompt}}` placeholder for dynamic user input injection.

- **Directory:** A hierarchical organizational structure for agents, supporting nested folders with full path-based navigation (e.g., `/enterprise/customer-service/billing`).

- **Tag:** A keyword-based classification system with optional hierarchy, descriptions, and usage analytics. Supports semantic relationships and discovery algorithms.

- **MCP Server:** A service exposing tools via the Model Context Protocol. Can be:

  - `STDIO`: Local processes (defined in config)
  - `HTTP`: Remote HTTP endpoints (API-managed)
  - `A2A`: External A2A-compliant agents (API-managed)

- **Tool:** A function exposed by an MCP Server, with JSON Schema definition, usage statistics, and permission controls.

- **Agent:** A comprehensive blueprint for an AI worker, including:
  - Core configuration (prompt template, model, providers)
  - Permissions (accessible tools, callable agents)
  - Metadata (version, description, examples, documentation)
  - Organization (directory, tags)
  - A2A exposure settings

### 2.2 Execution Entities

- **Run:** Top-level execution instance with unique ID, representing a complete user request fulfillment.

- **Step:** Single agent execution within a Run, containing:

  - Complete conversation history
  - Token usage and cost tracking
  - Execution timeline
  - Parent-child relationships (forms the DAG)

- **Memory:** Persistent data saved by agents, with:

  - Structured key-value storage
  - Cross-run accessibility
  - Namespace isolation by agent
  - Expiration policies

- **Message:** Individual conversation turn with role-based typing and extensible part system.

- **Stream Chunk:** Real-time execution events pushed via WebSocket subscriptions.

## 3. Use Cases & Application Scenarios

### 3.1 Enterprise Customer Support Automation

**Scenario:** A large e-commerce company wants to automate customer support inquiries while maintaining human oversight for complex issues.

**Implementation:**
```graphql
# Create a specialized customer support agent
mutation CreateSupportAgent {
  createAgent(input: {
    name: "Tier1CustomerSupport"
    description: "Handles common customer inquiries about orders, returns, and account issues"
    version: "2.1.0"
    directoryId: "customer-service-dir"
    tagIds: ["customer-support", "tier-1", "e-commerce"]
    promptTemplateId: "customer-support-template"
    providerNames: ["gpt-4-turbo"]
    mcpServerIds: ["order-management-mcp", "customer-db-mcp", "refund-processor-mcp"]
    allowedAgentIds: ["Tier2CustomerSupport", "EscalationManager"]
    isExposedViaA2A: true
    a2aExposureConfig: {
      securitySchemes: {
        "apiKey": {
          "type": "apiKey",
          "in": "header",
          "name": "X-API-Key"
        }
      }
      allowedOrigins: ["https://support.company.com"]
      rateLimit: {
        requestsPerMinute: 100
        requestsPerHour: 2000
        requestsPerDay: 10000
      }
    }
  }) {
    id
    name
  }
}

# Execute customer support workflow
mutation HandleCustomerInquiry {
  runAgents(inputs: [{
    agentName: "Tier1CustomerSupport"
    input: "Customer #12345 is asking about the status of order #ORDER-789 and wants to know if they can cancel it"
    contextScope: FULL
  }]) {
    id
    status
  }
}
```

**Workflow Flow:**
1. Customer inquiry triggers the Tier1 agent
2. Agent uses order-management-mcp to check order status
3. Agent uses customer-db-mcp to verify customer identity  
4. If order can be cancelled, uses refund-processor-mcp
5. If issue is complex, escalates to Tier2CustomerSupport agent
6. All interactions are logged and available for analytics

### 3.2 Software Development Workflow Automation

**Scenario:** A development team wants to automate code review, testing, and deployment processes using AI agents that can interact with their existing tools.

**Implementation:**
```graphql
# Create development workflow agents
mutation CreateDevAgents {
  createAgent(input: {
    name: "CodeReviewer"
    description: "Reviews pull requests for code quality, security issues, and best practices"
    version: "1.5.0"
    directoryId: "dev-tools-dir"
    tagIds: ["development", "code-review", "security"]
    promptTemplateId: "code-review-template"
    mcpServerIds: ["github-mcp", "sonarqube-mcp", "security-scanner-mcp"]
    allowedAgentIds: ["TestRunner", "DeploymentManager"]
  }) {
    id
  }
}

# GitHub webhook triggers code review
mutation ReviewPullRequest {
  runAgents(inputs: [{
    agentName: "CodeReviewer"
    input: "Review pull request #456 in repository 'payment-service'. Check for security vulnerabilities and performance issues."
    contextScope: FULL
  }]) {
    id
  }
}
```

**Agent Chain:**
1. **CodeReviewer** analyzes the PR using GitHub MCP and security scanners
2. If code passes review, calls **TestRunner** agent to run automated tests
3. **TestRunner** uses CI/CD MCP tools to execute test suites
4. If tests pass, calls **DeploymentManager** for staging deployment
5. Each agent saves findings to memory for future reference

### 3.3 Financial Research & Analysis Platform

**Scenario:** An investment firm wants to automate financial research by having AI agents analyze market data, company filings, and news to generate investment recommendations.

**Implementation:**
```graphql
# Create financial analysis pipeline
mutation CreateFinancialAgents {
  # Market data analyst
  createAgent(input: {
    name: "MarketDataAnalyst"
    description: "Analyzes real-time market data and identifies trends"
    directoryId: "finance-research-dir"
    tagIds: ["finance", "market-analysis", "real-time"]
    mcpServerIds: ["bloomberg-api-mcp", "yahoo-finance-mcp", "sec-filings-mcp"]
    allowedAgentIds: ["RiskAssessment", "PortfolioOptimizer"]
  }) {
    id
  }
  
  # Risk assessment specialist
  createAgent(input: {
    name: "RiskAssessment"
    description: "Evaluates investment risks and market volatility"
    directoryId: "finance-research-dir"
    tagIds: ["finance", "risk-analysis", "compliance"]
    mcpServerIds: ["risk-models-mcp", "regulation-db-mcp", "credit-rating-mcp"]
    allowedAgentIds: ["ComplianceChecker", "ReportGenerator"]
  }) {
    id
  }
}

# Trigger comprehensive analysis
mutation AnalyzeStock {
  runAgents(inputs: [{
    agentName: "MarketDataAnalyst"
    input: "Perform comprehensive analysis of AAPL stock for potential investment. Include technical analysis, fundamental analysis, and risk assessment."
    memoryIdsToLoad: ["market-conditions-2024", "tech-sector-outlook"]
  }]) {
    id
  }
}
```

**Multi-Agent Workflow:**
1. **MarketDataAnalyst** gathers current market data and technical indicators
2. Calls **RiskAssessment** to evaluate volatility and sector risks
3. **RiskAssessment** calls **ComplianceChecker** to ensure regulatory compliance
4. **ReportGenerator** compiles findings into formatted investment recommendation
5. All agents save insights to shared memory for cross-analysis correlation

### 3.4 Healthcare Patient Care Coordination

**Scenario:** A healthcare system wants to coordinate patient care across multiple departments while maintaining HIPAA compliance and ensuring proper medical oversight.

**Implementation:**
```graphql
# Create healthcare coordination agents
mutation CreateHealthcareAgents {
  createAgent(input: {
    name: "PatientIntakeCoordinator"
    description: "Manages patient intake, schedules appointments, and coordinates care"
    directoryId: "healthcare-dir"
    tagIds: ["healthcare", "patient-care", "scheduling", "hipaa-compliant"]
    promptTemplateId: "healthcare-intake-template"
    mcpServerIds: ["ehr-system-mcp", "scheduling-mcp", "insurance-verification-mcp"]
    allowedAgentIds: ["SpecialistReferral", "TestOrderingAgent", "DischargeCoordinator"]
    isExposedViaA2A: true
    a2aExposureConfig: {
      securitySchemes: {
        "oauth2": {
          "type": "oauth2",
          "flows": {
            "clientCredentials": {
              "tokenUrl": "https://auth.hospital.com/oauth/token",
              "scopes": {
                "patient:read": "Read patient information",
                "scheduling:write": "Schedule appointments"
              }
            }
          }
        }
      }
      allowedOrigins: ["https://portal.hospital.com", "https://mobile.hospital.com"]
    }
  }) {
    id
  }
}

# Patient admission workflow
mutation AdmitPatient {
  runAgents(inputs: [{
    agentName: "PatientIntakeCoordinator"
    input: "Process admission for John Smith, DOB: 1985-03-15, presenting with chest pain. Verify insurance, schedule EKG, and coordinate with cardiology if needed."
    contextScope: SPECIFIC
  }]) {
    id
  }
}
```

**Care Coordination Flow:**
1. **PatientIntakeCoordinator** verifies insurance and creates patient record
2. Based on symptoms, calls **TestOrderingAgent** to order appropriate tests
3. **SpecialistReferral** agent determines if specialist consultation needed
4. **DischargeCoordinator** manages discharge planning and follow-up scheduling
5. All agents maintain HIPAA compliance and audit trails

### 3.5 Supply Chain Optimization

**Scenario:** A manufacturing company wants to optimize their global supply chain by having AI agents monitor suppliers, predict demand, and automate procurement decisions.

**Implementation:**
```graphql
# Create supply chain agents
mutation CreateSupplyChainAgents {
  createAgent(input: {
    name: "DemandForecaster"
    description: "Predicts product demand using historical data and market trends"
    directoryId: "supply-chain-dir"
    tagIds: ["supply-chain", "forecasting", "analytics"]
    mcpServerIds: ["sales-data-mcp", "market-trends-mcp", "weather-api-mcp"]
    allowedAgentIds: ["InventoryOptimizer", "SupplierEvaluator"]
  }) {
    id
  }
  
  createAgent(input: {
    name: "SupplierEvaluator"
    description: "Monitors supplier performance and identifies risks"  
    directoryId: "supply-chain-dir"
    tagIds: ["supply-chain", "supplier-management", "risk-assessment"]
    mcpServerIds: ["supplier-api-mcp", "logistics-mcp", "quality-metrics-mcp"]
    allowedAgentIds: ["ProcurementAgent", "RiskMitigator"]
  }) {
    id
  }
}

# Weekly supply chain optimization
mutation OptimizeSupplyChain {
  runAgents(inputs: [{
    agentName: "DemandForecaster"
    input: "Generate 4-week demand forecast for all product lines considering seasonal trends and current market conditions"
    memoryIdsToLoad: ["q4-trends", "supplier-performance-data"]
  }]) {
    id
  }
}
```

**Optimization Workflow:**
1. **DemandForecaster** analyzes sales patterns and external factors
2. **InventoryOptimizer** calculates optimal stock levels based on forecasts
3. **SupplierEvaluator** assesses current supplier capabilities and risks
4. **ProcurementAgent** automatically generates purchase orders
5. **RiskMitigator** identifies backup suppliers and contingency plans

### 3.6 Content Creation & Publishing Pipeline

**Scenario:** A digital marketing agency wants to automate content creation, from research and writing to SEO optimization and social media distribution.

**Implementation:**
```graphql
# Create content creation pipeline
mutation CreateContentAgents {
  createAgent(input: {
    name: "ContentResearcher"
    description: "Researches topics, keywords, and competitor content"
    directoryId: "content-marketing-dir"
    tagIds: ["content-creation", "research", "seo"]
    mcpServerIds: ["google-trends-mcp", "competitor-analysis-mcp", "keyword-research-mcp"]
    allowedAgentIds: ["ContentWriter", "SEOOptimizer"]
  }) {
    id
  }
  
  createAgent(input: {
    name: "SocialMediaManager"
    description: "Adapts content for different social platforms and schedules posts"
    directoryId: "content-marketing-dir"  
    tagIds: ["social-media", "content-distribution", "scheduling"]
    mcpServerIds: ["twitter-api-mcp", "linkedin-api-mcp", "facebook-api-mcp"]
    allowedAgentIds: ["PerformanceTracker"]
  }) {
    id
  }
}

# Create content campaign
mutation CreateContentCampaign {
  runAgents(inputs: [{
    agentName: "ContentResearcher"
    input: "Research and create a comprehensive blog post about 'AI in Healthcare 2024'. Include SEO keywords, competitor analysis, and create social media variants."
    contextScope: FULL
  }]) {
    id
  }
}
```

**Content Pipeline Flow:**
1. **ContentResearcher** gathers data on target keywords and competitor content
2. **ContentWriter** creates the main article based on research findings
3. **SEOOptimizer** enhances content for search engine visibility
4. **SocialMediaManager** creates platform-specific variants and schedules posts
5. **PerformanceTracker** monitors engagement and suggests improvements

### 3.7 External Agent Integration Scenarios

**Scenario:** A company wants to integrate with third-party AI services while maintaining centralized governance and monitoring.

**Implementation:**
```graphql
# Register external A2A agent
mutation RegisterExternalAgent {
  createMcpServer(input: {
    name: "LegalDocumentAnalyzer"
    description: "External service for legal document analysis and contract review"
    type: A2A
    endpoint: "https://legal-ai.lawfirm.com/a2a/v1"
    apiKey: "legal-service-key-encrypted"
  }) {
    id
    agentCard
    tools {
      name
      description
    }
  }
}

# Use external agent in workflow  
mutation AnalyzeLegalDocument {
  runAgents(inputs: [{
    agentName: "ContractReviewCoordinator"
    input: "Review the attached NDA for compliance issues and recommend changes"
    contextScope: FULL
  }]) {
    id
  }
}
```

**Federated Agent Benefits:**
- **Centralized Governance:** All agent interactions go through Shaman's security and audit system
- **Cost Tracking:** External agent usage tracked alongside internal agents
- **Unified Interface:** Developers use same GraphQL API regardless of agent location
- **Performance Monitoring:** External agent response times and error rates monitored
- **Fallback Strategies:** Alternative agents can be configured if external services fail

## 4. Detailed System Architecture

### 4.1 Component Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   GraphQL Client    │    │   A2A Client        │    │   Shaman UI         │
│   (External Apps)   │    │   (External Agent)  │    │   (Admin Dashboard) │
└─────────┬───────────┘    └─────────┬───────────┘    └─────────┬───────────┘
          │                          │                          │
          └─────┐           ┌────────┴───────┐         ┌────────┘
                │           │                │         │
          ┌─────▼───────────▼────────────────▼─────────▼─────┐
          │              Shaman Server                      │
          │  ┌─────────────────┐  ┌─────────────────────────┐ │
          │  │  GraphQL API    │  │     A2A Gateway        │ │
          │  │     Engine      │  │   (HTTP Endpoints)     │ │
          │  └─────────────────┘  └─────────────────────────┘ │
          │  ┌─────────────────┐  ┌─────────────────────────┐ │
          │  │   Real-time     │  │  Workflow Engine        │ │
          │  │   Streaming     │  │     Adapter             │ │
          │  └─────────────────┘  └─────────────────────────┘ │
          └─────────────────┬───────────────────────────────────┘
                            │
          ┌─────────────────▼───────────────────────────────────┐
          │            Workflow Engine                          │
          │   ┌─────────────────┐    ┌─────────────────────────┐ │
          │   │   Temporal.io   │    │      BullMQ + Redis    │ │
          │   │  (Production)   │    │    (Development)       │ │
          │   └─────────────────┘    └─────────────────────────┘ │
          └─────────────────┬───────────────────────────────────┘
                            │
          ┌─────────────────▼───────────────────────────────────┐
          │                Worker Pool                          │
          │  ┌─────────┐ ┌──────────┐ ┌─────────────────────────┐ │
          │  │ LLM     │ │   MCP    │ │      A2A Client        │ │
          │  │ Calls   │ │  Tools   │ │        Logic           │ │
          │  └─────────┘ └──────────┘ └─────────────────────────┘ │
          └─────────────────┬───────────────────────────────────┘
                            │
          ┌─────────────────▼───────────────────────────────────┐
          │             Infrastructure                          │
          │  ┌─────────┐ ┌──────────┐ ┌─────────────────────────┐ │
          │  │PostgreSQL│ │  Redis   │ │     OpenTelemetry      │ │
          │  │  (Data) │ │(Streams) │ │      (Tracing)         │ │
          │  └─────────┘ └──────────┘ └─────────────────────────┘ │
          └─────────────────────────────────────────────────────┘
```

### 4.2 Shaman Server (Control Plane & Gateway)

The `packages/shaman` Node.js application, serving as the system's nerve center.

#### 4.2.1 GraphQL API Engine

- **Technology:** Apollo Server with GraphQL subscriptions over WebSockets
- **Authentication:** JWT-based with role-based access control (RBAC)
- **Authorization:** Field-level permissions based on user roles and agent ownership
- **Rate Limiting:** Per-user and per-endpoint limits to prevent abuse
- **Validation:** Comprehensive input validation with detailed error messages

#### 4.2.2 A2A Gateway

- **HTTP Server:** Express.js endpoints implementing A2A JSON-RPC methods
- **Authentication:** Configurable security schemes per exposed agent
- **Request Translation:** A2A messages → Shaman RunAgentInput
- **Response Translation:** Shaman StreamChunks → A2A SSE events
- **AgentCard Generation:** Dynamic generation from Agent definitions

#### 4.2.3 Real-time Streaming Hub

- **WebSocket Management:** Handles GraphQL subscription connections
- **Redis Pub/Sub:** Subscribes to worker-generated stream events
- **Event Filtering:** Ensures clients only receive authorized events
- **Connection Scaling:** Supports horizontal scaling with Redis clustering

#### 4.2.4 Operational Constraints

- **No LLM Calls:** Server never directly calls LLM providers
- **Stateless Design:** All persistent state in PostgreSQL/Redis
- **High Availability:** Designed for multi-instance deployment

### 4.3 Workflow Engine (Execution Plane)

Pluggable backend for durable workflow execution.

#### 4.3.1 Temporal.io Adapter (Production)

- **Workflows:** `executeAgentStep` workflow with child workflow support
- **Activities:** `callLLM`, `executeTool`, `saveMemory`, `publishStream`
- **Durability:** Automatic state persistence and recovery
- **Scaling:** Horizontal worker scaling with automatic load balancing
- **Timeouts:** Configurable execution and activity timeouts

#### 4.3.2 BullMQ Adapter (Development)

- **Queue Structure:** Single queue with job prioritization
- **Jobs:** `executeStep` jobs with retry policies
- **Redis Backend:** Requires Redis for job persistence
- **Simplified Logic:** Easier local development and testing

#### 4.3.3 Interface Definition

```typescript
interface WorkflowEngineAdapter {
  startRuns(inputs: RunAgentInput[]): Promise<RunIdentifier[]>;
  getRun(id: RunIdentifier): Promise<Run | null>;
  listRuns(options: ListRunsOptions): Promise<Run[]>;
  getRunHistory(id: RunIdentifier): Promise<Step[]>;
  terminateRun(id: RunIdentifier): Promise<boolean>;
  getEngineStatus(): Promise<EngineStatus>;
  engineType: string;
}
```

### 4.4 Worker Process (Execution Units)

Scalable Node.js processes performing the actual agent execution.

#### 4.4.1 Core Responsibilities

- **Job Consumption:** Pull and execute jobs from workflow engine
- **LLM Interaction:** Only component making direct LLM API calls
- **Tool Execution:** Handle MCP and A2A tool calls
- **Stream Publishing:** Push real-time events to Redis
- **State Updates:** Update Step status and metrics in database

#### 4.4.2 LLM Integration

- **Vercel AI SDK:** Primary interface for all LLM interactions
- **Provider Abstraction:** Support for OpenAI, Anthropic, Groq, Ollama
- **Streaming Support:** Real-time token streaming with chunk aggregation
- **Error Handling:** Comprehensive retry policies and error categorization

#### 4.4.3 A2A Client Implementation

- **Discovery:** Fetch and cache external agent AgentCards
- **Authentication:** Support for various A2A security schemes
- **Request Translation:** Shaman tool calls → A2A JSON-RPC requests
- **Stream Handling:** A2A SSE events → Shaman StreamChunks
- **Error Recovery:** Retry failed external agent calls

## 5. Agent Registration & Discovery System

### 5.1 External Agent Registration

#### 5.1.1 Manual Registration

```graphql
mutation RegisterExternalAgent {
  createMcpServer(
    input: {
      name: "Customer Support Assistant"
      description: "Specialized agent for handling customer inquiries"
      type: A2A
      endpoint: "https://support-agent.example.com/a2a/v1"
      apiKey: "sha256:encrypted-api-key"
    }
  ) {
    id
    isActive
    agentCard
    tools {
      name
      description
      schema
    }
  }
}
```

#### 5.1.2 Automatic Discovery Process

1. **AgentCard Fetching:** GET `{endpoint}/../.well-known/agent.json`
2. **Validation:** Verify AgentCard schema compliance
3. **Skill Parsing:** Extract skills as discoverable tools
4. **Capability Analysis:** Assess supported input/output modes
5. **Authentication Testing:** Verify provided credentials work
6. **Tool Registration:** Create Tool records for each skill
7. **Status Monitoring:** Periodic health checks and capability refresh

#### 5.1.3 Discovery Error Handling

- **Network Failures:** Exponential backoff with circuit breaker
- **Invalid AgentCard:** Detailed validation error reporting
- **Authentication Failures:** Secure credential verification
- **Capability Mismatches:** Version compatibility checking

### 5.2 Agent Discovery & Search System

#### 5.2.1 Multi-Dimensional Search

```graphql
query DiscoverAgents {
  searchAgents(
    query: "customer support billing"
    filters: {
      tags: ["customer-service", "billing"]
      directory: "/enterprise/support"
      capabilities: ["text", "structured-data"]
      version: ">=1.0.0"
      isActive: true
      hasA2AExposure: true
    }
    sort: RELEVANCE
    limit: 20
  ) {
    agents {
      id
      name
      description
      relevanceScore
      matchedTags
    }
    suggestedTags
    totalCount
  }
}
```

#### 5.2.2 Search Algorithm Components

- **Text Search:** Full-text indexing of name, description, examples
- **Tag Matching:** Hierarchical tag relationships and synonyms
- **Capability Filtering:** Input/output mode compatibility
- **Usage Analytics:** Popular agents and success rates
- **Semantic Similarity:** Vector embeddings for related agent discovery

#### 5.2.3 Recommendation Engine

- **Usage Patterns:** Recommend based on historical run data
- **Agent Compatibility:** Suggest complementary agent pairings
- **Skill Gaps:** Identify missing capabilities in user workflows
- **Performance Metrics:** Promote high-performing agents

#### 5.2.4 Agent Performance Analytics

```graphql
type AgentAnalytics {
  totalRuns: Int!
  successRate: Float!
  averageExecutionTime: Float!
  averageCost: Float!
  userRating: Float
  usageGrowth: Float!
  peakUsageHours: [Int!]!
  commonFailureReasons: [String!]!
}
```

## 6. Comprehensive Security Model

### 6.1 Authentication Architecture

#### 6.1.1 GraphQL API Authentication

- **JWT Tokens:** RS256-signed with configurable expiration
- **Identity Providers:** Integration with OAuth 2.0, OIDC, SAML
- **Multi-Factor Authentication:** TOTP and WebAuthn support
- **API Keys:** Service account authentication for automated systems
- **Session Management:** Secure token refresh and revocation

#### 6.1.2 A2A Gateway Authentication

- **Per-Agent Security:** Each exposed agent defines its auth requirements
- **Security Schemes:** Support for Bearer, API Key, mTLS, OAuth 2.0
- **Dynamic Credentials:** Runtime credential injection and rotation
- **Request Validation:** Signature verification and timestamp checking

#### 6.1.3 Internal Service Authentication

- **Worker-to-Database:** Certificate-based PostgreSQL authentication
- **Redis Authentication:** AUTH with rotating passwords
- **Workflow Engine:** Mutual TLS for Temporal communication

### 6.2 Authorization Framework

#### 6.2.1 Role-Based Access Control (RBAC)

```typescript
enum Permission {
  AGENT_READ = "agent:read",
  AGENT_CREATE = "agent:create",
  AGENT_UPDATE = "agent:update",
  AGENT_DELETE = "agent:delete",
  AGENT_EXECUTE = "agent:execute",
  AGENT_EXPOSE_A2A = "agent:expose_a2a",
  RUN_READ = "run:read",
  RUN_TERMINATE = "run:terminate",
  SYSTEM_ADMIN = "system:admin",
}

interface Role {
  name: string;
  permissions: Permission[];
  agentFilters?: {
    directoryPaths?: string[];
    tags?: string[];
    owners?: string[];
  };
}
```

#### 6.2.2 Resource-Level Permissions

- **Agent Ownership:** Creators have full control over their agents
- **Directory Permissions:** Hierarchical access control
- **Tag-Based Access:** Permission by agent categorization
- **Run Visibility:** Users see only their runs or authorized runs

#### 6.2.3 External Agent Security

- **Credential Isolation:** External agent keys encrypted at rest
- **Permission Scoping:** Limit external agent access to specific skills
- **Audit Logging:** Complete trail of external agent interactions
- **Rate Limiting:** Per-agent and per-user external call limits

## 7. Complete GraphQL API Specification

### 7.1 Enhanced Schema

```graphql
# =============================================================================
#  SCALARS, ENUMS & INTERFACES
# =============================================================================

scalar DateTime
scalar ToolCallID
scalar JSON
scalar EmailAddress

enum ExecutionState {
  SUBMITTED
  WORKING
  INPUT_REQUIRED
  COMPLETED
  CANCELED
  FAILED
  REJECTED
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
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

interface Owned {
  createdBy: User!
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

type Directory implements Timestamped & Owned {
  id: ID!
  name: String!
  description: String
  fullPath: String!
  parentDirectory: Directory
  childDirectories: [Directory!]!
  agents: [Agent!]!
  agentCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: User!
}

type Tag {
  id: ID!
  name: String!
  description: String
  parentTag: Tag
  childTags: [Tag!]!
  usageCount: Int!
  agents: [Agent!]!
  createdAt: DateTime!
}

type PromptTemplate implements Timestamped & Owned {
  id: ID!
  name: String!
  description: String
  template: String!
  version: String!
  agents: [Agent!]!
  usageCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: User!
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
  createdAt: DateTime!
  updatedAt: DateTime!
}

type A2AExposureConfig {
  securitySchemes: JSON!
  allowedOrigins: [String!]
  rateLimit: RateLimit
}

type RateLimit {
  requestsPerMinute: Int!
  requestsPerHour: Int!
  requestsPerDay: Int!
}

type Agent implements Timestamped & Owned {
  id: ID!
  name: String!
  description: String!
  version: String!
  model: String
  defaultContextScope: ContextScope!
  providerNames: [String!]!
  iconUrl: String
  documentationUrl: String
  examples: [String!]
  isExposedViaA2A: Boolean!
  isActive: Boolean!

  # Relationships
  directory: Directory
  tags: [Tag!]!
  promptTemplate: PromptTemplate!
  mcpServers: [McpServer!]!
  allowedAgents: [Agent!]!
  a2aExposureConfig: A2AExposureConfig

  # Analytics
  analytics: AgentAnalytics!

  # Audit trail
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: User!
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
#  EXECUTION TYPES
# =============================================================================

interface Message {
  id: ID!
  role: MessageRole!
  content: String!
  sequenceNumber: Int!
  createdAt: DateTime!
}

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

type Memory {
  id: ID!
  key: String!
  value: JSON!
  run: Run!
  producingStep: Step!
  agentName: String!
  expiresAt: DateTime
  createdAt: DateTime!
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
  agent: Agent!
  parentSteps: [Step!]!
  childSteps: [Step!]!

  # Tracing
  spanId: String
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
}

type ToolCallStartChunk {
  toolCallId: ToolCallID!
  toolName: String!
  input: JSON!
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

union StreamChunk =
    TokenChunk
  | LogChunk
  | ToolCallStartChunk
  | ToolStreamChunk
  | ToolResultChunk

# =============================================================================
#  SEARCH & DISCOVERY TYPES
# =============================================================================

type AgentSearchResult {
  agents: [AgentSearchMatch!]!
  totalCount: Int!
  suggestedTags: [Tag!]!
  facets: SearchFacets!
}

type AgentSearchMatch {
  agent: Agent!
  relevanceScore: Float!
  matchedFields: [String!]!
  matchedTags: [Tag!]!
  snippet: String
}

type SearchFacets {
  directories: [DirectoryFacet!]!
  tags: [TagFacet!]!
  providers: [ProviderFacet!]!
  versions: [VersionFacet!]!
}

type DirectoryFacet {
  directory: Directory!
  count: Int!
}

type TagFacet {
  tag: Tag!
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

input CreateDirectoryInput {
  name: String!
  description: String
  parentDirectoryId: ID
}

input UpdateDirectoryInput {
  name: String
  description: String
}

input MoveAgentOrDirectoryInput {
  targetDirectoryId: ID!
}

input CreateTagInput {
  name: String!
  description: String
  parentTagId: ID
}

input UpdateTagInput {
  name: String
  description: String
}

input CreatePromptTemplateInput {
  name: String!
  description: String
  template: String!
  version: String = "1.0.0"
}

input UpdatePromptTemplateInput {
  name: String
  description: String
  template: String
  version: String
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

input RateLimitInput {
  requestsPerMinute: Int!
  requestsPerHour: Int!
  requestsPerDay: Int!
}

input A2AExposureConfigInput {
  securitySchemes: JSON!
  allowedOrigins: [String!]
  rateLimit: RateLimitInput
}

input CreateAgentInput {
  name: String!
  description: String!
  version: String!
  directoryId: ID
  tagIds: [ID!]
  model: String
  defaultContextScope: ContextScope = FULL
  promptTemplateId: ID!
  providerNames: [String!]!
  mcpServerIds: [ID!]!
  allowedAgentIds: [ID!]
  iconUrl: String
  documentationUrl: String
  examples: [String!]
  isExposedViaA2A: Boolean = false
  a2aExposureConfig: A2AExposureConfigInput
}

input UpdateAgentInput {
  name: String
  description: String
  version: String
  tagIds: [ID!]
  model: String
  defaultContextScope: ContextScope
  promptTemplateId: ID
  providerNames: [String!]
  mcpServerIds: [ID!]
  allowedAgentIds: [ID!]
  iconUrl: String
  documentationUrl: String
  examples: [String!]
  isExposedViaA2A: Boolean
  a2aExposureConfig: A2AExposureConfigInput
}

input AgentSearchInput {
  query: String
  directoryId: ID
  tagIds: [ID!]
  providerNames: [String!]
  capabilities: [String!]
  minVersion: String
  isActive: Boolean
  hasA2AExposure: Boolean
  createdBy: ID
}

input AgentSortInput {
  field: AgentSortField!
  direction: SortDirection!
}

input RunAgentInput {
  agentName: String!
  input: String!
  memoryIdsToLoad: [ID!]
  contextScope: ContextScope
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
  agentId: ID
  createdBy: ID
  createdAfter: DateTime
  createdBefore: DateTime
}

# =============================================================================
#  API DEFINITION
# =============================================================================

type Query {
  # --- User Management ---
  me: User
  user(id: ID!): User
  users(limit: Int = 20, offset: Int = 0): [User!]!

  # --- Organizational Structure ---
  directory(id: ID!): Directory
  directories(parentDirectoryId: ID): [Directory!]!
  rootDirectories: [Directory!]!

  tag(id: ID!): Tag
  tags(parentTagId: ID): [Tag!]!
  popularTags(limit: Int = 10): [Tag!]!

  # --- Agent Management ---
  promptTemplate(id: ID!): PromptTemplate
  promptTemplates(limit: Int = 50, offset: Int = 0): [PromptTemplate!]!

  mcpServer(id: ID!): McpServer
  mcpServers(source: McpServerSource, type: McpServerType): [McpServer!]!

  tool(id: ID!): Tool
  tools(mcpServerId: ID, limit: Int = 100, offset: Int = 0): [Tool!]!
  popularTools(limit: Int = 10): [Tool!]!

  agent(id: ID, name: String): Agent
  agents(
    directoryId: ID
    tagId: ID
    filters: AgentSearchInput
    sort: AgentSortInput
    limit: Int = 20
    offset: Int = 0
  ): [Agent!]!

  # --- Advanced Search & Discovery ---
  searchAgents(
    filters: AgentSearchInput!
    sort: AgentSortInput
    limit: Int = 20
    offset: Int = 0
  ): AgentSearchResult!

  recommendAgents(basedOnAgent: ID, forUser: ID, limit: Int = 10): [Agent!]!

  getAgentCard(agentId: ID!): JSON!

  # --- Execution & Monitoring ---
  run(id: ID!): Run
  runs(filters: FilterRunsInput, limit: Int = 20, offset: Int = 0): [Run!]!

  memories(
    filter: FilterMemoriesInput!
    limit: Int = 50
    offset: Int = 0
  ): [Memory!]!

  # --- Analytics & Reporting ---
  agentAnalytics(agentId: ID!, timeRange: String = "30d"): AgentAnalytics!
  systemUsageStats(timeRange: String = "30d"): SystemUsageStats!
  costAnalytics(timeRange: String = "30d"): CostAnalytics!
}

type Mutation {
  # --- User Management ---
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deactivateUser(id: ID!): Boolean!

  # --- Organizational Structure ---
  createDirectory(input: CreateDirectoryInput!): Directory!
  updateDirectory(id: ID!, input: UpdateDirectoryInput!): Directory!
  moveDirectory(id: ID!, input: MoveAgentOrDirectoryInput!): Directory!
  removeDirectory(id: ID!): Boolean!

  createTag(input: CreateTagInput!): Tag!
  updateTag(id: ID!, input: UpdateTagInput!): Tag!
  removeTag(id: ID!): Boolean!

  # --- Agent Management ---
  createPromptTemplate(input: CreatePromptTemplateInput!): PromptTemplate!
  updatePromptTemplate(
    id: ID!
    input: UpdatePromptTemplateInput!
  ): PromptTemplate!
  removePromptTemplate(id: ID!): Boolean!

  createMcpServer(input: CreateMcpServerInput!): McpServer!
  updateMcpServer(id: ID!, input: UpdateMcpServerInput!): McpServer!
  removeMcpServer(id: ID!): Boolean!
  refreshMcpServer(id: ID!): McpServer!
  testMcpServerConnection(id: ID!): Boolean!

  createAgent(input: CreateAgentInput!): Agent!
  updateAgent(id: ID!, input: UpdateAgentInput!): Agent!
  removeAgent(id: ID!): Boolean!
  moveAgent(id: ID!, input: MoveAgentOrDirectoryInput!): Agent!
  cloneAgent(id: ID!, newName: String!): Agent!

  # --- Execution Control ---
  runAgents(inputs: [RunAgentInput!]!): [Run!]!
  terminateRun(id: ID!): Run!
  pauseRun(id: ID!): Run!
  resumeRun(id: ID!): Run!

  # --- Memory Management ---
  createMemory(key: String!, value: JSON!, agentName: String!): Memory!
  updateMemory(id: ID!, value: JSON!): Memory!
  removeMemory(id: ID!): Boolean!
  expireMemory(id: ID!, expiresAt: DateTime!): Memory!
}

type Subscription {
  # --- Real-time Execution ---
  runUpdated(runId: ID!): Run!
  stepStream(stepId: ID!): StreamChunk!

  # --- System Events ---
  agentCreated: Agent!
  agentUpdated(agentId: ID): Agent!
  mcpServerStatusChanged: McpServer!
  systemAlert: SystemAlert!
}

# =============================================================================
#  ADDITIONAL TYPES
# =============================================================================

type SystemUsageStats {
  totalRuns: Int!
  totalAgents: Int!
  totalUsers: Int!
  totalCost: Float!
  averageRunDuration: Float!
  topAgents: [Agent!]!
  topUsers: [User!]!
}

type CostAnalytics {
  totalCost: Float!
  costByModel: [ModelCostBreakdown!]!
  costByAgent: [AgentCostBreakdown!]!
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
  agent: Agent!
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
```

## 8. Configuration & Deployment

### 8.1 Configuration Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["port", "database", "redis"],
  "properties": {
    "port": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535,
      "default": 4000
    },
    "database": {
      "type": "object",
      "required": ["url"],
      "properties": {
        "url": {
          "type": "string",
          "format": "uri",
          "description": "PostgreSQL connection string"
        },
        "poolSize": {
          "type": "integer",
          "minimum": 1,
          "default": 10
        },
        "ssl": {
          "type": "boolean",
          "default": true
        }
      }
    },
    "redis": {
      "type": "object",
      "required": ["url"],
      "properties": {
        "url": {
          "type": "string",
          "format": "uri"
        },
        "cluster": {
          "type": "boolean",
          "default": false
        }
      }
    },
    "engine": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "enum": ["temporal", "bullmq"]
        },
        "options": {
          "type": "object"
        }
      }
    },
    "opentelemetry": {
      "type": "object",
      "required": ["serviceName"],
      "properties": {
        "serviceName": {
          "type": "string",
          "default": "shaman-server"
        },
        "exporterEndpoint": {
          "type": "string",
          "format": "uri"
        },
        "sampleRate": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 1
        }
      }
    },
    "providers": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z][a-zA-Z0-9_-]*$": {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type": {
              "enum": ["OPENAI", "ANTHROPIC", "GROQ", "OLLAMA"]
            },
            "apiKey": {
              "type": "string",
              "pattern": "^env\\([A-Z_]+\\)$"
            },
            "apiUrl": {
              "type": "string",
              "format": "uri"
            }
          }
        }
      }
    },
    "mcpServers": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z][a-zA-Z0-9_-]*$": {
          "type": "object",
          "required": ["type", "endpoint"],
          "properties": {
            "type": {
              "enum": ["STDIO", "HTTP"]
            },
            "endpoint": {
              "type": "string"
            },
            "apiKey": {
              "type": "string",
              "pattern": "^env\\([A-Z_]+\\)$"
            }
          }
        }
      }
    },
    "security": {
      "type": "object",
      "properties": {
        "jwtSecret": {
          "type": "string",
          "pattern": "^env\\([A-Z_]+\\)$"
        },
        "corsOrigins": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "a2aRateLimit": {
          "type": "object",
          "properties": {
            "requestsPerMinute": {
              "type": "integer",
              "default": 60
            },
            "requestsPerHour": {
              "type": "integer",
              "default": 1000
            }
          }
        }
      }
    }
  }
}
```

### 8.2 Example Production Configuration

```json
{
  "port": 4000,
  "database": {
    "url": "env(DATABASE_URL)",
    "poolSize": 20,
    "ssl": true
  },
  "redis": {
    "url": "env(REDIS_URL)",
    "cluster": true
  },
  "engine": {
    "type": "temporal",
    "options": {
      "address": "temporal.example.com:7233",
      "namespace": "shaman-production",
      "tls": {
        "clientCertPath": "/etc/ssl/certs/temporal-client.crt",
        "clientKeyPath": "/etc/ssl/private/temporal-client.key"
      }
    }
  },
  "opentelemetry": {
    "serviceName": "shaman-server",
    "exporterEndpoint": "https://otel-collector.example.com:4318/v1/traces",
    "sampleRate": 0.1
  },
  "providers": {
    "openai_gpt4": {
      "type": "OPENAI",
      "apiKey": "env(OPENAI_API_KEY)"
    },
    "anthropic_claude": {
      "type": "ANTHROPIC",
      "apiKey": "env(ANTHROPIC_API_KEY)"
    },
    "groq_llama": {
      "type": "GROQ",
      "apiKey": "env(GROQ_API_KEY)"
    }
  },
  "mcpServers": {
    "filesystem": {
      "type": "STDIO",
      "endpoint": "npx @modelcontextprotocol/server-filesystem /var/shaman/workspace"
    },
    "postgres_tools": {
      "type": "HTTP",
      "endpoint": "http://mcp-postgres.internal:3000",
      "apiKey": "env(MCP_POSTGRES_API_KEY)"
    }
  },
  "security": {
    "jwtSecret": "env(JWT_SECRET)",
    "corsOrigins": [
      "https://shaman-ui.example.com",
      "https://dashboard.example.com"
    ],
    "a2aRateLimit": {
      "requestsPerMinute": 120,
      "requestsPerHour": 5000
    }
  }
}
```

### 8.3 Deployment Scenarios

#### 8.3.1 Local Development

- **Engine:** BullMQ with single Redis instance
- **Database:** Local PostgreSQL with Docker
- **Scaling:** Single server and worker process
- **Observability:** Local Jaeger for tracing

#### 8.3.2 Enterprise Production

- **Engine:** Temporal.io cluster with high availability
- **Database:** PostgreSQL with read replicas
- **Scaling:** Multiple server instances behind load balancer
- **Workers:** Auto-scaling worker pools
- **Observability:** Distributed tracing with DataDog/New Relic

#### 8.3.3 Cloud-Native Deployment

- **Orchestration:** Kubernetes with Helm charts
- **Storage:** Cloud-managed PostgreSQL and Redis
- **Networking:** Ingress controllers with TLS termination
- **Monitoring:** Prometheus/Grafana stack
- **Security:** Pod security policies and network policies

### 8.4 Scaling Strategies

#### 8.4.1 Horizontal Scaling

- **Stateless Servers:** Multiple Shaman server instances
- **Worker Scaling:** Dynamic worker pool based on queue depth
- **Database Connections:** Connection pooling with PgBouncer
- **Redis Clustering:** Redis Cluster for stream distribution

#### 8.4.2 Performance Optimization

- **Caching:** Redis caching for agent definitions and tool schemas
- **Database Optimization:** Materialized views for analytics
- **Connection Management:** HTTP/2 for A2A communications
- **Resource Limits:** Memory and CPU limits on workers

#### 8.4.3 High Availability

- **Database:** Primary-replica setup with automatic failover
- **Redis:** Redis Sentinel for high availability
- **Load Balancing:** Health checks and graceful failover
- **Monitoring:** Comprehensive health check endpoints

This specification provides a complete foundation for building Shaman as a comprehensive AI agent coordination platform, with detailed use cases demonstrating real-world applications across various industries and scenarios.