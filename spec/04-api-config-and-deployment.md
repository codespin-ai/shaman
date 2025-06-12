[← Previous: System Architecture](./03-system-architecture.md) | [🏠 Home](./README.md) | [Next: GraphQL API Specification →](./05-graphql-api-spec.md)

---

# API Configuration and Deployment

## A2A Gateway Integration

The A2A Gateway enables bidirectional agent federation, allowing internal git-based agents to be exposed externally while consuming external A2A-compliant agents.

### Exposing Internal Agents

Internal agents can be exposed via the A2A protocol through configuration-driven policies:

```typescript
interface A2AExposureConfig {
  enabled: boolean;
  basePath: string;
  allowedAgents: string[];
  allowedPrefixes: string[];
  blockedAgents: string[];
  requiresAuthentication: boolean;
  defaultSecuritySchemes: SecuritySchemeMap;
  rateLimiting: RateLimitConfig;
  corsPolicy: CorsConfig;
}

interface SecuritySchemeMap {
  [schemeName: string]: SecurityScheme;
}

interface SecurityScheme {
  type: "apiKey" | "oauth2" | "basic" | "bearer";
  description?: string;
  in?: "header" | "query" | "cookie";
  name?: string;
  flows?: OAuth2Flows;
  bearerFormat?: string;
}

interface OAuth2Flows {
  authorizationCode?: OAuth2Flow;
  implicit?: OAuth2Flow;
  password?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
}

interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: { [scope: string]: string };
}
```

### Agent Card Generation

The system automatically generates A2A AgentCards from git-based agent definitions:

```typescript
class A2AAgentCardGenerator {
  async generateAgentCard(): Promise<A2AAgentCard> {
    const allowedAgents = await this.getExposableAgents();
    const skills = await this.generateSkillsFromGitAgents(allowedAgents);

    return {
      name: this.config.organization.name,
      description: this.config.organization.description,
      url: `${this.config.baseUrl}${this.config.agentExposure.basePath}`,
      version: "1.0.0",
      provider: {
        organization: this.config.organization.name,
        url: this.config.organization.url,
        contact: this.config.organization.contact,
      },
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
        multiModal: false,
      },
      securitySchemes: this.config.agentExposure.defaultSecuritySchemes,
      security: this.generateSecurityRequirements(),
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["text/plain", "application/json"],
      skills: skills,
      supportsAuthenticatedExtendedCard: true,
    };
  }

  private async generateSkillsFromGitAgents(
    agentNames: string[]
  ): Promise<A2ASkill[]> {
    const skills: A2ASkill[] = [];

    for (const agentName of agentNames) {
      try {
        const resolved = await this.gitAgentResolver.resolveAgent(agentName);
        const agent = resolved.agent as GitAgent;

        skills.push({
          id: agentName,
          name: agent.name,
          description: agent.description,
          tags: agent.tags,
          examples: agent.examples,
          inputModes: ["text/plain", "application/json"],
          outputModes: ["text/plain", "application/json"],
          parameters: this.generateParametersFromAgent(agent),
          metadata: {
            version: agent.version,
            gitRepository: resolved.repository,
            gitCommit: resolved.commit,
            lastModified: agent.lastModified,
          },
        });
      } catch (error) {
        console.warn(
          `Could not resolve agent for A2A exposure: ${agentName}`,
          error
        );
      }
    }

    return skills;
  }

  private getExposableAgents(): Promise<string[]> {
    const config = this.config.agentExposure;

    // Start with explicitly allowed agents
    let exposableAgents = [...config.allowedAgents];

    // Add agents matching allowed prefixes
    if (config.allowedPrefixes.length > 0) {
      const allAgents = await this.gitAgentDiscovery.listAgents();
      for (const agent of allAgents) {
        const hasAllowedPrefix = config.allowedPrefixes.some((prefix) =>
          agent.name.startsWith(prefix)
        );
        if (hasAllowedPrefix && !exposableAgents.includes(agent.name)) {
          exposableAgents.push(agent.name);
        }
      }
    }

    // Remove blocked agents
    exposableAgents = exposableAgents.filter(
      (agentName) => !config.blockedAgents.includes(agentName)
    );

    return exposableAgents;
  }
}
```

### A2A Request Processing

The gateway translates A2A requests into internal execution:

