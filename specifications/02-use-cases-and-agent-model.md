[← Previous: Overview & Concepts](./01-overview-and-concepts.md) | [🏠 Home](./README.md) | [Next: System Architecture →](./03-system-architecture.md)

---

# Use Cases and Agent Model

## Enterprise Customer Support Automation

A large e-commerce company wants to automate customer support inquiries while maintaining human oversight for complex issues. The system uses a tiered approach where a general support agent handles common inquiries and escalates specialized issues to expert agents.

### Git Repository Structure

```
main-agents/
├── support/tier1-agent/prompt.md
├── support/billing-specialist/prompt.md
└── support/escalation-manager/prompt.md
```

### Agent Definition Example

The tier 1 support agent handles the initial customer contact:

````markdown
---
name: "Tier1CustomerSupport"
description: "Handles common customer inquiries about orders, returns, and account issues"
version: "2.1.0"
tags: ["customer-support", "tier-1", "e-commerce"]
model: "gpt-4-turbo"
providers: ["openai_gpt4"]
mcpServers: ["order-management", "customer-db", "refund-processor"]
allowedAgents: ["support/billing-specialist", "support/escalation-manager"]
examples:
  - "Customer wants to check order status"
  - "Process return for damaged product"
  - "Help with billing inquiry"
---

You are a Tier 1 Customer Support Agent for an e-commerce platform. Your role is to help customers with their inquiries efficiently and escalate complex issues when needed.

## Available Tools

You have access to these tools:

- **order_lookup**: Search for customer orders by ID or customer info
- **customer_profile**: Get customer account details and history
- **refund_processor**: Process standard refunds within policy

## Available Agents

You can delegate to these specialists:

- **support/billing-specialist**: For complex billing issues, payment problems, or policy exceptions
- **support/escalation-manager**: For VIP customers or sensitive complaints

## Agent Calling Examples

To delegate a billing issue:

```json
{
  "tool_calls": [
    {
      "id": "call_billing",
      "type": "function",
      "function": {
        "name": "call_agent",
        "arguments": "{\"agent_name\": \"support/billing-specialist\", \"input\": \"Customer wants refund for 95-day-old order but is VIP with $50K annual spend\"}"
      }
    }
  ]
}
```
````

## Completion Requirement

You MUST complete your work by calling:

```json
{
  "tool_calls": [
    {
      "id": "complete",
      "type": "function",
      "function": {
        "name": "complete_agent_execution",
        "arguments": "{\"result\": \"Your summary of actions taken\", \"status\": \"SUCCESS\", \"confidence\": 0.9}"
      }
    }
  ]
}
```

Your task: {{prompt}}

```

### Complete Execution Flow

```

Customer: "I want to cancel order #ORDER-789 and get a refund"

1. Tier1Agent calls order_lookup tool:
   → Gets order details: $299, placed 95 days ago

2. Tier1Agent calls customer_profile tool:  
   → Customer is VIP with $50K annual spend

3. Tier1Agent recognizes policy exception needed, calls agent:
   {
   "name": "call_agent",
   "arguments": {
   "agent_name": "support/billing-specialist",
   "input": "VIP customer John Smith wants refund for order #ORDER-789. Order is 95 days old (exceeds 90-day policy) but customer has $50K annual spend. Please evaluate exception."
   }
   }

4. BillingSpecialist analyzes case, requests approval:
   {
   "name": "request_user_input",
   "arguments": {
   "prompt": "Customer exceeds refund policy but is VIP. Approve exception?",
   "inputType": "choice",
   "choices": ["Approve full refund", "Offer store credit", "Deny exception"]
   }
   }

5. Human responds: "Approve full refund"

6. BillingSpecialist processes refund and completes:
   {
   "name": "complete_agent_execution",
   "arguments": {
   "result": "Full refund of $299.99 approved and processed. Refund ID: REF-456789",
   "status": "SUCCESS",
   "confidence": 1.0
   }
   }

