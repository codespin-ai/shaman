# Implementation Analysis: Current State vs. New Architecture

**NOTE: This document was written before the major refactoring that split servers. It's kept for historical reference.**

## Update (Post-Refactoring)

The architecture has been significantly refactored:

1. **Server Split Complete** ✅
   - `shaman-gql-server`: Pure GraphQL management API
   - `shaman-a2a-server`: All agent execution with --role support

2. **Workflow Unified** ✅
   - Single `shaman-workflow` package using BullMQ
   - Removed abstraction layer and multiple adapters

3. **Clear Separation** ✅
   - GraphQL server has NO execution capabilities
   - All execution goes through A2A protocol

## Original Analysis (Historical)

The original analysis identified these gaps which have now been addressed architecturally (though implementation is still needed):

## Detailed Analysis

### 1. Server Role Implementation ❌

**Documented Architecture:**
- Two distinct servers: `--role public` and `--role internal`
- Public server handles external traffic, authentication, GraphQL
- Internal server executes agents, not accessible from internet

**Current Implementation:**
- Single server mode only (shaman-server)
- No command-line argument parsing for --role flag in `start.ts`
- No role-based behavior differentiation
- Server starts on single port (default 4000) with all features
- Both `main.ts` and `simple-server.ts` lack role awareness

**Evidence from `/node/packages/shaman-server/src/start.ts`:
```typescript
// Lines 26-54: No role parsing, hardcoded single configuration
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '4000'),
  host: process.env.HOST || 'localhost',
  // ... no role configuration
};
```

**Gap:**
```typescript
// Current: No role handling
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '4000'),
  host: process.env.HOST || 'localhost',
  // ... no role configuration
};

// Needed: Role-based configuration
const role = process.argv.includes('--role') ? 
  process.argv[process.argv.indexOf('--role') + 1] : 
  undefined;

if (!role || !['public', 'internal'].includes(role)) {
  throw new Error('Server role must be specified with --role flag');
}
```

### 2. Agent-to-Agent Communication ❌

**Documented Architecture:**
- All agent calls use A2A protocol over HTTP
- Internal JWT tokens for authentication
- HTTP requests between internal servers

**Current Implementation:**
```typescript
// From agent-executor.ts line 278
if (dependencies.workflowEngine) {
  const childResult = await dependencies.workflowEngine.executeAgent({
    ...request,
    agentName: targetAgent,
    input: toolCall.input as string,
    parentStepId: request.parentStepId,
    depth: request.depth + 1
  });
}
```
- Direct function calls through workflow engine
- No HTTP requests for agent-to-agent communication
- No JWT token generation or validation

**Gap:**
- Need A2A HTTP client in agent-executor
- Need JWT token generation for internal calls
- Need to replace workflowEngine.executeAgent with HTTP calls

### 3. A2A Provider Implementation ✅ (Partial)

**Documented Architecture:**
- A2A endpoints for agent discovery and execution
- Support for both public and internal agent exposure
- Integrated into main server based on role

**Current Implementation:**
- `shaman-a2a-provider` package exists and implements A2A protocol correctly
- Proper endpoints: `/a2a/v1/agents` and `/a2a/v1/agents/:name/execute`
- Authentication middleware with bearer token support (lines 279-312 in a2a-server.ts)
- Rate limiting middleware (lines 317-351)
- Health check endpoint implemented (lines 219-255)

**Evidence from `/node/packages/shaman-a2a-provider/src/a2a-server.ts`:
```typescript
// Line 28-31: Proper A2A server creation
export function createA2AServer(
  config: A2AProviderConfig,
  agentsConfig: AgentsConfig
): express.Application
```

**Gap:**
- Not integrated into main server (no imports in main.ts or start.ts)
- No differentiation between public/internal exposure
- Runs as separate service via `standalone.js`, not part of main server
- Missing A2A client for agent-executor to use

### 4. JWT Token Infrastructure ❌

**Documented Architecture:**
- Internal JWT tokens for agent-to-agent calls
- Short-lived tokens (5 minutes)
- Contains workflow context, not user data

**Current Implementation:**
- Only a stub file exists: `/node/packages/shaman-security/src/auth/verify-jwt.ts`
- File contains only comments: "NOTE: Scaffold stub – replace with real implementation"
- No JWT token generation for internal calls
- A2A provider has token validation hooks but no actual JWT implementation
- No jsonwebtoken library in dependencies

**Evidence:**
- `verify-jwt.ts` is empty stub (lines 1-8)
- No A2A client implementation found
- No JWT generation code anywhere in codebase

**Gap:**
```typescript
// Needed: JWT token generation
function generateInternalJWT(context: WorkflowContext): string {
  return jwt.sign({
    iss: "shaman-public-server",
    aud: "shaman-internal-server",
    exp: Date.now() + 300000, // 5 minutes
    context: {
      tenantId: context.tenantId,
      runId: context.runId,
      parentTaskId: context.parentTaskId,
      depth: context.depth
    }
  }, INTERNAL_JWT_SECRET);
}
```

