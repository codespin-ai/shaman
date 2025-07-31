[← Previous: System Architecture](./03-system-architecture.md) | [🏠 Home](./README.md) | [Next: GraphQL API Reference →](./05-graphql-api-reference.md)

---

# Deployment and Configuration

This guide covers deploying Shaman's two-server architecture, configuring each component, and managing different deployment scenarios from development to production.

## Server Deployment Model

Shaman requires **two distinct server instances** with different roles:

```bash
# Public Server - Faces the internet
npm start -- --role public --port 3000

# Internal Server - Protected network only  
npm start -- --role internal --port 4000
```

### Server Role Configuration

The `--role` flag is **mandatory** and determines server behavior:

| Role | Purpose | Accessible From | Authentication |
|------|---------|----------------|----------------|
| `public` | API Gateway, Management UI | Internet | Kratos sessions, API keys |
| `internal` | Agent execution, Tools | Internal network only | JWT tokens only |

## Environment Configuration

### Common Environment Variables

Both servers require these base configurations:

```bash
# Database Configuration (Multi-DB support)
SHAMAN_DB_HOST=localhost
SHAMAN_DB_PORT=5432
SHAMAN_DB_NAME=shaman
SHAMAN_DB_USER=shaman_user
SHAMAN_DB_PASSWORD=secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=shaman
```

### Public Server Configuration

Additional variables for public server:

```bash
# Server Role (REQUIRED)
SERVER_ROLE=public

# External URLs
PUBLIC_URL=https://shaman.ai
WEBSOCKET_URL=wss://shaman.ai/ws

# Ory Kratos
KRATOS_PUBLIC_URL=https://auth.shaman.ai
KRATOS_ADMIN_URL=http://kratos:4434

# Permiso RBAC
PERMISO_API_URL=https://permiso.shaman.ai/api
PERMISO_API_KEY=permiso_secret_key

# Internal Server Connection
INTERNAL_SERVER_URL=http://internal-server:4000
INTERNAL_JWT_SECRET=shared_jwt_secret_key
INTERNAL_JWT_ISSUER=shaman-public-server

# CORS Settings
CORS_ALLOWED_ORIGINS=https://app.shaman.ai,https://manage.shaman.ai
```

### Internal Server Configuration

Additional variables for internal server:

```bash
# Server Role (REQUIRED)
SERVER_ROLE=internal

# JWT Validation
INTERNAL_JWT_SECRET=shared_jwt_secret_key
INTERNAL_JWT_AUDIENCE=shaman-internal-server

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AZURE_OPENAI_ENDPOINT=https://myinstance.openai.azure.com
AZURE_OPENAI_API_KEY=...

# Workflow Engine
WORKFLOW_ENGINE=temporal
TEMPORAL_ADDRESS=temporal.cluster:7233
TEMPORAL_NAMESPACE=shaman

# Git Configuration
GIT_SYNC_INTERVAL=300000  # 5 minutes
GIT_CACHE_DIR=/var/cache/shaman/git

# MCP Server Defaults
MCP_DEFAULT_TIMEOUT=30000
MCP_MAX_CONNECTIONS=100
```

## Deployment Scenarios

### Development Environment

Simple Docker Compose setup for local development:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: shaman
      POSTGRES_PASSWORD: shaman
      POSTGRES_DB: shaman
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass redis_password
    ports:
      - "6379:6379"

  kratos:
    image: oryd/kratos:v1.0
    ports:
      - "4433:4433"  # Public
      - "4434:4434"  # Admin
    environment:
      DSN: postgres://shaman:shaman@postgres:5432/kratos?sslmode=disable
    volumes:
      - ./kratos:/etc/config/kratos

  public-server:
    build: .
    command: npm start -- --role public --port 3000
    ports:
      - "3000:3000"
    environment:
      SERVER_ROLE: public
      SHAMAN_DB_HOST: postgres
      REDIS_HOST: redis
      KRATOS_PUBLIC_URL: http://kratos:4433
      KRATOS_ADMIN_URL: http://kratos:4434
      INTERNAL_SERVER_URL: http://internal-server:4000
      INTERNAL_JWT_SECRET: dev_jwt_secret
    depends_on:
      - postgres
      - redis
      - kratos

  internal-server:
    build: .
    command: npm start -- --role internal --port 4000
    ports:
      - "4000:4000"
    environment:
      SERVER_ROLE: internal
      SHAMAN_DB_HOST: postgres
      REDIS_HOST: redis
      INTERNAL_JWT_SECRET: dev_jwt_secret
      WORKFLOW_ENGINE: bullmq
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

