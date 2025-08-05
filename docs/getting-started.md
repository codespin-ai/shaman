# Getting Started

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Git
- Permiso RBAC service (or use @codespin/permiso-client)
- Foreman workflow orchestration service (or use @codespin/foreman-client)

## Installation

```bash
# Clone repository
git clone https://github.com/your-org/shaman.git
cd shaman

# Install dependencies
npm install

# Build all packages
./build.sh

# Set up environment
cp .env.example .env
# Edit .env with your database credentials
```

## Database Setup

```bash
# Create database
createdb shaman

# Run migrations
npm run migrate:shaman:latest

# (Optional) Run seeds for demo data
npm run seed:shaman:run
```

## Quick Start

### 1. Start Services

```bash
# Terminal 1: GraphQL server (management API)
cd node/packages/shaman-gql-server
npm start

# Terminal 2: A2A public server (external API)
cd node/packages/shaman-a2a-server
npm start -- --role public --port 3000

# Terminal 3: A2A internal server (agent execution)  
cd node/packages/shaman-a2a-server
npm start -- --role internal --port 4000

# Terminal 4: Worker (job processing)
cd node/packages/shaman-worker
npm start
```

### 2. Add an Agent Repository

```graphql
# GraphQL mutation
mutation {
  addAgentRepository(input: {
    name: "customer-support-agents"
    gitUrl: "https://github.com/your-org/agents.git"
    branch: "main"
  }) {
    id
    name
  }
}
```

### 3. Create Your First Agent

Create `CustomerSupport.md` in your Git repository:

```markdown
---
name: CustomerSupport
exposed: true
description: Handles customer inquiries
model: gpt-4
temperature: 0.7
tools:
  - run_data_write
  - run_data_read
  - call_agent
---

You are a helpful customer support agent.

When you need to process payments, call the PaymentProcessor agent.
When you need to check inventory, call the InventoryChecker agent.

Always be polite and helpful.
```

### 4. Call Your Agent

```bash
curl -X POST https://localhost:3000/a2a/v1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-001",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{
          "kind": "text",
          "text": "@CustomerSupport I need help with order #12345"
        }]
      }
    }
  }'
```

## Configuration

### Environment Variables

```bash
# Database
SHAMAN_DB_HOST=localhost
SHAMAN_DB_PORT=5432
SHAMAN_DB_NAME=shaman
RLS_DB_USER=app_user
RLS_DB_USER_PASSWORD=xxx
UNRESTRICTED_DB_USER=admin_user
UNRESTRICTED_DB_USER_PASSWORD=xxx

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Server URLs
INTERNAL_A2A_URL=http://localhost:4000
PUBLIC_URL=https://your-domain.com

# Security
INTERNAL_JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key

# External Services
PERMISO_ENDPOINT=http://localhost:5001/graphql  # RBAC service
PERMISO_API_KEY=your-permiso-api-key  # Optional
FOREMAN_ENDPOINT=http://localhost:3000  # Workflow orchestration
FOREMAN_API_KEY=fmn_dev_default_key  # Required
```

### Multi-Tenant Setup

1. Create organization:
```sql
INSERT INTO organization (id, name, subdomain) 
VALUES ('acme', 'ACME Corp', 'acme');
```

2. Use subdomain in requests:
```bash
curl -X POST https://acme.your-domain.com/a2a/v1
```

3. Database automatically filters by organization via RLS

## Development Workflow

### Adding a New Package

1. Create package directory:
```bash
mkdir -p node/packages/shaman-newfeature/src
```

2. Add to build script:
```bash
# Edit build.sh, add to PACKAGES array:
PACKAGES=(
  # ... existing packages ...
  "shaman-newfeature"
)
```

3. Create package.json:
```json
{
  "name": "@codespin/shaman-newfeature",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "dependencies": {
    "@codespin/shaman-core": "file:../shaman-core"
  }
}
```

### Database Changes

```bash
# Create migration
npm run migrate:shaman:make add_new_feature

# Edit migration file in database/shaman/migrations/

# Run migration
npm run migrate:shaman:latest
```

### Testing Agents Locally

Use the CLI tool:
```bash
cd node/packages/shaman-cli
npm start -- run CustomerSupport "Help me with my order"
```

## Monitoring

### Check Workflow Status

```graphql
query {
  getRun(id: "run_abc123") {
    status
    steps {
      id
      stepType
      name
      status
      duration
    }
  }
}
```

### View Logs

All packages use structured logging:
```bash
# Set log level
export LOG_LEVEL=debug

# Pretty print logs in development
export LOG_PRETTY=true
```

### BullMQ Dashboard

Access queue monitoring:
```bash
npm install -g bull-board
bull-board -q step-execution -q async-polling
```

## Production Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && ./build.sh
CMD ["npm", "start"]
```

### Kubernetes

See example manifests in `/k8s` directory:
- `gql-server-deployment.yaml`
- `a2a-public-deployment.yaml`
- `a2a-internal-deployment.yaml`
- `worker-deployment.yaml`

### Health Checks

All servers expose health endpoints:
- GraphQL: `GET /health`
- A2A: `GET /a2a/v1/health`

## Troubleshooting

### Common Issues

**"Agent not found"**
- Check agent is in Git repository
- Verify repository is synced
- Check agent has `exposed: true` for external access

**"Step stuck in queued"**
- Ensure worker is running
- Check Redis connection
- Look for errors in worker logs

**"Webhook not received"**
- Verify webhook URL is accessible
- Check webhook_id matches
- Look for errors in A2A server logs

### Debug Mode

```bash
# Enable debug logging
export DEBUG=shaman:*
export LOG_LEVEL=debug

# Trace A2A calls
export A2A_TRACE_ENABLED=true
```