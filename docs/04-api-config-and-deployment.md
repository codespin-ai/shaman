# API Configuration and Deployment

Shaman's modular, type-based architecture allows for flexible configuration and deployment across different environments and workflow engines.

## Configuration Overview

Shaman uses **type-safe configuration objects** rather than classes or inheritance, making it easy to validate, version, and deploy configurations.

```typescript
import { temporal, notifications, tools } from '@shaman/workflow-engine';

// Complete Shaman configuration
const shamanConfig: ShamanConfig = {
  agents: {
    gitRepos: [...],
    syncInterval: 300000 // 5 minutes
  },
  workflowEngine: {
    type: 'temporal',
    config: { /* temporal config */ }
  },
  notifications: {
    provider: 'redis',
    config: { /* redis config */ }
  },
  tools: {
    syncTools: [...],
    asyncTools: [...]
  },
  llmProviders: [...],
  streaming: { /* streaming config */ },
  security: { /* security config */ }
};
```

## Workflow Engine Configuration

### Temporal Configuration

```typescript
const temporalConfig: TemporalConfig = {
  connection: {
    address: 'temporal.company.com:7233',
    namespace: 'shaman-production',
    tls: {
      clientCertPath: '/etc/certs/client.pem',
      clientKeyPath: '/etc/certs/client.key',
      serverRootCACertPath: '/etc/certs/ca.pem'
    }
  },
  workers: {
    taskQueue: 'shaman-agents',
    maxConcurrentWorkflows: 100,
    maxConcurrentActivities: 200,
    enableLogging: true,
    gracefulShutdownTimeout: 30000
  },
  workflowDefaults: {
    workflowExecutionTimeout: '24h',
    workflowRunTimeout: '2h',
    workflowTaskTimeout: '30s'
  }
};

// Create temporal adapter
const workflowAdapter = temporal.createWorkflowEngineAdapter(temporalConfig);
```

### BullMQ Configuration

```typescript
const bullmqConfig: BullMQConfig = {
  redis: {
    host: 'redis.company.com',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0,
    maxRetriesPerRequest: 3
  },
  queues: {
    'shaman-agents': {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }
  },
  workers: {
    concurrency: 10,
    maxStalledCount: 3,
    stalledInterval: 30000
  }
};

// Create BullMQ adapter
const workflowAdapter = bullmq.createWorkflowEngineAdapter(bullmqConfig);
```

### Custom Workflow Engine

```typescript
const customConfig: CustomWorkflowEngineConfig = {
  type: 'custom',
  implementation: './custom-workflow-engine',
  config: {
    // Custom configuration specific to your workflow engine
    database: {
      connectionString: process.env.DATABASE_URL
    },
    messaging: {
      brokerUrl: process.env.MESSAGE_BROKER_URL
    }
  }
};

// Create custom adapter
const workflowAdapter = custom.createWorkflowEngineAdapter(customConfig);
```

## Tool Configuration

### Synchronous Tools

```typescript
const syncTools: SyncToolConfig[] = [
  {
    name: 'check_account',
    executionType: 'sync',
    description: 'Check customer account status',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        includeHistory: { type: 'boolean', default: false }
      },
      required: ['customerId']
    },
    implementation: async (args: { customerId: string; includeHistory?: boolean }) => {
      // Direct database or API call
      return await customerService.getAccount(args.customerId, args.includeHistory);
    }
  },
  
  {
    name: 'calculate',
    executionType: 'sync',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string' }
      },
      required: ['expression']
    },
    implementation: async (args: { expression: string }) => {
      return evaluateExpression(args.expression);
    }
  },
  
  {
    name: 'get_current_time',
    executionType: 'sync',
    description: 'Get current date and time',
    parameters: {
      type: 'object',
      properties: {
        timezone: { type: 'string', default: 'UTC' },
        format: { type: 'string', default: 'ISO8601' }
      }
    },
    implementation: async (args: { timezone?: string; format?: string }) => {
      return formatDateTime(new Date(), args.timezone, args.format);
    }
  }
];
```

