## 6. A2A Integration & Federation

### 6.1 Exposing Git-Based Agents via A2A

#### 6.1.1 A2A Gateway Configuration

```json
{
  "agentExposure": {
    "enabled": true,
    "basePath": "/a2a/v1",
    "allowedAgents": ["support/tier1", "support/billing", "public/demo-agent"],
    "allowedPrefixes": ["public/", "api/"],
    "blockedAgents": ["internal/experimental", "admin/system-tools"],
    "requiresAuthentication": true,
    "defaultSecuritySchemes": {
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      },
      "oauth2": {
        "type": "oauth2", 
        "flows": {
          "clientCredentials": {
            "tokenUrl": "https://auth.company.com/oauth/token",
            "scopes": {
              "agent:execute": "Execute agents",
              "agent:stream": "Stream agent responses"
            }
          }
        }
      }
    },
    "rateLimiting": {
      "requestsPerMinute": 60,
      "requestsPerHour": 1000,
      "requestsPerDay": 10000
    }
  }
}
```

#### 6.1.2 Dynamic AgentCard Generation

```typescript
interface A2AAgentCardGenerator {
  generateAgentCard(): Promise<A2AAgentCard>;
  generateSkillsFromGitAgents(allowedAgents: string[]): Promise<A2ASkill[]>;
}

class A2AAgentCardGeneratorImpl implements A2AAgentCardGenerator {
  async generateAgentCard(): Promise<A2AAgentCard> {
    const allowedAgents = await this.getExposableAgents();
    const skills = await this.generateSkillsFromGitAgents(allowedAgents);
    
    return {
      name: "Company AI Agent Platform",
      description: "Enterprise AI agents for customer support, sales, and operations",
      url: `${this.config.baseUrl}/a2a/v1`,
      version: "1.0.0",
      provider: {
        organization: this.config.organization,
        url: this.config.organizationUrl
      },
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true
      },
      securitySchemes: this.config.agentExposure.defaultSecuritySchemes,
      security: [
        { "apiKey": [] },
        { "oauth2": ["agent:execute"] }
      ],
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["text/plain", "application/json"],
      skills: skills,
      supportsAuthenticatedExtendedCard: true
    };
  }
  
  async generateSkillsFromGitAgents(agentNames: string[]): Promise<A2ASkill[]> {
    const skills: A2ASkill[] = [];
    
    for (const agentName of agentNames) {
      try {
        const resolved = await this.gitAgentResolver.resolveAgent(agentName);
        
        skills.push({
          id: agentName,
          name: resolved.agent.name,
          description: resolved.agent.description,
          tags: resolved.agent.tags,
          examples: resolved.agent.examples,
          inputModes: ["text/plain", "application/json"],
          outputModes: ["text/plain", "application/json"]
        });
      } catch (error) {
        console.warn(`Could not resolve agent for A2A exposure: ${agentName}`, error);
      }
    }
    
    return skills;
  }
}
```

#### 6.1.3 A2A Request Handling

```typescript
interface A2ARequestHandler {
  handleMessageSend(params: A2AMessageSendParams): Promise<A2AResponse>;
  handleMessageStream(params: A2AMessageSendParams): AsyncIterableIterator<A2AStreamEvent>;
  handleTasksGet(params: A2ATaskQueryParams): Promise<A2ATask>;
  handleTasksCancel(params: A2ATaskIdParams): Promise<A2ATask>;
}

class A2ARequestHandlerImpl implements A2ARequestHandler {
  async handleMessageSend(params: A2AMessageSendParams): Promise<A2AResponse> {
    // 1. Validate request and extract agent skill
    const skillId = this.extractSkillFromMessage(params.message);
    const agentName = skillId; // Skills map directly to agent names
    
    // 2. Validate agent is exposed
    await this.validateAgentExposure(agentName);
    
    // 3. Convert A2A message to Shaman execution
    const runInput: RunAgentInput = {
      agentName: agentName,
      input: this.extractTextFromA2AParts(params.message.parts),
      contextScope: 'FULL'
    };
    
    // 4. Execute agent via workflow engine
    const run = await this.workflowEngine.startRun(runInput);
    
    // 5. Handle based on configuration
    if (params.configuration?.blocking) {
      // Wait for completion and return result
      const completion = await this.waitForRunCompletion(run.id);
      return this.convertRunToA2ATask(completion);
    } else {
      // Return task for polling
      return this.convertRunToA2ATask(run);
    }
  }
  
  async *handleMessageStream(params: A2AMessageSendParams): AsyncIterableIterator<A2AStreamEvent> {
    const agentName = this.extractSkillFromMessage(params.message);
    await this.validateAgentExposure(agentName);
    
    const runInput: RunAgentInput = {
      agentName: agentName,
      input: this.extractTextFromA2AParts(params.message.parts),
      contextScope: 'FULL'
    };
    
    const run = await this.workflowEngine.startRun(runInput);
    
    // Stream real-time events
    const subscription = this.subscribeToRunEvents(run.id);
    
    try {
      for await (const event of subscription) {
        const a2aEvent = this.convertShamanEventToA2A(event, run.id);
        if (a2aEvent) {
          yield a2aEvent;
        }
        
        // End stream on terminal state
        if (this.isTerminalState(event.type)) {
          break;
        }
      }
    } finally {
      subscription.unsubscribe();
    }
  }
}
```

