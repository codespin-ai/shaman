## 7. Complete GraphQL API Specification

### 7.1 Enhanced Schema


```graphql
# =============================================================================
#  ... (All other SCALARS, ENUMS, INTERFACES, and TYPES are unchanged) ...
# =============================================================================

# =============================================================================
#  INPUT TYPES
# =============================================================================

# ... (CreateUserInput, UpdateUserInput, AddAgentRepositoryInput, etc. are unchanged) ...

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
  # UPDATED to allow modifying the full auth config
  authConfig: ExternalA2AAuthInput
  healthCheckInterval: String
  isActive: Boolean
}

# UPDATED to support On-Behalf-Of flow and clarify client credentials flow
input ExternalA2AAuthInput {
  "The type of authentication mechanism to use."
  type: String! # e.g., "apiKey", "oauth2-client-credentials", "oauth2-obo", "basic"
  
  "The API key, used when type is 'apiKey'."
  apiKey: String

  "The endpoint for retrieving OAuth tokens."
  oauthTokenUrl: String
  
  "Shaman's own Client ID, used for both client_credentials and on_behalf_of flows."
  oauthClientId: String

  "Shaman's own Client Secret, used for both client_credentials and on_behalf_of flows."
  oauthClientSecret: String
  
  "NEW: The audience URI of the downstream A2A agent. Required for 'oauth2-obo' flow."
  downstreamApiAudience: String

  "NEW: The scopes required by the downstream A2A agent. Required for 'oauth2-obo' flow."
  downstreamApiScopes: [String!]

  "Username for 'basic' authentication."
  basicUsername: String

  "Password for 'basic' authentication."
  basicPassword: String
}

# ... (All other INPUT TYPES are unchanged) ...

# =============================================================================
#  API DEFINITION
# =============================================================================

type Query {
  # ... (No changes in Query) ...
}


type Mutation {
  # ... (User, Git Repo, MCP Server mutations are unchanged) ...

  # --- External A2A Management ---
  registerExternalA2AAgent(input: RegisterExternalA2AAgentInput!): ExternalA2AAgent!
  updateExternalA2AAgent(id: ID!, input: UpdateExternalA2AAgentInput!): ExternalA2AAgent!
  removeExternalA2AAgent(id: ID!): Boolean!
  refreshExternalA2AAgent(id: ID!): ExternalA2AAgent!
  testExternalA2AConnection(id: ID!): Boolean!

  # ... (Execution, Step, Input, Memory mutations are unchanged) ...
}

type Subscription {
  # ... (No changes in Subscription) ...
}

# ... (All other types like SystemUsageStats, CostAnalytics, etc. are unchanged) ...
```


## 8. Configuration & Deployment