```typescript
class A2ARequestProcessor {
  async handleMessageSend(
    params: A2AMessageSendParams,
    clientContext: ClientContext
  ): Promise<A2AResponse> {
    // 1. Validate request and extract agent skill
    const skillId = this.extractSkillFromMessage(params.message);
    const agentName = skillId;

    // 2. Validate agent exposure and client permissions
    await this.validateAgentExposure(agentName, clientContext);

    // 3. Convert A2A message to Shaman execution
    const runInput: RunAgentInput = {
      agentName: agentName,
      input: this.extractTextFromA2AParts(params.message.parts),
      contextScope: "FULL",
      maxCallDepth: this.config.agentExecution.maxCallDepth,
    };

    // 4. Execute agent via workflow engine
    const run = await this.workflowEngine.startRun(runInput);

    // 5. Handle based on configuration
    if (params.configuration?.blocking) {
      const completion = await this.waitForRunCompletion(
        run.id,
        params.configuration.timeoutMs
      );
      return this.convertRunToA2AMessage(completion);
    } else {
      return this.convertRunToA2ATask(run);
    }
  }

  async *handleMessageStream(
    params: A2AMessageSendParams,
    clientContext: ClientContext
  ): AsyncIterableIterator<A2AStreamEvent> {
    const agentName = this.extractSkillFromMessage(params.message);
    await this.validateAgentExposure(agentName, clientContext);

    const runInput: RunAgentInput = {
      agentName: agentName,
      input: this.extractTextFromA2AParts(params.message.parts),
      contextScope: "FULL",
    };

    const run = await this.workflowEngine.startRun(runInput);
    const subscription = this.subscribeToRunEvents(run.id);

    try {
      for await (const event of subscription) {
        const a2aEvent = this.convertShamanEventToA2A(event, run.id);
        if (a2aEvent) {
          yield a2aEvent;
        }

        if (this.isTerminalState(event.type)) {
          break;
        }
      }
    } finally {
      subscription.unsubscribe();
    }
  }

  private convertShamanEventToA2A(
    event: StreamChunk,
    taskId: string
  ): A2AStreamEvent | null {
    switch (event.type) {
      case "token":
        return {
          kind: "message-delta",
          taskId: taskId,
          deltaIndex: event.sequenceNumber,
          delta: {
            role: "assistant",
            parts: [{ kind: "text", text: event.payload.content }],
          },
        };

      case "completion":
        return {
          kind: "task-result",
          taskId: taskId,
          result: {
            artifacts: [
              {
                parts: [
                  { kind: "text", text: event.payload.completion.result },
                ],
              },
            ],
            isComplete: true,
          },
        };

      case "input_request":
        return {
          kind: "input-request",
          taskId: taskId,
          inputRequest: {
            prompt: event.payload.inputRequest.prompt,
            inputType: event.payload.inputRequest.inputType,
            choices: event.payload.inputRequest.choices,
          },
        };

      default:
        return null;
    }
  }
}
```

## External Agent Integration

External A2A agents are registered and managed through the API:

### Registration and Discovery

```typescript
class ExternalAgentManager {
  async registerExternalAgent(
    config: ExternalAgentConfig
  ): Promise<ExternalAgent> {
    // 1. Validate endpoint and connectivity
    await this.validateEndpoint(config.endpoint);

    // 2. Fetch and validate agent card
    const agentCard = await this.fetchAgentCard(
      config.endpoint,
      config.authConfig
    );

    // 3. Test authentication
    await this.testAuthentication(
      config.endpoint,
      config.authConfig,
      agentCard.security
    );

    // 4. Generate internal agent names
    const agentMappings = this.generateAgentMappings(
      config.endpoint,
      agentCard
    );

    // 5. Create external agent record
    const externalAgent: ExternalAgent = {
      id: generateId(),
      name: config.name,
      description: config.description || agentCard.description,
      endpoint: config.endpoint,
      agentCard: agentCard,
      authConfig: config.authConfig,
      isActive: true,
      lastHealthCheck: new Date(),
      healthStatus: "healthy",
      skills: agentCard.skills,
      agentMappings: agentMappings,
      createdAt: new Date(),
      createdBy: config.createdBy,
    };

    // 6. Schedule health checks
    await this.scheduleHealthCheck(
      externalAgent.id,
      config.healthCheckInterval
    );

    return externalAgent;
  }

  private generateAgentMappings(
    endpoint: string,
    card: A2AAgentCard
  ): AgentMapping[] {
    const url = new URL(endpoint);
    const domain = url.hostname.replace(/\./g, "-");

    return card.skills.map((skill) => ({
      externalSkillId: skill.id,
      internalAgentName: `external/${domain}/${skill.id}`,
      skillName: skill.name,
      description: skill.description,
    }));
  }

  async refreshAgentCard(agentId: string): Promise<ExternalAgent> {
    const agent = await this.getExternalAgent(agentId);

    try {
      const updatedCard = await this.fetchAgentCard(
        agent.endpoint,
        agent.authConfig
      );
      const updatedMappings = this.generateAgentMappings(
        agent.endpoint,
        updatedCard
      );

      agent.agentCard = updatedCard;
      agent.skills = updatedCard.skills;
      agent.agentMappings = updatedMappings;
      agent.lastHealthCheck = new Date();
      agent.healthStatus = "healthy";

      await this.saveExternalAgent(agent);
      return agent;
    } catch (error) {
      agent.healthStatus = "unhealthy";
      agent.lastHealthCheck = new Date();
      await this.saveExternalAgent(agent);
      throw error;
    }
  }
}

interface ExternalAgentConfig {
  name: string;
  description?: string;
  endpoint: string;
  authConfig: A2AAuthConfig;
  autoDiscover: boolean;
  healthCheckInterval: string;
  createdBy: string;
}

interface AgentMapping {
  externalSkillId: string;
  internalAgentName: string;
  skillName: string;
  description: string;
}
```