7. Tier1Agent receives completion, sends final response:
   {
   "name": "complete_agent_execution",
   "arguments": {
   "result": "Order #ORDER-789 has been cancelled and full refund of $299.99 processed. You'll see the refund in 3-5 business days. Refund tracking: REF-456789",
   "status": "SUCCESS",
   "confidence": 0.95
   }
   }

```

## Software Development Workflow with External Integration

A development team automates code review processes using internal agents plus external specialized services. The system combines internal knowledge with external expertise for comprehensive analysis.

### Repository Structure

```

dev-agents/
├── code/pr-reviewer/prompt.md
├── code/test-runner/prompt.md
└── deploy/staging-manager/prompt.md

````

### External Agent Registration

External security analysis is provided by a partner service:

```graphql
mutation RegisterExternalSecurityAgent {
  createMcpServer(input: {
    name: "ExternalSecurityAuditor"
    description: "External security analysis service"
    type: A2A
    endpoint: "https://security-ai.partner.com/a2a/v1"
    apiKey: "encrypted-partner-key"
  }) {
    id
    discoveredAgents {
      name        # "external/security-auditor"
      description
    }
  }
}
````

### Code Review Agent Definition

```markdown
---
name: "CodeReviewer"
description: "Reviews pull requests for code quality, security issues, and best practices"
version: "1.5.0"
tags: ["development", "code-review", "security"]
model: "gpt-4-turbo"
providers: ["openai_gpt4"]
mcpServers: ["github", "sonarqube"]
allowedAgents:
  ["code/test-runner", "deploy/staging-manager", "external/security-auditor"]
examples:
  - "Review PR #123 for security vulnerabilities"
  - "Analyze code quality in payment module"
---

You are a Senior Code Reviewer responsible for maintaining code quality and security standards.

## Available Tools

- **github_get_pr**: Get pull request details and diff
- **sonarqube_scan**: Run code quality analysis
- **github_add_comment**: Add review comments

## Available Agents

- **code/test-runner**: Execute comprehensive test suites
- **deploy/staging-manager**: Handle staging deployments
- **external/security-auditor**: External security analysis service

## Review Process

1. Analyze code changes thoroughly
2. For security-sensitive changes, delegate to external/security-auditor
3. If code passes review, delegate to code/test-runner
4. Complete with approval/rejection decision

Your task: {{prompt}}
```

### Multi-System Execution Flow

```
Request: "Review pull request #456 in payment-service repository"

1. CodeReviewer calls github_get_pr tool
   → Retrieves PR diff and details

2. CodeReviewer notices payment processing code, calls external agent:
   {
     "name": "call_agent",
     "arguments": {
       "agent_name": "external/security-auditor",
       "input": "Please audit the payment processing changes in PR #456. Focus on PCI compliance and data handling."
     }
   }

3. External security service processes via A2A protocol:
   POST https://security-ai.partner.com/a2a/v1
   {
     "method": "message/send",
     "params": {
       "message": {
         "role": "user",
         "parts": [{"kind": "text", "text": "Please audit..."}]
       }
     }
   }

4. External service completes and returns A2A task:
   {
     "id": "task-external-123",
     "status": {"state": "completed"},
     "artifacts": [{
       "parts": [{"kind": "text", "text": "Security audit passed. No PCI violations found..."}]
     }]
   }

5. CodeReviewer receives completion, calls internal test runner:
   {
     "name": "call_agent",
     "arguments": {
       "agent_name": "code/test-runner",
       "input": "Run full test suite for payment-service PR #456"
     }
   }

6. TestRunner executes and completes:
   {
     "name": "complete_agent_execution",
     "arguments": {
       "result": "All 247 tests passed. Coverage: 94.2%",
       "status": "SUCCESS",
       "confidence": 1.0
     }
   }

7. CodeReviewer calls github_add_comment and completes:
   {
     "name": "complete_agent_execution",
     "arguments": {
       "result": "PR #456 approved. External security audit passed, all tests passing. Ready for merge.",
       "status": "SUCCESS",
       "confidence": 0.95
     }
   }