### Asynchronous Tools

```typescript
const asyncTools: AsyncToolConfig[] = [
  {
    name: 'process_refund',
    executionType: 'async',
    description: 'Process customer refund with approval workflow',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        amount: { type: 'number' },
        reason: { type: 'string' },
        refundMethod: { type: 'string', enum: ['original_payment', 'store_credit'] }
      },
      required: ['customerId', 'amount', 'reason']
    },
    asyncConfig: {
      estimatedDuration: 3600000, // 1 hour
      requiresApproval: true,
      approvalConfig: {
        approverRole: 'manager',
        approverEmails: ['manager@company.com'],
        approvalThreshold: 100, // Amounts over $100 need approval
        approvalTimeout: 86400000, // 24 hours
        escalationTimeout: 172800000, // 48 hours
        escalationRole: 'director'
      },
      requiresExternalSystem: true,
      externalSystemConfig: {
        systemName: 'payment-processor',
        operation: 'process-refund',
        timeout: 300000, // 5 minutes
        retryPolicy: {
          maxRetries: 3,
          backoff: 'exponential',
          initialDelay: 1000
        }
      }
    },
    implementation: async (args: RefundArgs, context: ExecutionContext) => {
      // This runs after approval and external system validation
      return await paymentService.processRefund(args);
    }
  },
  
  {
    name: 'generate_compliance_report',
    executionType: 'async',
    description: 'Generate detailed compliance report',
    parameters: {
      type: 'object',
      properties: {
        reportType: { type: 'string', enum: ['audit', 'regulatory', 'internal'] },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date' },
            end: { type: 'string', format: 'date' }
          }
        },
        includeAttachments: { type: 'boolean', default: false }
      },
      required: ['reportType', 'dateRange']
    },
    asyncConfig: {
      estimatedDuration: 7200000, // 2 hours
      requiresApproval: false,
      isLongRunning: true,
      progressUpdates: true,
      canCancel: true
    },
    implementation: async (args: ReportArgs, context: ExecutionContext) => {
      return await complianceService.generateReport(args, context);
    }
  }
];

// Register tools with executor
const toolExecutor = tools.createToolExecutor(
  [...syncTools, ...asyncTools],
  {
    // Tool implementations
    check_account: syncTools.find(t => t.name === 'check_account')!.implementation,
    calculate: syncTools.find(t => t.name === 'calculate')!.implementation,
    // ... other implementations
  }
);
```

## Notification Provider Configuration

### Redis Notifications

```typescript
const redisNotificationConfig: RedisNotificationConfig = {
  host: 'redis.company.com',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 1, // Separate database for notifications
  keyPrefix: 'shaman:notifications',
  retryPolicy: {
    maxRetries: 5,
    backoff: 'exponential',
    initialDelay: 1000
  },
  clustering: {
    enabled: true,
    nodes: [
      { host: 'redis-1.company.com', port: 6379 },
      { host: 'redis-2.company.com', port: 6379 },
      { host: 'redis-3.company.com', port: 6379 }
    ]
  }
};

const notificationProvider = notifications.redis(redisNotificationConfig);
```

### Webhook Notifications

```typescript
const webhookNotificationConfig: WebhookNotificationConfig = {
  endpoints: [
    'https://api.company.com/shaman/notifications/primary',
    'https://backup-api.company.com/shaman/notifications/backup'
  ],
  authentication: {
    type: 'bearer',
    token: process.env.WEBHOOK_TOKEN
  },
  retryPolicy: {
    maxRetries: 3,
    backoff: 'exponential',
    initialDelay: 2000,
    maxDelay: 30000
  },
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
    'X-Shaman-Source': 'agent-execution',
    'X-Shaman-Version': '1.0'
  },
  signatureValidation: {
    enabled: true,
    secret: process.env.WEBHOOK_SECRET,
    algorithm: 'sha256'
  }
};

const notificationProvider = notifications.webhook(webhookNotificationConfig);
```

