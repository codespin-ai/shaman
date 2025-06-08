### 2.3 Agent Management Model

#### 2.3.1 Git-Based Agent Definitions

Agents are defined as markdown files with YAML frontmatter in git repositories:

```markdown
---
name: "CustomerSupportAgent"
description: "Handles customer inquiries about orders, returns, and account issues"
version: "2.1.0"
tags: ["customer-support", "tier-1", "orders"]
model: "gpt-4-turbo"
providers: ["openai_gpt4"]
mcpServers: ["order-management", "customer-db", "refund-processor"]
allowedAgents: ["BillingSpecialist", "EscalationManager"]
examples:
  - "Help customer with order status inquiry"
  - "Process return request for damaged item"
---

You are a Tier 1 Customer Support Agent for an e-commerce platform...

## Available Tools
Your tools will be automatically injected based on configured MCP servers.

## Available Agents
You can delegate to: {{allowed_agents}}

Your task: {{prompt}}
```

#### 2.3.2 Repository Structure and Namespacing

```
Root Repository (unnamespaced):
main-agents/
├── sales/pr-agent/prompt.md          → "sales/pr-agent"
├── support/billing-agent/prompt.md   → "support/billing-agent"
└── public/demo-agent/prompt.md       → "public/demo-agent"

Namespaced Repository:
experimental-agents/
├── nlp/sentiment/prompt.md           → "experimental/nlp/sentiment"  
└── vision/object-detect/prompt.md    → "experimental/vision/object-detect"
```

#### 2.3.3 Agent Resolution Strategy

1. **Root Repository Lookup:** Check unnamespaced agents first
2. **Namespaced Repository Lookup:** Parse namespace and check specific repository  
3. **External A2A Lookup:** Check registered external A2A agents
4. **Error:** Agent not found

#### 2.3.4 Explicit Completion Model

All agent-to-agent calls use **explicit completion**, where child agents must call a `complete_agent_execution` tool to signal task completion. This provides:

- **Clear Completion Semantics:** Parent agents know definitively when children are done
- **Structured Results:** Rich completion information including status, confidence, and metadata
- **Partial Completion Support:** Agents can signal partial completion when blocked or uncertain
- **Parent Coordination:** Parents wait for explicit completion before proceeding

## 2.4 Standard System Tools

All agents have automatic access to these system tools:

#### 2.4.1 Agent Coordination Tools

```typescript
interface AgentCoordinationTools {
  call_agent: {
    name: "call_agent",
    description: "Delegate a task to another specialized agent (internal or external)",
    schema: {
      type: "object",
      properties: {
        agent_name: { type: "string", description: "Name of agent to call (e.g., 'sales/pr-agent', 'external/legal-expert')" },
        input: { type: "string", description: "Task description for the agent" },
        context_scope: { 
          type: "string", 
          enum: ["FULL", "NONE", "SPECIFIC"],
          default: "FULL",
          description: "How much context to share with child agent"
        }
      },
      required: ["agent_name", "input"]
    }
  };
  
  complete_agent_execution: {
    name: "complete_agent_execution",
    description: "Signal completion of agent task - REQUIRED to finish execution",
    schema: {
      type: "object",
      properties: {
        result: { type: "string", description: "Final result of the task" },
        status: { 
          type: "string", 
          enum: ["SUCCESS", "PARTIAL", "FAILED"],
          description: "Completion status"
        },
        confidence: { 
          type: "number", 
          minimum: 0, 
          maximum: 1,
          description: "Confidence in the result (0-1)"
        },
        requiresFollowup: { 
          type: "boolean", 
          default: false,
          description: "Whether this task needs additional work"
        },
        metadata: { 
          type: "object", 
          description: "Additional structured data about the completion"
        }
      },
      required: ["result", "status"]
    }
  };
}
```

#### 2.4.2 User Interaction Tools

```typescript
interface UserInteractionTools {
  request_user_input: {
    name: "request_user_input",
    description: "Request input from user - pauses execution until response received",
    schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Question or prompt to show the user" },
        inputType: { 
          type: "string", 
          enum: ["text", "choice", "file", "approval"],
          default: "text",
          description: "Type of input expected"
        },
        choices: { 
          type: "array", 
          items: { type: "string" },
          description: "Available choices if inputType is 'choice'"
        },
        required: { 
          type: "boolean", 
          default: true,
          description: "Whether input is required to continue"
        },
        timeoutMinutes: {
          type: "number",
          default: 1440,
          description: "Minutes to wait before timing out"
        }
      },
      required: ["prompt"]
    }
  };
}
```

#### 2.4.3 Memory Management Tools

```typescript
interface MemoryManagementTools {
  save_memory: {
    name: "save_memory",
    description: "Save data for later retrieval across runs",
    schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Unique identifier for the data" },
        value: { type: "object", description: "Data to save (any JSON value)" },
        expiresAt: { type: "string", format: "date-time", description: "Optional expiration time" }
      },
      required: ["key", "value"]
    }
  };
  
  load_memory: {
    name: "load_memory", 
    description: "Retrieve previously saved data",
    schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Identifier of data to retrieve" }
      },
      required: ["key"]
    }
  };
}
```

## 5. Agent Repository Management

### 5.1 Git Repository Structure



#### 5.1.1 Agent Definition Format