### 6.2 Consuming External A2A Agents

#### 6.2.1 External Agent Registration

The GraphQL API for registering external agents is updated to support the On-Behalf-Of (OBO) flow, allowing Shaman to securely propagate the end-user's identity.

```graphql
# ... Types ExternalA2AAgent, ExternalA2ASkill are unchanged ...

type Mutation {
  registerExternalA2AAgent(input: RegisterExternalA2AAgentInput!): ExternalA2AAgent!
  updateExternalA2AAgent(id: ID!, input: UpdateExternalA2AAgentInput!): ExternalA2AAgent!
  # ... other mutations are unchanged ...
}

input RegisterExternalA2AAgentInput {
  name: String!
  description: String
  endpoint: String!
  authConfig: ExternalA2AAuthInput!
  autoDiscover: Boolean = true
  healthCheckInterval: String = "5m"
}

# UPDATED to support On-Behalf-Of flow
input ExternalA2AAuthInput {
  type: String! # "apiKey", "oauth2-client-credentials", "oauth2-obo", "basic"
  
  # For apiKey
  apiKey: String
  
  # For all oauth types
  oauthTokenUrl: String
  
  # For "oauth2-client-credentials" and "oauth2-obo". These are Shaman's own service credentials.
  oauthClientId: String  
  oauthClientSecret: String
  
  # NEW: Specific to "oauth2-obo" flow. Defines the audience and scopes for the delegated token.
  downstreamApiAudience: String
  downstreamApiScopes: [String!]
  
  # For basic
  basicUsername: String
  basicPassword: String
}
```

#### 6.2.2 External Agent Discovery and Health Monitoring

```typescript
interface ExternalA2ADiscoveryService {
  discoverAgent(endpoint: string, authConfig: A2AAuthConfig): Promise<ExternalA2AAgent>;
  refreshAgentCard(agentId: string): Promise<A2AAgentCard>;
  healthCheck(agentId: string): Promise<HealthStatus>;
  scheduleHealthChecks(): void;
}

class ExternalA2ADiscoveryServiceImpl implements ExternalA2ADiscoveryService {
  async discoverAgent(endpoint: string, authConfig: A2AAuthConfig): Promise<ExternalA2AAgent> {
    // 1. Fetch public agent card
    const publicCardUrl = `${endpoint}/../.well-known/agent.json`;
    const publicCard = await this.fetchAgentCard(publicCardUrl);
    
    // 2. Test authentication
    await this.validateAuthentication(endpoint, authConfig, publicCard.security);
    
    // 3. Fetch authenticated extended card if available
    let finalCard = publicCard;
    if (publicCard.supportsAuthenticatedExtendedCard) {
      try {
        const authCardUrl = `${endpoint}/../agent/authenticatedExtendedCard`;
        finalCard = await this.fetchAgentCard(authCardUrl, authConfig);
      } catch (error) {
        console.warn('Could not fetch authenticated extended card:', error);
      }
    }
    
    // 4. Generate agent name mapping
    const agentName = this.generateAgentName(endpoint, finalCard);
    
    // 5. Create external agent record
    return {
      name: agentName,
      description: finalCard.description,
      endpoint: endpoint,
      agentCard: finalCard,
      authConfig: authConfig,
      skills: finalCard.skills,
      isActive: true,
      lastHealthCheck: new Date(),
      healthStatus: 'healthy'
    };
  }
  
  private generateAgentName(endpoint: string, card: A2AAgentCard): string {
    // Generate namespace from domain
    const url = new URL(endpoint);
    const domain = url.hostname.replace(/\./g, '-');
    
    // Use first skill ID or domain
    const skillId = card.skills[0]?.id;
    if (skillId) {
      return `external/${domain}/${skillId}`;
    } else {
      return `external/${domain}/agent`;
    }
  }
  
  async healthCheck(agentId: string): Promise<HealthStatus> {
    const agent = await this.getExternalAgent(agentId);
    
    try {
      // Test basic connectivity
      const testMessage = {
        role: 'user' as const,
        parts: [{ kind: 'text' as const, text: 'Health check ping' }],
        messageId: generateId()
      };
      
      const response = await this.sendA2ARequest(agent, {
        jsonrpc: '2.0',
        id: 'health-check',
        method: 'message/send',
        params: {
          message: testMessage,
          configuration: {
            acceptedOutputModes: ['text/plain'],
            blocking: true
          }
        }
      });
      
      return {
        status: 'healthy',
        responseTime: response.responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }
}
```

#### 6.2.3 External A2A Call Integration in Git Agents

Git-based agents can call external A2A agents seamlessly:

```markdown
---
name: "ComprehensiveAnalyzer"
description: "Performs analysis using both internal and external specialized agents"
allowedAgents: ["internal/data-processor", "external/legal-expert", "external/financial-analyst"]
---

You can delegate tasks to both internal and external agents:

## Internal Agents
- **internal/data-processor**: For data cleaning and analysis

## External Agents  
- **external/legal-expert**: External legal analysis service
- **external/financial-analyst**: Partner financial modeling service

When calling external agents, they may take longer to respond and have different capabilities.

Your task: {{prompt}}
```

**Execution Flow:**
```
ComprehensiveAnalyzer receives: "Analyze this M&A deal for legal and financial risks"

1. Calls internal/data-processor:
   → Processes deal documents and extracts key data

2. Calls external/legal-expert via A2A:
   → POST https://legal-ai.partner.com/a2a/v1
   → Receives detailed legal risk assessment

3. Calls external/financial-analyst via A2A:
   → POST https://finance-ai.vendor.com/a2a/v1  
   → Receives financial model and projections

4. Synthesizes all results and completes:
   → Combined analysis with internal processing + external expertise
```

### 6.3 Security and Governance

#### 6.3.1 Exposure Security Controls

```typescript
interface AgentExposureValidator {
  validateAgentExposure(agentName: string, clientAuth: AuthContext): Promise<ExposureValidation>;
  validateRateLimit(clientId: string, agentName: string): Promise<RateLimitStatus>;
  auditA2ARequest(request: A2ARequest, clientAuth: AuthContext): Promise<void>;
}

class AgentExposureValidatorImpl implements AgentExposureValidator {
  async validateAgentExposure(agentName: string, clientAuth: AuthContext): Promise<ExposureValidation> {
    const config = this.config.agentExposure;
    
    // 1. Check if exposure is enabled
    if (!config.enabled) {
      return { allowed: false, reason: 'Agent exposure is disabled' };
    }
    
    // 2. Check blocked agents
    if (config.blockedAgents.includes(agentName)) {
      return { allowed: false, reason: `Agent ${agentName} is explicitly blocked` };
    }
    
    // 3. Check allowed agents list
    if (config.allowedAgents.length > 0 && !config.allowedAgents.includes(agentName)) {
      return { allowed: false, reason: `Agent ${agentName} is not in allowed list` };
    }
    
    // 4. Check allowed prefixes  
    if (config.allowedPrefixes.length > 0) {
      const hasAllowedPrefix = config.allowedPrefixes.some(prefix => 
        agentName.startsWith(prefix)
      );
      
      if (!hasAllowedPrefix) {
        return { allowed: false, reason: `Agent ${agentName} does not match any allowed prefix` };
      }
    }
    
    // 5. Validate authentication if required
    if (config.requiresAuthentication && !clientAuth.isAuthenticated) {
      return { allowed: false, reason: 'Authentication required for agent access' };
    }
    
    // 6. Check client-specific permissions
    if (clientAuth.isAuthenticated) {
      const hasPermission = await this.checkClientAgentPermissions(
        clientAuth.clientId, 
        agentName
      );
      
      if (!hasPermission) {
        return { allowed: false, reason: `Client does not have permission to access ${agentName}` };
      }
    }
    
    return { allowed: true };
  }
}
```

#### 6.3.2 External Agent Security

```typescript
interface ExternalAgentSecurityManager {
  validateExternalCall(agentName: string, callerContext: AgentContext): Promise<SecurityValidation>;
  rotateExternalCredentials(agentId: string): Promise<void>;
  auditExternalCall(call: ExternalAgentCall): Promise<void>;
}

class ExternalAgentSecurityManagerImpl implements ExternalAgentSecurityManager {
  async validateExternalCall(agentName: string, callerContext: AgentContext): Promise<SecurityValidation> {
    const externalAgent = await this.externalA2ARegistry.findAgent(agentName);
    if (!externalAgent) {
      return { allowed: false, reason: 'External agent not registered' };
    }
    
    // 1. Check if external calls are enabled
    if (!this.config.externalCalls.enabled) {
      return { allowed: false, reason: 'External agent calls are disabled' };
    }
    
    // 2. Validate domain whitelist
    const agentDomain = new URL(externalAgent.endpoint).hostname;
    if (!this.config.externalCalls.allowedDomains.includes(agentDomain)) {
      return { allowed: false, reason: `Domain ${agentDomain} is not in allowed list` };
    }
    
    // 3. Check rate limits
    const rateLimitStatus = await this.checkExternalCallRateLimit(
      callerContext.agentName, 
      agentName
    );
    
    if (!rateLimitStatus.allowed) {
      return { 
        allowed: false, 
        reason: `Rate limit exceeded: ${rateLimitStatus.limitType}` 
      };
    }
    
    // 4. Validate agent-specific permissions
    const hasPermission = await this.checkAgentExternalPermissions(
      callerContext.agentName,
      agentName
    );
    
    if (!hasPermission) {
      return { 
        allowed: false, 
        reason: `Agent ${callerContext.agentName} does not have permission to call ${agentName}` 
      };
    }
    
    return { allowed: true };
  }
}
```