### EventBridge Notifications

```typescript
const eventBridgeNotificationConfig: EventBridgeNotificationConfig = {
  eventBusName: 'shaman-agent-events',
  source: 'shaman.agent-execution',
  region: 'us-east-1',
  detailType: 'Agent Execution Event',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN
  },
  eventMapping: {
    'async_tool_completed': 'Tool Execution Completed',
    'approval_required': 'Approval Required',
    'external_event_received': 'External System Event'
  }
};

const notificationProvider = notifications.eventbridge(eventBridgeNotificationConfig);
```

### Kafka Notifications

```typescript
const kafkaNotificationConfig: KafkaNotificationConfig = {
  brokers: ['kafka-1.company.com:9092', 'kafka-2.company.com:9092'],
  clientId: 'shaman-notifications',
  groupId: 'shaman-notification-consumers',
  topics: {
    asyncToolCompletion: 'shaman.async-tools.completed',
    approvalRequests: 'shaman.approvals.requested',
    externalEvents: 'shaman.external.events'
  },
  producerConfig: {
    maxInFlightRequests: 1,
    idempotent: true,
    transactionTimeout: 30000
  },
  consumerConfig: {
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxPollInterval: 300000
  },
  ssl: {
    ca: fs.readFileSync('/etc/kafka/ca.pem'),
    cert: fs.readFileSync('/etc/kafka/client.pem'),
    key: fs.readFileSync('/etc/kafka/client.key')
  }
};

const notificationProvider = notifications.kafka(kafkaNotificationConfig);
```

## LLM Provider Configuration

```typescript
const llmProviders: LLMProviderConfig[] = [
  {
    name: 'openai',
    type: 'openai',
    config: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4-turbo',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
      rateLimiting: {
        requestsPerMinute: 60,
        tokensPerMinute: 90000
      }
    }
  },
  
  {
    name: 'anthropic',
    type: 'anthropic',
    config: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com',
      defaultModel: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000
    }
  },
  
  {
    name: 'azure-openai',
    type: 'azure-openai',
    config: {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: 'gpt-4-turbo',
      apiVersion: '2024-02-15-preview',
      timeout: 30000
    }
  },
  
  {
    name: 'ollama',
    type: 'ollama',
    config: {
      baseURL: 'http://ollama.company.com:11434',
      defaultModel: 'llama2:13b',
      timeout: 60000,
      streamingEnabled: true
    }
  }
];
```

## Agent Repository Configuration

```typescript
const agentConfig: AgentConfig = {
  gitRepos: [
    {
      url: 'https://github.com/company/agents-main.git',
      branch: 'main',
      path: 'agents/',
      syncInterval: 300000, // 5 minutes
      authentication: {
        type: 'token',
        token: process.env.GITHUB_TOKEN
      },
      namespace: 'main', // Default namespace
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
    },
    
    {
      url: 'https://github.com/company/agents-experimental.git',
      branch: 'develop',
      path: 'experimental/',
      syncInterval: 600000, // 10 minutes
      authentication: {
        type: 'ssh',
        privateKeyPath: '/etc/ssh/deploy_key'
      },
      namespace: 'experimental',
      enabled: process.env.NODE_ENV === 'development'
    },
    
    {
      url: 'https://internal-git.company.com/agents/specialized.git',
      branch: 'production',
      path: 'agents/',
      syncInterval: 180000, // 3 minutes
      authentication: {
        type: 'basic',
        username: process.env.GIT_USERNAME,
        password: process.env.GIT_PASSWORD
      },
      namespace: 'specialized'
    }
  ],
  
  validation: {
    enabled: true,
    strictMode: true, // Fail on validation errors
    linting: {
      enabled: true,
      rules: ['required-frontmatter', 'valid-tools', 'valid-agents']
    }
  },
  
  caching: {
    enabled: true,
    ttl: 900000, // 15 minutes
    maxSize: 100 // Max 100 agents in cache
  }
};
```