```markdown
---
name: "SalesAssistant"
description: "Helps with sales inquiries and lead qualification"
version: "1.3.0"
tags: ["sales", "lead-qualification", "customer-engagement"]
model: "gpt-4-turbo"
providers: ["openai_gpt4", "anthropic_claude"]
mcpServers: ["crm-tools", "email-templates", "calendar-integration"] 
allowedAgents: ["sales/proposal-generator", "external/legal-reviewer"]
examples:
  - "Qualify this lead for our enterprise product"
  - "Generate a follow-up email for this prospect"
  - "Schedule a demo call with the customer"
contextScope: "FULL"
maxExecutionMinutes: 15
---

You are a Sales Assistant AI specialized in lead qualification and customer engagement.

## Your Role
- Qualify leads based on company criteria
- Generate personalized communications
- Schedule appropriate follow-up actions
- Escalate complex deals to human sales reps

## Available Tools
Your tools will be automatically injected based on your configured MCP servers:
- CRM operations (create/update leads, accounts)
- Email template generation and sending
- Calendar management and scheduling

## Available Agents
You can delegate specialized tasks to: {{allowed_agents}}

## Process Guidelines
1. Always gather basic qualification information first
2. Use sales/proposal-generator for complex RFPs
3. Use external/legal-reviewer for contract-related questions
4. Complete with next steps and confidence assessment

Your task: {{prompt}}
```

#### 5.1.2 Repository Structure Examples

**Root Repository (unnamespaced):**
```
main-agents/
├── sales/
│   ├── assistant/prompt.md              → "sales/assistant"
│   ├── proposal-generator/prompt.md     → "sales/proposal-generator" 
│   └── deal-analyzer/prompt.md          → "sales/deal-analyzer"
├── support/
│   ├── tier1/prompt.md                  → "support/tier1"
│   ├── billing/prompt.md                → "support/billing"
│   └── technical/prompt.md              → "support/technical"
├── legal/
│   ├── contract-review/prompt.md        → "legal/contract-review"
│   └── compliance/prompt.md             → "legal/compliance"
└── public/
    ├── demo-agent/prompt.md             → "public/demo-agent"
    └── api-helper/prompt.md             → "public/api-helper"
```

**Namespaced Repository:**
```
experimental-agents/
├── nlp/
│   ├── sentiment-analysis/prompt.md     → "experimental/nlp/sentiment-analysis"
│   └── text-classification/prompt.md   → "experimental/nlp/text-classification"
├── vision/
│   ├── object-detection/prompt.md       → "experimental/vision/object-detection"
│   └── image-analysis/prompt.md         → "experimental/vision/image-analysis"
└── research/
    ├── paper-analysis/prompt.md         → "experimental/research/paper-analysis"
    └── trend-detection/prompt.md        → "experimental/research/trend-detection"
```


### 5.2 Git Repository Configuration

```json
{
  "agentRepositories": [
    {
      "name": "main-agents",
      "gitUrl": "https://github.com/company/main-agents.git",
      "branch": "production",
      "isRoot": true,
      "syncInterval": "5m",
      "authType": "ssh-key",
      "sshKeyPath": "/secrets/git-deploy-key",
      "webhookSecret": "env(GIT_WEBHOOK_SECRET)",
      "isActive": true
    },
    {
      "name": "experimental",
      "gitUrl": "https://github.com/company/experimental-agents.git", 
      "branch": "main",
      "isRoot": false,
      "syncInterval": "15m",
      "authType": "token",
      "authToken": "env(GITHUB_TOKEN)",
      "isActive": true
    },
    {
      "name": "partner-shared", 
      "gitUrl": "https://github.com/partner/shared-agents.git",
      "branch": "stable",
      "isRoot": false,
      "syncInterval": "1h",
      "authType": "ssh-key",
      "sshKeyPath": "/secrets/partner-git-key",
      "isActive": true,
      "readOnly": true
    }
  ]
}
```
### 5.4 Agent Resolution Priority

```typescript
class AgentResolver {
  async resolveAgent(requestedName: string): Promise<ResolvedAgent> {
    // 1. Check root repositories first (unnamespaced access)
    for (const rootRepo of this.rootRepositories) {
      const agent = await this.findAgentInRepository(rootRepo, requestedName);
      if (agent) {
        return {
          agent: agent,
          source: 'git',
          repository: rootRepo.name,
          isNamespaced: false,
          priority: 'root'
        };
      }
    }
    
    // 2. Check namespaced repositories
    if (requestedName.includes('/')) {
      const parts = requestedName.split('/');
      
      // Try namespace/path pattern (e.g., "experimental/nlp/sentiment")
      for (let i = 1; i < parts.length; i++) {
        const namespace = parts.slice(0, i).join('/');
        const agentPath = parts.slice(i).join('/');
        
        const namespacedRepo = this.namedRepositories.get(namespace);
        if (namespacedRepo) {
          const agent = await this.findAgentInRepository(namespacedRepo, agentPath);
          if (agent) {
            return {
              agent: agent,
              source: 'git',
              repository: namespacedRepo.name,
              isNamespaced: true,
              priority: 'namespaced'
            };
          }
        }
      }
    }
    
    // 3. Check external A2A agents
    const externalAgent = await this.externalA2ARegistry.findAgent(requestedName);
    if (externalAgent) {
      return {
        agent: externalAgent,
        source: 'a2a',
        isNamespaced: false,
        priority: 'external'
      };
    }
    
    throw new AgentNotFoundError(
      `Agent "${requestedName}" not found in any git repository or external registry`
    );
  }
  
  async findAgentInRepository(repo: AgentRepository, agentPath: string): Promise<GitAgent | null> {
    const expectedFiles = [
      `${agentPath}/prompt.md`,
      `${agentPath}/agent.md`,
      `${agentPath}.md`
    ];
    
    for (const filePath of expectedFiles) {
      try {
        const content = await this.gitService.getFile(repo.name, filePath, repo.currentCommit);
        if (content) {
          return await this.parseAgentDefinition(repo, filePath, content);
        }
      } catch (error) {
        // File doesn't exist, try next
        continue;
      }
    }
    
    return null;
  }
}
```