### Production Environment

#### Kubernetes Deployment

```yaml
# public-server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shaman-public
  namespace: shaman
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shaman-public
  template:
    metadata:
      labels:
        app: shaman-public
    spec:
      containers:
      - name: shaman
        image: shaman:latest
        command: ["npm", "start", "--", "--role", "public", "--port", "3000"]
        ports:
        - containerPort: 3000
        env:
        - name: SERVER_ROLE
          value: "public"
        - name: INTERNAL_JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: shaman-secrets
              key: jwt-secret
        envFrom:
        - configMapRef:
            name: shaman-public-config
        - secretRef:
            name: shaman-public-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
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
---
# internal-server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shaman-internal
  namespace: shaman
spec:
  replicas: 5
  selector:
    matchLabels:
      app: shaman-internal
  template:
    metadata:
      labels:
        app: shaman-internal
    spec:
      containers:
      - name: shaman
        image: shaman:latest
        command: ["npm", "start", "--", "--role", "internal", "--port", "4000"]
        ports:
        - containerPort: 4000
        env:
        - name: SERVER_ROLE
          value: "internal"
        - name: INTERNAL_JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: shaman-secrets
              key: jwt-secret
        envFrom:
        - configMapRef:
            name: shaman-internal-config
        - secretRef:
            name: shaman-internal-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

#### Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: shaman-internal-isolation
  namespace: shaman
spec:
  podSelector:
    matchLabels:
      app: shaman-internal
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: shaman-public
    ports:
    - protocol: TCP
      port: 4000
```

### Multi-Region Deployment

For global availability with regional isolation:

```yaml
# Region 1: US-East
apiVersion: v1
kind: ConfigMap
metadata:
  name: shaman-region-config
  namespace: shaman
data:
  REGION: "us-east-1"
  PUBLIC_URL: "https://us-east.shaman.ai"
  INTERNAL_SERVER_URL: "http://shaman-internal.us-east.svc.cluster.local:4000"
  DATABASE_URL: "postgres://shaman@pgbouncer.us-east:5432/shaman"
---
# Region 2: EU-West  
apiVersion: v1
kind: ConfigMap
metadata:
  name: shaman-region-config
  namespace: shaman
data:
  REGION: "eu-west-1"
  PUBLIC_URL: "https://eu-west.shaman.ai"
  INTERNAL_SERVER_URL: "http://shaman-internal.eu-west.svc.cluster.local:4000"
  DATABASE_URL: "postgres://shaman@pgbouncer.eu-west:5432/shaman"
```

## Database Configuration

### Multi-Database Setup

Shaman supports multiple databases for different components:

```bash
# Main Shaman database
SHAMAN_DB_HOST=localhost
SHAMAN_DB_PORT=5432
SHAMAN_DB_NAME=shaman
SHAMAN_DB_USER=shaman_user
SHAMAN_DB_PASSWORD=secure_password

# Kratos identity database
KRATOS_DB_HOST=localhost
KRATOS_DB_PORT=5432
KRATOS_DB_NAME=kratos
KRATOS_DB_USER=kratos_user
KRATOS_DB_PASSWORD=kratos_password

# Temporal workflow database (if using Temporal)
TEMPORAL_DB_HOST=localhost
TEMPORAL_DB_PORT=5432
TEMPORAL_DB_NAME=temporal
TEMPORAL_DB_USER=temporal_user
TEMPORAL_DB_PASSWORD=temporal_password
```

### Database Migrations

Run migrations for each database:

```bash
# Main database
npm run migrate:shaman:latest

# Run all migrations
npm run migrate:all

# Create new migration
npm run migrate:shaman:make add_new_feature
```

## Workflow Engine Configuration

### Temporal (Production)

```bash
# Environment variables
WORKFLOW_ENGINE=temporal
TEMPORAL_ADDRESS=temporal.cluster:7233
TEMPORAL_NAMESPACE=shaman-prod
TEMPORAL_TASK_QUEUE=shaman-tasks
TEMPORAL_MAX_CONCURRENT_ACTIVITIES=100
TEMPORAL_MAX_CONCURRENT_WORKFLOWS=50

# Temporal Worker Configuration
TEMPORAL_WORKER_MAX_CONCURRENT_ACTIVITY_EXECUTIONS=10
TEMPORAL_WORKER_MAX_CONCURRENT_WORKFLOW_EXECUTIONS=5
```

### BullMQ (Development)

```bash
# Environment variables
WORKFLOW_ENGINE=bullmq
BULLMQ_QUEUE_PREFIX=shaman
BULLMQ_DEFAULT_JOB_OPTIONS={"removeOnComplete":100,"removeOnFail":1000}
BULLMQ_WORKER_CONCURRENCY=5
```