### Health Monitoring

```typescript
class ExternalAgentHealthMonitor {
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  async scheduleHealthCheck(agentId: string, interval: string): Promise<void> {
    const intervalMs = this.parseInterval(interval);

    const timer = setInterval(async () => {
      await this.performHealthCheck(agentId);
    }, intervalMs);

    this.healthCheckIntervals.set(agentId, timer);
  }

  async performHealthCheck(agentId: string): Promise<HealthCheckResult> {
    const agent = await this.getExternalAgent(agentId);
    const startTime = Date.now();

    try {
      const testMessage: A2AMessage = {
        role: "user",
        parts: [{ kind: "text", text: "Health check ping" }],
        messageId: generateId(),
      };

      const response = await this.sendA2ARequest(agent, {
        jsonrpc: "2.0",
        id: "health-check",
        method: "message/send",
        params: {
          message: testMessage,
          configuration: {
            acceptedOutputModes: ["text/plain"],
            blocking: true,
            timeoutMs: 10000,
          },
        },
      });

      const responseTime = Date.now() - startTime;

      const result: HealthCheckResult = {
        agentId: agentId,
        status: "healthy",
        responseTime: responseTime,
        timestamp: new Date(),
        details: {
          endpoint: agent.endpoint,
          responseReceived: true,
          errorCount: 0,
        },
      };

      await this.updateAgentHealth(agentId, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        agentId: agentId,
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error.message,
        details: {
          endpoint: agent.endpoint,
          responseReceived: false,
          errorCount: await this.incrementErrorCount(agentId),
        },
      };

      await this.updateAgentHealth(agentId, result);
      return result;
    }
  }

  private async updateAgentHealth(
    agentId: string,
    result: HealthCheckResult
  ): Promise<void> {
    const agent = await this.getExternalAgent(agentId);

    agent.healthStatus = result.status;
    agent.lastHealthCheck = result.timestamp;

    if (result.status === "healthy") {
      agent.responseTimeP95 = this.updateP95ResponseTime(
        agent.responseTimeP95,
        result.responseTime
      );
      agent.errorRate = this.calculateErrorRate(agentId, false);
    } else {
      agent.errorRate = this.calculateErrorRate(agentId, true);
    }

    await this.saveExternalAgent(agent);

    // Emit health change event
    if (result.status !== agent.healthStatus) {
      await this.eventBus.publish("external-agent-health-changed", {
        agentId: agentId,
        previousStatus: agent.healthStatus,
        newStatus: result.status,
        timestamp: result.timestamp,
      });
    }
  }
}

interface HealthCheckResult {
  agentId: string;
  status: "healthy" | "unhealthy";
  responseTime: number;
  timestamp: Date;
  error?: string;
  details: {
    endpoint: string;
    responseReceived: boolean;
    errorCount: number;
  };
}
```

## Security Configuration

### Authentication and Authorization