## Streaming Configuration

```typescript
const streamingConfig: StreamingConfig = {
  websocket: {
    port: 4000,
    path: '/stream',
    cors: {
      origin: ['https://app.company.com', 'https://admin.company.com'],
      credentials: true
    },
    authentication: {
      required: true,
      type: 'jwt',
      secret: process.env.JWT_SECRET
    },
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxConnections: 100,
      maxEventsPerConnection: 1000
    }
  },
  
  events: {
    bufferSize: 1000,
    maxAge: 3600000, // 1 hour
    compression: 'gzip',
    filtering: {
      enabled: true,
      allowedTypes: [
        'agent_thinking',
        'agent_response_chunk',
        'tool_execution_started',
        'tool_execution_completed',
        'async_tool_status',
        'user_input_requested'
      ]
    }
  },
  
  fallback: {
    polling: {
      enabled: true,
      interval: 1000, // 1 second
      endpoint: '/api/stream/poll'
    }
  }
};
```

## Security Configuration

```typescript
const securityConfig: SecurityConfig = {
  authentication: {
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '24h',
      issuer: 'shaman-api',
      audience: 'shaman-clients'
    },
    oauth2: {
      enabled: true,
      providers: [
        {
          name: 'google',
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          scope: ['openid', 'email', 'profile']
        }
      ]
    },
    apiKeys: {
      enabled: true,
      headerName: 'X-API-Key',
      rateLimiting: {
        windowMs: 60000,
        maxRequests: 1000
      }
    }
  },
  
  authorization: {
    rbac: {
      enabled: true,
      roles: {
        admin: ['*'],
        user: ['agent:execute', 'conversation:read', 'conversation:create'],
        readonly: ['conversation:read', 'agent:read']
      }
    },
    
    agentPermissions: {
      enabled: true,
      defaultPermissions: ['basic_tools'],
      permissionSets: {
        basic_tools: ['check_account', 'calculate', 'get_current_time'],
        billing_tools: ['process_refund', 'check_payment_status'],
        admin_tools: ['*']
      }
    }
  },
  
  encryption: {
    atRest: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyRotation: {
        enabled: true,
        interval: '30d'
      }
    },
    inTransit: {
      tls: {
        minVersion: '1.2',
        cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256']
      }
    }
  },
  
  audit: {
    enabled: true,
    events: ['authentication', 'authorization', 'agent_execution', 'tool_execution'],
    storage: {
      type: 'database',
      retention: '90d'
    }
  }
};
```

## Environment-Specific Configurations

### Development Environment

```typescript
// development.config.ts
export const developmentConfig: ShamanConfig = {
  workflowEngine: {
    type: 'bullmq',
    config: {
      redis: { host: 'localhost', port: 6379 }
    }
  },
  notifications: {
    provider: 'redis',
    config: { host: 'localhost', port: 6379 }
  },
  llmProviders: [
    {
      name: 'openai',
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-3.5-turbo', // Cheaper for development
        maxTokens: 2048
      }
    }
  ],
  streaming: {
    websocket: { port: 4000 },
    events: { bufferSize: 100 }
  },
  security: {
    authentication: { jwt: { expiresIn: '7d' } }, // Longer expiry for dev
    authorization: { rbac: { enabled: false } } // Simplified for dev
  }
};
```

### Production Environment