## Security Configuration

### TLS/SSL Setup

```nginx
# nginx.conf for public server
server {
    listen 443 ssl http2;
    server_name *.shaman.ai;
    
    ssl_certificate /etc/nginx/ssl/shaman.crt;
    ssl_certificate_key /etc/nginx/ssl/shaman.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://shaman-public:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://shaman-public:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### JWT Configuration

Generate secure JWT secrets:

```bash
# Generate a secure secret
openssl rand -base64 64

# Set in environment
INTERNAL_JWT_SECRET=<generated-secret>
INTERNAL_JWT_ALGORITHM=HS256
INTERNAL_JWT_EXPIRY=300  # 5 minutes
```

## Monitoring and Observability

### Health Checks

Both servers expose health endpoints:

```bash
# Public server
curl http://localhost:3000/health
{
  "status": "healthy",
  "role": "public",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "kratos": "ok",
    "permiso": "ok"
  }
}

# Internal server
curl http://localhost:4000/health
{
  "status": "healthy", 
  "role": "internal",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "workflow_engine": "ok",
    "git_cache": "ok"
  }
}
```

### Metrics Configuration

```bash
# Prometheus metrics
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/metrics

# Custom metrics
METRICS_COLLECT_HTTP_DURATION=true
METRICS_COLLECT_DB_QUERY_DURATION=true
METRICS_COLLECT_AGENT_EXECUTION_TIME=true
```

### Logging Configuration

```bash
# Structured logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_PRETTY=false

# Log destinations
LOG_STDOUT=true
LOG_FILE=/var/log/shaman/app.log
LOG_FILE_MAX_SIZE=100M
LOG_FILE_MAX_FILES=10

# Log sampling (for high volume)
LOG_SAMPLING_ENABLED=true
LOG_SAMPLING_RATE=0.1  # 10% of debug logs
```

## Performance Tuning

### Connection Pooling

```bash
# Database connections
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Redis connections  
REDIS_POOL_MIN=5
REDIS_POOL_MAX=50

# HTTP connections (A2A)
HTTP_POOL_MAX_SOCKETS=100
HTTP_POOL_MAX_FREE_SOCKETS=10
HTTP_POOL_TIMEOUT=60000
```

### Caching Configuration

```bash
# Agent cache
AGENT_CACHE_TTL=300  # 5 minutes
AGENT_CACHE_MAX_SIZE=1000

# LLM response cache (optional)
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=3600  # 1 hour
LLM_CACHE_MAX_SIZE=10000
```

### Rate Limiting

```bash
# API rate limits
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_BY_IP=true
RATE_LIMIT_BY_API_KEY=true

# Per-tenant limits
RATE_LIMIT_TENANT_MULTIPLIER=10  # Premium tenants get 10x
```

## Backup and Recovery

### Database Backups

```bash
#!/bin/bash
# backup.sh

# Backup main database
pg_dump $SHAMAN_DB_URL | gzip > shaman-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup to S3
aws s3 cp shaman-*.sql.gz s3://shaman-backups/postgres/

# Cleanup old backups (keep 30 days)
find . -name "shaman-*.sql.gz" -mtime +30 -delete
```

### Disaster Recovery

```yaml
# kubernetes backup job
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shaman-backup
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: shaman-backup:latest
            env:
            - name: BACKUP_S3_BUCKET
              value: shaman-backups
            - name: BACKUP_RETENTION_DAYS
              value: "30"
```

## Troubleshooting

### Common Issues

**Server won't start without --role flag:**
```
Error: Server role must be specified with --role flag
Options: public, internal
```
Solution: Always specify `--role public` or `--role internal`

**JWT validation failures between servers:**
```
Error: JWT validation failed: invalid signature
```
Solution: Ensure `INTERNAL_JWT_SECRET` matches on both servers

**Agent not found errors:**
```
Error: Agent 'ProcessOrder' not found in repository
```
Solution: Check Git sync status and repository configuration

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Debug mode
DEBUG=shaman:*
LOG_LEVEL=debug
LOG_PRETTY=true

# Trace A2A calls
A2A_TRACE_ENABLED=true
A2A_TRACE_HEADERS=true
A2A_TRACE_BODY=true

# Trace MCP calls
MCP_TRACE_ENABLED=true
MCP_TRACE_TOOLS=true
```

---

[← Previous: System Architecture](./03-system-architecture.md) | [🏠 Home](./README.md) | [Next: GraphQL API Reference →](./05-graphql-api-reference.md)