```typescript
interface SecurityConfig {
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  rateLimiting: RateLimitingConfig;
  cors: CorsConfig;
  encryption: EncryptionConfig;
}

interface AuthenticationConfig {
  jwt: {
    secret: string;
    algorithm: "HS256" | "RS256";
    expiresIn: string;
    issuer: string;
    audience: string;
  };
  apiKeys: {
    enabled: boolean;
    headerName: string;
    queryParam: string;
  };
  oauth2: {
    providers: OAuth2Provider[];
  };
}

interface OAuth2Provider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

interface AuthorizationConfig {
  rbac: {
    enabled: boolean;
    roles: Role[];
    permissions: Permission[];
  };
  agentAccess: {
    defaultPolicy: "allow" | "deny";
    rules: AgentAccessRule[];
  };
  externalAgentAccess: {
    defaultPolicy: "allow" | "deny";
    domainWhitelist: string[];
    rules: ExternalAgentAccessRule[];
  };
}

interface Role {
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
}

interface Permission {
  name: string;
  description: string;
  resource: string;
  actions: string[];
}

interface AgentAccessRule {
  principal: string; // user, role, or client
  agentPattern: string; // glob pattern
  permission: "allow" | "deny";
  conditions?: AccessCondition[];
}

interface ExternalAgentAccessRule {
  callerAgent: string;
  targetAgentPattern: string;
  permission: "allow" | "deny";
  rateLimits?: RateLimitRule[];
}
```

### Security Policy Enforcement

```typescript
class SecurityPolicyEngine {
  async validateAgentAccess(
    context: SecurityContext,
    agentName: string
  ): Promise<AccessDecision> {
    // 1. Check RBAC permissions
    const rbacDecision = await this.checkRBACPermissions(
      context.user,
      "agent:execute",
      agentName
    );
    if (rbacDecision.denied) {
      return rbacDecision;
    }

    // 2. Check agent-specific access rules
    const agentAccessDecision = await this.checkAgentAccessRules(
      context,
      agentName
    );
    if (agentAccessDecision.denied) {
      return agentAccessDecision;
    }

    // 3. Check rate limits
    const rateLimitDecision = await this.checkRateLimits(context, agentName);
    if (rateLimitDecision.denied) {
      return rateLimitDecision;
    }

    return { allowed: true };
  }

  async validateExternalAgentCall(
    callerAgent: string,
    targetAgent: string
  ): Promise<AccessDecision> {
    const rules = this.config.authorization.externalAgentAccess.rules;

    for (const rule of rules) {
      if (
        this.matchesPattern(callerAgent, rule.callerAgent) &&
        this.matchesPattern(targetAgent, rule.targetAgentPattern)
      ) {
        if (rule.permission === "deny") {
          return {
            allowed: false,
            reason: `External agent call denied by policy rule`,
            rule: rule,
          };
        }

        // Check rate limits for this rule
        if (rule.rateLimits) {
          const rateLimitResult = await this.checkExternalCallRateLimits(
            callerAgent,
            targetAgent,
            rule.rateLimits
          );

          if (!rateLimitResult.allowed) {
            return rateLimitResult;
          }
        }

        return { allowed: true, rule: rule };
      }
    }

    // No explicit rule found, use default policy
    const defaultPolicy =
      this.config.authorization.externalAgentAccess.defaultPolicy;
    return {
      allowed: defaultPolicy === "allow",
      reason:
        defaultPolicy === "deny"
          ? "Default policy denies external agent calls"
          : undefined,
    };
  }

  private async checkRBACPermissions(
    user: User,
    action: string,
    resource: string
  ): Promise<AccessDecision> {
    if (!this.config.authorization.rbac.enabled) {
      return { allowed: true };
    }

    const userRoles = await this.getUserRoles(user.id);
    const allPermissions = await this.expandRolePermissions(userRoles);

    const hasPermission = allPermissions.some((permission) =>
      this.matchesPermission(permission, action, resource)
    );

    return {
      allowed: hasPermission,
      reason: hasPermission
        ? undefined
        : `User lacks permission ${action} on ${resource}`,
    };
  }
}

interface SecurityContext {
  user?: User;
  client?: ClientCredentials;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp: Date;
}

interface AccessDecision {
  allowed: boolean;
  reason?: string;
  rule?: any;
  metadata?: any;
}
```