```typescript
// production.config.ts
export const productionConfig: ShamanConfig = {
  workflowEngine: {
    type: 'temporal',
    config: {
      connection: {
        address: 'temporal-cluster.company.com:7233',
        namespace: 'shaman-production',
        tls: { /* TLS config */ }
      },
      workers: {
        maxConcurrentWorkflows: 500,
        maxConcurrentActivities: 1000
      }
    }
  },
  notifications: {
    provider: 'kafka',
    config: {
      brokers: ['kafka-1.company.com:9092', 'kafka-2.company.com:9092'],
      ssl: { /* SSL config */ }
    }
  },
  llmProviders: [
    {
      name: 'openai-primary',
      config: {
        apiKey: process.env.OPENAI_API_KEY_PRIMARY,
        defaultModel: 'gpt-4-turbo',
        rateLimiting: { requestsPerMinute: 1000 }
      }
    },
    {
      name: 'openai-fallback',
      config: {
        apiKey: process.env.OPENAI_API_KEY_FALLBACK,
        defaultModel: 'gpt-4-turbo'
      }
    }
  ],
  streaming: {
    websocket: {
      port: 4000,
      authentication: { required: true },
      rateLimit: { maxConnections: 10000 }
    }
  },
  security: {
    authentication: {
      jwt: { expiresIn: '8h' },
      oauth2: { enabled: true }
    },
    authorization: { rbac: { enabled: true } },
    encryption: { atRest: { enabled: true } },
    audit: { enabled: true }
  }
};
```

## Deployment Options

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000 4000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  shaman:
    build: .
    ports:
      - "3000:3000"
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - TEMPORAL_ADDRESS=temporal:7233
      - REDIS_HOST=redis
      - DATABASE_URL=postgresql://user:pass@postgres:5432/shaman
    depends_on:
      - temporal
      - redis
      - postgres
  
  temporal:
    image: temporalio/temporal:latest
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=postgres
    depends_on:
      - postgres
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=temporal
    ports:
      - "5432:5432"
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shaman-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shaman-api
  template:
    metadata:
      labels:
        app: shaman-api
    spec:
      containers:
      - name: shaman-api
        image: company/shaman:latest
        ports:
        - containerPort: 3000
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: TEMPORAL_ADDRESS
          value: "temporal-service:7233"
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Serverless Deployment

```typescript
// serverless.yml
service: shaman-api

provider:
  name: aws
  runtime: nodejs18.x
  stage: ${opt:stage, 'dev'}
  region: us-east-1
  
  environment:
    TEMPORAL_ADDRESS: ${env:TEMPORAL_ADDRESS}
    REDIS_HOST: ${env:REDIS_HOST}
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}

functions:
  api:
    handler: src/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
    timeout: 30
    memorySize: 1024

  websocket:
    handler: src/websocket.handler
    events:
      - websocket:
          route: $connect
      - websocket:
          route: $disconnect
      - websocket:
          route: $default

plugins:
  - serverless-offline
  - serverless-webpack
```

## Configuration Validation

```typescript
// config-validator.ts
import Ajv from 'ajv';

const configSchema = {
  type: 'object',
  properties: {
    workflowEngine: {
      type: 'object',
      properties: {
        type: { enum: ['temporal', 'bullmq', 'custom'] },
        config: { type: 'object' }
      },
      required: ['type', 'config']
    },
    notifications: {
      type: 'object',
      properties: {
        provider: { enum: ['redis', 'webhook', 'eventbridge', 'kafka'] },
        config: { type: 'object' }
      },
      required: ['provider', 'config']
    },
    // ... more schema definitions
  },
  required: ['workflowEngine', 'notifications']
};

export const validateConfig = (config: any): ValidationResult => {
  const ajv = new Ajv();
  const validate = ajv.compile(configSchema);
  const valid = validate(config);
  
  return {
    valid,
    errors: validate.errors || [],
    warnings: [] // Custom warnings logic
  };
};
```

This configuration system provides:
- ✅ **Type safety**: Compile-time validation of all configurations
- ✅ **Environment flexibility**: Easy switching between dev/staging/production
- ✅ **Plugin architecture**: Swap components without code changes
- ✅ **Validation**: Runtime configuration validation with helpful error messages
- ✅ **Security**: Built-in security configurations for production environments
- ✅ **Scalability**: Configuration options for high-throughput deployments