```

## Legal Document Analysis with Federated Expertise

A company needs comprehensive contract analysis using both internal knowledge and external legal expertise. The system coordinates multiple specialized agents to provide thorough analysis.

### Repository Structure

```
main-agents/
├── legal/contract-coordinator/prompt.md
├── legal/compliance-checker/prompt.md
└── legal/risk-assessor/prompt.md

partner-agents/ (external A2A registrations)
└── external/specialized-legal-ai
```

### Multi-Repository Agent Coordination

```
Request: "Analyze this NDA for potential risks and compliance issues"

1. legal/contract-coordinator (internal git agent):
   - Initial document analysis
   - Calls legal/compliance-checker (same repo)
   - Calls legal/risk-assessor (same repo)

2. For specialized legal expertise, calls external agent:
   {
     "name": "call_agent",
     "arguments": {
       "agent_name": "external/specialized-legal-ai",
       "input": "Provide expert legal analysis of this NDA focusing on IP protection and liability clauses"
     }
   }

3. External A2A agent processes request:
   - Receives A2A message via HTTPS
   - Performs specialized legal analysis
   - Returns structured legal opinion

4. Internal coordinator combines all analysis:
   - Internal compliance check results
   - Internal risk assessment
   - External expert legal opinion
   - Generates comprehensive recommendation
```

## Cross-Organization Agent Federation

Multiple organizations share specialized agents while maintaining security boundaries. This enables collaborative AI ecosystems where organizations can both contribute and consume specialized capabilities.

### Organization A Configuration (Financial Services)

```json
{
  "agentRepositories": [
    {
      "name": "main-agents",
      "gitUrl": "https://github.com/finserv/agents.git",
      "isRoot": true,
      "branch": "production"
    }
  ],

  "agentExposure": {
    "allowedPrefixes": ["public/"],
    "exposedAgents": ["public/risk-calculator", "public/compliance-validator"],
    "securitySchemes": {
      "oauth2": {
        "type": "oauth2",
        "flows": {
          "clientCredentials": {
            "tokenUrl": "https://auth.finserv.com/oauth/token"
          }
        }
      }
    }
  },

  "externalAgents": {
    "partner-bank": {
      "endpoint": "https://agents.partner-bank.com/a2a/v1",
      "authentication": {
        "type": "oauth2",
        "clientId": "finserv-integration",
        "clientSecret": "env(PARTNER_BANK_SECRET)"
      }
    },
    "regtech-vendor": {
      "endpoint": "https://agents.regtech-vendor.com/a2a/v1",
      "authentication": {
        "type": "apiKey",
        "apiKey": "env(REGTECH_API_KEY)"
      }
    }
  }
}
```

### Organization B Configuration (RegTech Vendor)

```json
{
  "agentRepositories": [
    {
      "name": "compliance-agents",
      "gitUrl": "https://github.com/regtech/agents.git",
      "isRoot": true,
      "branch": "stable"
    }
  ],

  "agentExposure": {
    "allowedPrefixes": ["public/"],
    "exposedAgents": ["public/aml-screener", "public/kyc-validator"],
    "securitySchemes": {
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      }
    }
  },

  "externalAgents": {
    "finserv-partner": {
      "endpoint": "https://agents.finserv.com/a2a/v1",
      "authentication": {
        "type": "oauth2",
        "clientId": "regtech-integration",
        "clientSecret": "env(FINSERV_SECRET)"
      }
    },
    "data-vendor": {
      "endpoint": "https://agents.data-vendor.com/a2a/v1",
      "authentication": {
        "type": "apiKey",
        "apiKey": "env(DATA_VENDOR_KEY)"
      }
    }
  }
}
```

### Cross-Organization Execution Flow

```
Organization A agent receives: "Screen this transaction for AML violations"

1. internal/transaction-analyzer processes basic transaction data
2. Calls external/regtech-vendor/aml-screener:
   → POST https://agents.regtech-vendor.com/a2a/v1
   → Specialized AML analysis performed
   → Returns risk score and violation flags

3. Based on results, calls partner-bank/fraud-detector:
   → POST https://agents.partner-bank.com/a2a/v1
   → Cross-references transaction patterns
   → Returns fraud probability assessment