### 8.1 Configuration Schema

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
          "default": "30m",
          "description": "Maximum execution time before timeout"
        },
        "inputRequestTimeout": {
          "type": "string", 
          "default": "24h",
          "description": "How long to wait for user input before timeout"
        },
        "maxCallDepth": {
          "type": "integer",
          "default": 10,
          "description": "Maximum depth for agent-to-agent calls"
        },
        "agentCallTimeout": {
          "type": "string",
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
          "items": {"type": "string"},
          "description": "Specific agents that can be exposed"
        },
        "allowedPrefixes": {
          "type": "array", 
          "items": {"type": "string"},
          "description": "Agent path prefixes that can be exposed"
        },
        "blockedAgents": {
          "type": "array",
          "items": {"type": "string"},
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
            "requestsPerMinute": {"type": "integer", "default": 60},
            "requestsPerHour": {"type": "integer", "default": 1000},
            "requestsPerDay": {"type": "integer", "default": 10000}
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
          "items": {"type": "string"},
          "description": "Domains allowed for external agent calls"
        },
        "defaultTimeout": {
          "type": "string",
          "default": "30s",
          "description": "Default timeout for external agent calls"
        },
        "rateLimiting": {
          "type": "object",
          "properties": {
            "callsPerMinute": {"type": "integer", "default": 30},
            "callsPerHour": {"type": "integer", "default": 500}
          }
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
        "gitWebhookSecret": {
          "type": "string",
          "pattern": "^env\\([A-Z_]+\\)$",
          "description": "Secret for validating git webhook signatures"
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
  "agentRepositories": [
    {
      "name": "main-agents",
      "gitUrl": "git@github.com:company/main-agents.git",
      "branch": "production", 
      "isRoot": true,
      "syncInterval": "5m",
      "authType": "ssh-key",
      "sshKeyPath": "/secrets/main-agents-deploy-key",
      "webhookSecret": "env(MAIN_AGENTS_WEBHOOK_SECRET)"
    },
    {
      "name": "experimental",
      "gitUrl": "https://github.com/company/experimental-agents.git",
      "branch": "main",
      "isRoot": false,
      "syncInterval": "15m", 
      "authType": "token",
      "authToken": "env(GITHUB_EXPERIMENTAL_TOKEN)"
    },
    {
      "name": "partner-legal",
      "gitUrl": "git@github.com:legal-partner/shared-agents.git",
      "branch": "stable",
      "isRoot": false,
      "syncInterval": "1h",
      "authType": "ssh-key",
      "sshKeyPath": "/secrets/partner-legal-key",
      "readOnly": true
    }
  ],
  "agentExecution": {
    "completionRequired": true,
    "maxExecutionTime": "30m",
    "inputRequestTimeout": "24h",
    "maxCallDepth": 10,
    "agentCallTimeout": "10m",
    "circularCallPrevention": true
  },
  "agentExposure": {
    "enabled": true,
    "basePath": "/a2a/v1",
    "allowedPrefixes": ["support/", "public/", "api/"],
    "blockedAgents": ["internal/admin-tools", "experimental/unstable"],
    "requiresAuthentication": true,
    "defaultSecuritySchemes": {
      "oauth2": {
        "type": "oauth2",
        "flows": {
          "clientCredentials": {
            "tokenUrl": "https://auth.company.com/oauth/token",
            "scopes": {
              "agent:execute": "Execute agents",
              "agent:stream": "Stream responses"
            }
          }
        }
      }
    },
    "rateLimiting": {
      "requestsPerMinute": 120,
      "requestsPerHour": 5000,
      "requestsPerDay": 50000
    }
  },
  "externalAgents": {
    "enabled": true,
    "allowedDomains": [
      "legal-ai.partner.com",
      "finance-ai.vendor.com",
      "research-ai.university.edu"
    ],
    "defaultTimeout": "30s",
    "rateLimiting": {
      "callsPerMinute": 60,
      "callsPerHour": 1000
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
    "github": {
      "type": "HTTP",
      "endpoint": "https://mcp-github.internal:3000",
      "apiKey": "env(MCP_GITHUB_API_KEY)"
    },
    "crm-tools": {
      "type": "HTTP",
      "endpoint": "https://mcp-crm.internal:3000", 
      "apiKey": "env(MCP_CRM_API_KEY)"
    },
    "filesystem": {
      "type": "STDIO",
      "endpoint": "npx @modelcontextprotocol/server-filesystem /var/shaman/workspace"
    }
  },
  "security": {
    "jwtSecret": "env(JWT_SECRET)",
    "corsOrigins": [
      "https://shaman-ui.example.com",
      "https://dashboard.example.com"
    ],
    "gitWebhookSecret": "env(GIT_WEBHOOK_SECRET)"
  }
}
```

### 8.3 Deployment Scenarios

#### 8.3.1 Local Development

- **Engine:** BullMQ with single Redis instance
- **Database:** Local PostgreSQL with Docker
- **Git Repositories:** Local file system or development branches
- **External Agents:** Disabled or test endpoints
- **A2A Exposure:** Disabled
- **Observability:** Local Jaeger for tracing

#### 8.3.2 Enterprise Production

- **Engine:** Temporal.io cluster with high availability
- **Database:** PostgreSQL with read replicas and automated backups
- **Git Repositories:** Production branches with webhook integration
- **External Agents:** Curated partner integrations with SLAs
- **A2A Exposure:** Enabled with OAuth 2.0 authentication
- **Scaling:** Multiple server instances with auto-scaling workers
- **Observability:** Full distributed tracing and monitoring

#### 8.3.3 Multi-Tenant SaaS

- **Repository Isolation:** Per-tenant git repositories or branches
- **Agent Namespacing:** Tenant prefixes in agent names
- **Security:** Tenant-specific authentication and authorization
- **Resource Limits:** Per-tenant rate limiting and cost controls
- **A2A Federation:** Secure tenant-to-tenant agent sharing

### 8.4 Scaling Strategies

#### 8.4.1 Git Repository Scaling

- **Repository Sharding:** Distribute agents across multiple repositories
- **Caching Strategy:** Redis caching of parsed agent definitions
- **Lazy Loading:** Load agent definitions on-demand rather than at startup
- **Webhook Optimization:** Intelligent sync based on changed files only

#### 8.4.2 External A2A Scaling

- **Connection Pooling:** Reuse HTTP connections to external agents
- **Circuit Breakers:** Protect against external agent failures
- **Retry Strategies:** Intelligent backoff for temporary failures
- **Load Balancing:** Distribute calls across multiple external endpoints

#### 8.4.3 High Availability

- **Database:** Primary-replica with automatic failover
- **Redis:** Sentinel or Cluster mode for high availability
- **Git Repositories:** Mirror repositories for redundancy
- **External Agents:** Fallback agents for critical services
- **Monitoring:** Health checks for all system components

This comprehensive specification now incorporates the git-based agent management, A2A federation capabilities, repository namespacing, external agent integration, and all the detailed architectural decisions we discussed. The system provides a complete solution for managing AI agents as code while enabling seamless integration with external AI services through standard protocols.