## Complete Configuration Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["port", "database", "redis", "agentRepositories"],
  "properties": {
    "port": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535,
      "default": 4000,
      "description": "HTTP server port"
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
          "maximum": 100,
          "default": 10,
          "description": "Database connection pool size"
        },
        "ssl": {
          "type": "boolean",
          "default": true,
          "description": "Enable SSL for database connections"
        },
        "timeout": {
          "type": "integer",
          "default": 30000,
          "description": "Query timeout in milliseconds"
        }
      }
    },
    "redis": {
      "type": "object",
      "required": ["url"],
      "properties": {
        "url": {
          "type": "string",
          "format": "uri",
          "description": "Redis connection string"
        },
        "cluster": {
          "type": "boolean",
          "default": false,
          "description": "Whether Redis is running in cluster mode"
        },
        "keyPrefix": {
          "type": "string",
          "default": "shaman:",
          "description": "Key prefix for Redis keys"
        },
        "ttl": {
          "type": "integer",
          "default": 3600,
          "description": "Default TTL for cached data in seconds"
        }
      }
    },
    "engine": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "enum": ["temporal", "bullmq"],
          "description": "Workflow engine type"
        },
        "temporal": {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "description": "Temporal server address"
            },
            "namespace": {
              "type": "string",
              "default": "default",
              "description": "Temporal namespace"
            },
            "tls": {
              "type": "object",
              "properties": {
                "enabled": { "type": "boolean", "default": false },
                "clientCertPath": { "type": "string" },
                "clientKeyPath": { "type": "string" },
                "serverCaPath": { "type": "string" }
              }
            }
          }
        },
        "bullmq": {
          "type": "object",
          "properties": {
            "queueName": {
              "type": "string",
              "default": "shaman-jobs"
            },
            "concurrency": {
              "type": "integer",
              "default": 10,
              "description": "Number of concurrent job processors"
            },
            "retryAttempts": {
              "type": "integer",
              "default": 3
            }
          }
        }
      }
    },
    "agentRepositories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "gitUrl", "authType"],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z][a-zA-Z0-9_-]*$",
            "description": "Unique repository name"
          },
          "gitUrl": {
            "type": "string",
            "format": "uri",
            "description": "Git repository URL"
          },
          "branch": {
            "type": "string",
            "default": "main",
            "description": "Git branch to track"
          },
          "isRoot": {
            "type": "boolean",
            "default": false,
            "description": "Whether agents in this repo are unnamespaced"
          },
          "syncInterval": {
            "type": "string",
            "pattern": "^\\d+[smhd]$",
            "default": "5m",
            "description": "How often to sync repository"
          },
          "authType": {
            "enum": ["ssh-key", "token", "none"]
          },
          "sshKeyPath": {
            "type": "string",
            "description": "Path to SSH private key file"
          },
          "authToken": {
            "type": "string",
            "pattern": "^env\\([A-Z_]+\\)$",
            "description": "GitHub/GitLab access token"
          },
          "webhookSecret": {
            "type": "string",
            "pattern": "^env\\([A-Z_]+\\)$",
            "description": "Webhook secret for push notifications"
          },
          "readOnly": {
            "type": "boolean",
            "default": false,
            "description": "Whether repository is read-only"
          },
          "isActive": {
            "type": "boolean",
            "default": true,
            "description": "Whether repository is active"
          }
        }
      }
    },
    "agentExecution": {
      "type": "object",
      "properties": {
        "completionRequired": {
          "type": "boolean",
          "default": true,
          "description": "Whether agents must explicitly signal completion"
        },
        "maxExecutionTime": {
          "type": "string",
          "pattern": "^\\d+[smhd]$",
          "default": "30m",
          "description": "Maximum execution time before timeout"
        },
        "inputRequestTimeout": {
          "type": "string",
          "pattern": "^\\d+[smhd]$",
          "default": "24h",
          "description": "How long to wait for user input before timeout"
        },
        "maxCallDepth": {
          "type": "integer",
          "minimum": 1,
          "maximum": 50,
          "default": 10,
          "description": "Maximum depth for agent-to-agent calls"
        },
        "agentCallTimeout": {
          "type": "string",
          "pattern": "^\\d+[smhd]$",
          "default": "10m",
          "description": "Timeout for individual agent calls"
        },
        "circularCallPrevention": {
          "type": "boolean",
          "default": true,
          "description": "Prevent agents from calling themselves or creating cycles"
        }
      }
    },
    "agentExposure": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": false,
          "description": "Whether to expose agents via A2A protocol"
        },
        "basePath": {
          "type": "string",
          "default": "/a2a/v1",
          "description": "Base path for A2A endpoints"
        },
        "allowedAgents": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Specific agents that can be exposed"
        },
        "allowedPrefixes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Agent path prefixes that can be exposed"
        },
        "blockedAgents": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Agents that are explicitly blocked from exposure"
        },
        "requiresAuthentication": {
          "type": "boolean",
          "default": true,
          "description": "Whether A2A access requires authentication"
        },
        "defaultSecuritySchemes": {
          "type": "object",
          "description": "Default security schemes for A2A access"
        },
        "rateLimiting": {
          "type": "object",
          "properties": {
            "requestsPerMinute": { "type": "integer", "default": 60 },
            "requestsPerHour": { "type": "integer", "default": 1000 },
            "requestsPerDay": { "type": "integer", "default": 10000 },
            "burstSize": { "type": "integer", "default": 10 }
          }
        },
        "corsPolicy": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "origins": {
              "type": "array",
              "items": { "type": "string" },
              "default": ["*"]
            },
            "methods": {
              "type": "array",
              "items": { "type": "string" },
              "default": ["GET", "POST", "OPTIONS"]
            },
            "headers": {
              "type": "array",
              "items": { "type": "string" },
              "default": ["Content-Type", "Authorization"]
            }
          }
        }
      }
    },
    "externalAgents": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Whether to allow calls to external A2A agents"
        },
        "allowedDomains": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Domains allowed for external agent calls"
        },
        "defaultTimeout": {
          "type": "string",
          "pattern": "^\\d+[smhd]$",
          "default": "30s",
          "description": "Default timeout for external agent calls"
        },
        "rateLimiting": {
          "type": "object",
          "properties": {
            "callsPerMinute": { "type": "integer", "default": 30 },
            "callsPerHour": { "type": "integer", "default": 500 },
            "circuitBreaker": {
              "type": "object",
              "properties": {
                "enabled": { "type": "boolean", "default": true },
                "failureThreshold": { "type": "integer", "default": 5 },
                "recoveryTimeout": { "type": "string", "default": "60s" }
              }
            }
          }
        },
        "healthChecks": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "interval": { "type": "string", "default": "5m" },
            "timeout": { "type": "string", "default": "10s" },
            "retries": { "type": "integer", "default": 3 }
          }
        }
      }
    },
    "security": {
      "type": "object",
      "properties": {
        "jwtSecret": {
          "type": "string",
          "pattern": "^env\\([A-Z_]+\\)$",
          "description": "JWT signing secret"
        },
        "jwtExpiresIn": {
          "type": "string",
          "default": "24h",
          "description": "JWT token expiration time"
        },
        "corsOrigins": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Allowed CORS origins"
        },
        "gitWebhookSecret": {
          "type": "string",
          "pattern": "^env\\([A-Z_]+\\)$",
          "description": "Secret for validating git webhook signatures"
        },
        "encryptionKey": {
          "type": "string",
          "pattern": "^env\\([A-Z_]+\\)$",
          "description": "Key for encrypting sensitive data"
        },
        "rateLimiting": {
          "type": "object",
          "properties": {
            "windowMs": { "type": "integer", "default": 900000 },
            "maxRequests": { "type": "integer", "default": 100 },
            "skipSuccessfulRequests": { "type": "boolean", "default": false }
          }
        }
      }
    },
    "observability": {
      "type": "object",
      "properties": {
        "opentelemetry": {
          "type": "object",
          "properties": {
            "serviceName": { "type": "string", "default": "shaman-server" },
            "exporterEndpoint": { "type": "string", "format": "uri" },
            "sampleRate": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "default": 1
            },
            "headers": { "type": "object" }
          }
        },
        "logging": {
          "type": "object",
          "properties": {
            "level": {
              "enum": ["error", "warn", "info", "debug"],
              "default": "info"
            },
            "format": {
              "enum": ["json", "pretty"],
              "default": "json"
            },
            "destination": {
              "enum": ["stdout", "file", "syslog"],
              "default": "stdout"
            }
          }
        },
        "metrics": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "endpoint": { "type": "string", "default": "/metrics" },
            "collectDefaultMetrics": { "type": "boolean", "default": true }
          }
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
              "enum": ["OPENAI", "ANTHROPIC", "GROQ", "OLLAMA", "AZURE_OPENAI"]
            },
            "apiKey": {
              "type": "string",
              "pattern": "^env\\([A-Z_]+\\)$"
            },
            "apiUrl": {
              "type": "string",
              "format": "uri"
            },
            "defaultModel": {
              "type": "string"
            },
            "timeout": {
              "type": "integer",
              "default": 60000
            },
            "maxRetries": {
              "type": "integer",
              "default": 3
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
            },
            "timeout": {
              "type": "integer",
              "default": 30000
            },
            "retries": {
              "type": "integer",
              "default": 3
            }
          }
        }
      }
    }
  }
}
```

## Production Deployment Example

### Enterprise Production Configuration

```json
{
  "port": 4000,
  "database": {
    "url": "env(DATABASE_URL)",
    "poolSize": 50,
    "ssl": true,
    "timeout": 60000
  },
  "redis": {
    "url": "env(REDIS_CLUSTER_URL)",
    "cluster": true,
    "keyPrefix": "shaman:prod:",
    "ttl": 7200
  },
  "engine": {
    "type": "temporal",
    "temporal": {
      "address": "temporal.internal.company.com:7233",
      "namespace": "shaman-production",
      "tls": {
        "enabled": true,
        "clientCertPath": "/etc/ssl/certs/temporal-client.crt",
        "clientKeyPath": "/etc/ssl/private/temporal-client.key",
        "serverCaPath": "/etc/ssl/certs/temporal-ca.crt"
      }
    }
  },
  "agentRepositories": [
    {
      "name": "main-agents",
      "gitUrl": "git@github.com:company/main-agents.git",
      "branch": "production",
      "isRoot": true,
      "syncInterval": "3m",
      "authType": "ssh-key",
      "sshKeyPath": "/secrets/main-agents-deploy-key",
      "webhookSecret": "env(MAIN_AGENTS_WEBHOOK_SECRET)"
    },
    {
      "name": "partner-legal",
      "gitUrl": "git@github.com:legal-partner/shared-agents.git",
      "branch": "stable",
      "isRoot": false,
      "syncInterval": "15m",
      "authType": "ssh-key",
      "sshKeyPath": "/secrets/partner-legal-key",
      "readOnly": true
    }
  ],
  "agentExecution": {
    "completionRequired": true,
    "maxExecutionTime": "45m",
    "inputRequestTimeout": "48h",
    "maxCallDepth": 15,
    "agentCallTimeout": "15m",
    "circularCallPrevention": true
  },
  "agentExposure": {
    "enabled": true,
    "basePath": "/a2a/v1",
    "allowedPrefixes": ["public/", "api/", "support/tier1"],
    "blockedAgents": ["internal/admin", "experimental/"],
    "requiresAuthentication": true,
    "defaultSecuritySchemes": {
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
      },
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      }
    },
    "rateLimiting": {
      "requestsPerMinute": 200,
      "requestsPerHour": 10000,
      "requestsPerDay": 100000,
      "burstSize": 50
    },
    "corsPolicy": {
      "enabled": true,
      "origins": ["https://partner1.com", "https://partner2.com"],
      "methods": ["POST", "GET", "OPTIONS"],
      "headers": ["Content-Type", "Authorization", "X-API-Key"]
    }
  },
  "externalAgents": {
    "enabled": true,
    "allowedDomains": [
      "legal-ai.partner.com",
      "finance-ai.vendor.com",
      "security-ai.thirdparty.com"
    ],
    "defaultTimeout": "60s",
    "rateLimiting": {
      "callsPerMinute": 100,
      "callsPerHour": 2000,
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 10,
        "recoveryTimeout": "300s"
      }
    },
    "healthChecks": {
      "enabled": true,
      "interval": "2m",
      "timeout": "15s",
      "retries": 5
    }
  },
  "security": {
    "jwtSecret": "env(JWT_SECRET)",
    "jwtExpiresIn": "12h",
    "corsOrigins": [
      "https://shaman-ui.company.com",
      "https://dashboard.company.com"
    ],
    "gitWebhookSecret": "env(GIT_WEBHOOK_SECRET)",
    "encryptionKey": "env(ENCRYPTION_KEY)",
    "rateLimiting": {
      "windowMs": 900000,
      "maxRequests": 1000,
      "skipSuccessfulRequests": true
    }
  },
  "observability": {
    "opentelemetry": {
      "serviceName": "shaman-server-prod",
      "exporterEndpoint": "https://otel-collector.company.com:4318/v1/traces",
      "sampleRate": 0.1,
      "headers": {
        "Authorization": "Bearer env(OTEL_TOKEN)"
      }
    },
    "logging": {
      "level": "info",
      "format": "json",
      "destination": "stdout"
    },
    "metrics": {
      "enabled": true,
      "endpoint": "/metrics",
      "collectDefaultMetrics": true
    }
  },
  "providers": {
    "openai_gpt4": {
      "type": "OPENAI",
      "apiKey": "env(OPENAI_API_KEY)",
      "defaultModel": "gpt-4-turbo",
      "timeout": 120000,
      "maxRetries": 5
    },
    "anthropic_claude": {
      "type": "ANTHROPIC",
      "apiKey": "env(ANTHROPIC_API_KEY)",
      "defaultModel": "claude-3-sonnet-20240229",
      "timeout": 120000,
      "maxRetries": 5
    },
    "azure_openai": {
      "type": "AZURE_OPENAI",
      "apiKey": "env(AZURE_OPENAI_API_KEY)",
      "apiUrl": "https://company-openai.openai.azure.com/",
      "defaultModel": "gpt-4-turbo",
      "timeout": 120000
    }
  },
  "mcpServers": {
    "github": {
      "type": "HTTP",
      "endpoint": "https://mcp-github.internal.company.com:3000",
      "apiKey": "env(MCP_GITHUB_API_KEY)",
      "timeout": 45000,
      "retries": 5
    },
    "crm-tools": {
      "type": "HTTP",
      "endpoint": "https://mcp-crm.internal.company.com:3000",
      "apiKey": "env(MCP_CRM_API_KEY)",
      "timeout": 30000,
      "retries": 3
    },
    "legal-tools": {
      "type": "HTTP",
      "endpoint": "https://mcp-legal.partner.com:3000",
      "apiKey": "env(MCP_LEGAL_API_KEY)",
      "timeout": 60000,
      "retries": 3
    }
  }
}
```

## Deployment and Scaling Notes

### Container Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S shaman && \
    adduser -S shaman -u 1001

# Setup directories
RUN mkdir -p /app/logs /app/git-cache /secrets && \
    chown -R shaman:shaman /app /secrets

USER shaman

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["npm", "start"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shaman-server
  namespace: shaman-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shaman-server
  template:
    metadata:
      labels:
        app: shaman-server
    spec:
      containers:
        - name: shaman-server
          image: company/shaman-server:v1.0.0
          ports:
            - containerPort: 4000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: shaman-secrets
                  key: database-url
            - name: REDIS_CLUSTER_URL
              valueFrom:
                secretKeyRef:
                  name: shaman-secrets
                  key: redis-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: shaman-secrets
                  key: jwt-secret
          volumeMounts:
            - name: config-volume
              mountPath: /app/config
            - name: git-keys
              mountPath: /secrets
              readOnly: true
            - name: git-cache
              mountPath: /app/git-cache
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: config-volume
          configMap:
            name: shaman-config
        - name: git-keys
          secret:
            secretName: shaman-git-keys
        - name: git-cache
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: shaman-server-service
  namespace: shaman-prod
spec:
  selector:
    app: shaman-server
  ports:
    - protocol: TCP
      port: 80
      targetPort: 4000
  type: ClusterIP
```

### Auto-scaling Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shaman-server-hpa
  namespace: shaman-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shaman-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: active_connections
        target:
          type: AverageValue
          averageValue: "30"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### Performance Tuning

**Database Optimization:**

- Use connection pooling with 50-100 connections for high-traffic scenarios
- Enable read replicas for query distribution
- Configure appropriate timeouts for long-running operations
- Use database indexing on frequently queried fields

**Redis Optimization:**

- Use Redis Cluster for high availability and horizontal scaling
- Configure appropriate memory policies for cache eviction
- Use pipelining for bulk operations
- Monitor memory usage and set appropriate TTLs

**Git Repository Scaling:**

- Use shallow clones to reduce disk usage
- Implement intelligent caching of agent definitions
- Use webhook-based updates rather than polling when possible
- Consider repository sharding for very large agent collections

**External Agent Optimization:**

- Implement connection pooling for external HTTP calls
- Use circuit breakers to handle external service failures
- Configure appropriate timeouts and retry strategies
- Monitor external agent performance and adjust rate limits accordingly

---

**Navigation:**

- [← Previous: System Architecture](./03-system-architecture.md)
- [🏠 Home](./README.md)
- [Next: GraphQL API Specification →](./05-graphql-api-spec.md)