4. Combines all analysis:
   → Internal transaction processing
   → External AML screening results
   → Partner fraud detection results
   → Returns comprehensive compliance assessment
```

## Repository Configuration Schema

### Agent Repository Definition

```typescript
interface AgentRepository {
  name: string; // Unique repository identifier
  gitUrl: string; // Git repository URL
  branch: string; // Git branch to track
  isRoot: boolean; // Whether agents are unnamespaced
  syncInterval: string; // How often to sync (e.g., "5m")
  authType: "ssh-key" | "token" | "none";
  sshKeyPath?: string; // Path to SSH private key
  authToken?: string; // GitHub/GitLab token (env var)
  webhookSecret?: string; // Webhook validation secret
  readOnly: boolean; // Whether repository is read-only
  isActive: boolean; // Whether repository is active
}
```

### Git Synchronization API Types

```typescript
interface SyncResult {
  repositoryName: string;
  success: boolean;
  syncedCommit: string;
  discoveredAgents: GitAgent[];
  syncErrors: SyncError[];
  syncDuration: number;
}

interface SyncError {
  message: string;
  filePath?: string;
  timestamp: Date;
  errorType: string;
}

interface GitAgent {
  name: string;
  description: string;
  version: string;
  tags: string[];

  // Git metadata
  repositoryName: string;
  filePath: string;
  gitCommit: string;
  lastModified: Date;

  // Configuration
  model?: string;
  providers: string[];
  mcpServers: string[];
  allowedAgents: string[];
  examples: string[];
}
```

### Agent Resolver Implementation

```typescript
class GitAgentResolver {
  private rootRepositories: Map<string, AgentRepository>;
  private namedRepositories: Map<string, AgentRepository>;
  private externalA2ARegistry: ExternalA2ARegistry;

  async resolveAgent(agentName: string): Promise<ResolvedAgent> {
    // 1. Check root repositories first (unnamespaced)
    for (const [repoName, repo] of this.rootRepositories) {
      const agent = await this.findAgentInRepo(repo, agentName);
      if (agent) {
        return {
          agent: agent,
          source: "git",
          repository: repoName,
          isNamespaced: false,
          priority: "root",
        };
      }
    }

    // 2. Check namespaced repositories
    if (agentName.includes("/")) {
      const parts = agentName.split("/");

      for (let i = 1; i < parts.length; i++) {
        const namespace = parts.slice(0, i).join("/");
        const agentPath = parts.slice(i).join("/");

        const namespacedRepo = this.namedRepositories.get(namespace);
        if (namespacedRepo) {
          const agent = await this.findAgentInRepo(namespacedRepo, agentPath);
          if (agent) {
            return {
              agent: agent,
              source: "git",
              repository: namespacedRepo.name,
              isNamespaced: true,
              priority: "namespaced",
            };
          }
        }
      }
    }

    // 3. Check external A2A agents
    const externalAgent = await this.externalA2ARegistry.findAgent(agentName);
    if (externalAgent) {
      return {
        agent: externalAgent,
        source: "a2a",
        isNamespaced: false,
        priority: "external",
      };
    }

    throw new AgentNotFoundError(`Agent "${agentName}" not found`);
  }

  private async findAgentInRepo(
    repo: AgentRepository,
    agentPath: string
  ): Promise<GitAgent | null> {
    const possiblePaths = [
      `${agentPath}/prompt.md`,
      `${agentPath}/agent.md`,
      `${agentPath}.md`,
    ];

    for (const filePath of possiblePaths) {
      try {
        const content = await this.gitService.getFile(
          repo.name,
          filePath,
          repo.currentCommit
        );
        if (content) {
          return await this.parseAgentDefinition(repo, filePath, content);
        }
      } catch (error) {
        continue; // Try next file path
      }
    }

    return null;
  }
}
```

---

**Navigation:**

- [← Previous: Overview & Concepts](./01-overview-and-concepts.md)
- [🏠 Home](./README.md)
- [Next: System Architecture →](./03-system-architecture.md)
