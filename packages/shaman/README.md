# Shaman - AI Agent Coordination Framework

A comprehensive backend framework for managing AI agents as code through git repositories while enabling seamless Agent2Agent (A2A) protocol federation.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## 📖 Documentation

See the [specification documents](./spec/) for comprehensive documentation:

- [01 - Introduction](./spec/01-introduction.md)
- [02 - Getting Started](./spec/02-getting-started.md)
- [03 - System Architecture](./spec/03-system-architecture.md)
- [04 - API, Config & Deployment](./spec/04-api-config-and-deployment.md)
- [05 - GraphQL API Specification](./spec/05-graphql-api-spec.md)
- [06 - Agent Definition Guide](./spec/06-agent-definition.md)
- [07 - A2A Protocol Specification](./spec/07-a2a-protocol-spec.md)

## 🏗️ Architecture

Shaman uses a **functional programming approach** with ESM TypeScript:

- **No Classes** - Pure functions and data transformations
- **ESM Modules** - Modern ES modules with `.js` import extensions
- **Strong Typing** - Comprehensive TypeScript types and validation
- **Pluggable Components** - Swappable workflow engines, providers, storage

### Core Tiers

1. **Control Plane** - GraphQL API and A2A Gateway
2. **Execution Plane** - Pluggable workflow engines (BullMQ, Temporal.io)
3. **Execution Units** - Worker processes for agent execution

## 🔧 Configuration

Configuration is loaded from JSON files with environment variable overrides:

```bash
# Copy example configs
cp config/development.json.example config/development.json
cp config/production.json.example config/production.json

# Set environment
export NODE_ENV=development
export DATABASE_URL=postgresql://...
export REDIS_URL=redis://...
```

## 🐳 Docker

```bash
# Build and run with Docker Compose
npm run docker:build
npm run docker:run
```

## 🧪 Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Integration tests
npm run test:integration
```

## 🔒 Security

Shaman includes comprehensive security features:

- JWT and API key authentication
- Role-based access control (RBAC)
- Policy-based authorization
- Rate limiting and CORS protection
- Secure agent-to-agent communication

## 📊 Observability

- **Logging** - Structured JSON logging with Pino
- **Metrics** - Prometheus-compatible metrics
- **Tracing** - OpenTelemetry distributed tracing
- **Health Checks** - Built-in health and readiness endpoints

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Note**: This project uses ESM (ES Modules) and requires Node.js 18+