### 5. Deployment Configuration ❌

**Documented Architecture:**
- Separate environment variables for each role
- Different startup commands
- Network isolation between public/internal

**Current Implementation:**
- Single set of environment variables
- Single startup script (start.sh)
- No role-specific configuration

## Implementation Requirements

### Phase 1: Server Role Support
1. Add command-line argument parsing for --role flag
2. Create role-specific server configurations
3. Conditionally enable features based on role:
   - Public: GraphQL, external A2A, authentication
   - Internal: Agent execution, internal A2A, JWT validation

### Phase 2: A2A Integration
1. Integrate A2A provider into main server
2. Add A2A client to agent-executor
3. Replace workflowEngine.executeAgent with A2A HTTP calls
4. Implement JWT token generation and validation

### Phase 3: Deployment Updates
1. Update start scripts to support two servers
2. Create Docker Compose with both servers
3. Document environment variables for each role
4. Update build and deployment guides

### Phase 4: Security Implementation
1. Implement internal JWT token infrastructure
2. Add mutual TLS support (optional)
3. Implement proper network isolation
4. Add audit logging for A2A calls

## Code Changes Required

### 1. Server Start Script
```typescript
// start.ts modifications
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    role: { type: 'string' },
    port: { type: 'string' }
  }
});

if (!values.role || !['public', 'internal'].includes(values.role)) {
  throw new Error('Server role must be specified: --role public|internal');
}

const config = createServerConfig(values.role, values.port);
```

### 2. Agent Executor
```typescript
// Replace direct calls with A2A
import { A2AClient } from './a2a-client';

const a2aClient = new A2AClient({
  baseUrl: process.env.INTERNAL_SERVER_URL,
  jwtSecret: process.env.INTERNAL_JWT_SECRET
});

// Instead of workflowEngine.executeAgent
const result = await a2aClient.executeAgent({
  agentName: targetAgent,
  input: toolCall.input,
  context: generateInternalContext(request)
});
```

### 3. Server Configuration
```typescript
// Different configurations per role
function createServerConfig(role: 'public' | 'internal'): ServerConfig {
  if (role === 'public') {
    return {
      features: {
        graphql: true,
        externalA2A: true,
        agentExecution: false
      },
      auth: {
        kratos: true,
        jwt: false
      }
    };
  } else {
    return {
      features: {
        graphql: false,
        internalA2A: true,
        agentExecution: true
      },
      auth: {
        kratos: false,
        jwt: true
      }
    };
  }
}
```

## Migration Path

1. **Backward Compatibility**: Add --role flag but default to current behavior
2. **Gradual Migration**: Implement A2A client but keep workflow engine as fallback
3. **Testing**: Comprehensive tests for both modes
4. **Documentation**: Update all docs and examples
5. **Deployment**: Phased rollout with monitoring

## Implementation Status Summary

### ✅ Already Implemented
1. **A2A Provider Module** - Fully functional A2A server implementation
2. **Agent Resolution** - Unified agent resolution from Git repositories
3. **Tool Router** - Platform tools for workflow data management
4. **LLM Provider** - Vercel AI SDK integration with OpenAI/Anthropic

### ❌ Not Implemented (Critical Gaps)
1. **Server Role Support** - No --role flag, no role-based behavior
2. **A2A Client** - Missing HTTP client for agent-to-agent calls
3. **JWT Infrastructure** - Only empty stub files exist
4. **Server Integration** - A2A provider not integrated into main server
5. **Agent Executor Changes** - Still uses direct function calls

### 🔧 Partial Implementation
1. **Authentication** - Bearer token hooks exist but no JWT implementation
2. **Security Module** - Structure exists but mostly stubs

## Critical Path for Implementation

### Week 1: Foundation
1. Add --role flag parsing to server startup
2. Create role-based server configurations
3. Implement JWT token generation/validation
4. Add jsonwebtoken dependency

### Week 2: A2A Integration
1. Create A2A HTTP client module
2. Integrate A2A provider into main server
3. Update agent-executor to use A2A client
4. Add internal server URL configuration

### Week 3: Testing and Deployment
1. Create integration tests for two-server model
2. Update Docker configurations
3. Create deployment scripts
4. Update all documentation

## Conclusion

The current implementation requires significant changes to align with the documented architecture. The most critical gaps are:

1. **Server role differentiation** - Core functionality missing
2. **A2A protocol for internal agent calls** - Client not implemented
3. **JWT token infrastructure** - Only stubs exist
4. **Proper deployment configuration** - Single server only

These changes are fundamental to achieving the security and scalability benefits of the two-server architecture. The good news is that the A2A provider is already well-implemented; it just needs to be integrated and connected via an A2A client.