# Shaman AI Agent Coordination Framework

## 1. Overview & Philosophy

Shaman is a comprehensive, enterprise-grade backend framework designed to be the central orchestration hub in a federated agent ecosystem. It serves simultaneously as:

- **Git-Based Agent Platform:** A robust platform for managing AI agents as code through git repositories, enabling version control, collaboration, and deployment workflows.
- **A2A Gateway:** A fully compliant Agent2Agent (A2A) protocol implementation that can both expose internal git-based agents and consume external A2A agents.
- **Enterprise Control Plane:** A manageable, observable, and scalable system with git synchronization, permissions, and comprehensive audit trails.

### Core Principles:

- **Agents as Code:** AI agents are defined in git repositories as markdown files with frontmatter, enabling familiar development workflows.
- **Protocol Interoperability:** Native support for MCP (Model Context Protocol) and A2A (Agent2Agent) standards.
- **Bidirectional Federation:** Internal git-based agents can be exposed via A2A while consuming external A2A agents seamlessly.
- **Dynamic Execution:** Workflows unfold dynamically based on agent decisions, forming complex DAGs at runtime.
- **Pluggable Infrastructure:** All critical components (workflow engines, providers, storage) are swappable via adapter patterns.
- **Observable by Design:** OpenTelemetry-first architecture with structured logging and comprehensive metrics.
- **Enterprise-Ready:** Built-in support for git synchronization, agent namespacing, authentication, authorization, and audit trails.
- **Explicit Agent Completion:** Agents explicitly signal completion using standardized tools, enabling reliable parent-child coordination.
- **Unified Tool/Agent Interface:** Agents call both tools and other agents through the same mechanism, providing a consistent programming model.

## 3. Use Cases & Application Scenarios

### 3.1 Enterprise Customer Support Automation

**Scenario:** A large e-commerce company wants to automate customer support inquiries while maintaining human oversight for complex issues.

**Git Repository Structure:**
```
main-agents/
├── support/tier1-agent/prompt.md
├── support/billing-specialist/prompt.md
└── support/escalation-manager/prompt.md
```

**Agent Definition (support/tier1-agent/prompt.md):**
```markdown
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
  "tool_calls": [{
    "id": "call_billing",
    "type": "function",
    "function": {
      "name": "call_agent",
      "arguments": "{\"agent_name\": \"support/billing-specialist\", \"input\": \"Customer wants refund for 95-day-old order but is VIP with $50K annual spend\"}"
    }
  }]
}
```

## Completion Requirement
You MUST complete your work by calling:
```json
{
  "tool_calls": [{
    "id": "complete",
    "type": "function", 
    "function": {
      "name": "complete_agent_execution",
      "arguments": "{\"result\": \"Your summary of actions taken\", \"status\": \"SUCCESS\", \"confidence\": 0.9}"
    }
  }]
}
```

Your task: {{prompt}}
```

**Execution Flow:**
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

### 3.2 Software Development Workflow with External Integration

**Scenario:** A development team wants to automate code review processes using internal agents plus external specialized services.

**Repository Structure:**
```
dev-agents/
├── code/pr-reviewer/prompt.md
├── code/test-runner/prompt.md
└── deploy/staging-manager/prompt.md
```

**External Agent Registration:**
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
```

**Agent Definition (code/pr-reviewer/prompt.md):**
```markdown
---
name: "CodeReviewer"
description: "Reviews pull requests for code quality, security issues, and best practices"
version: "1.5.0"
tags: ["development", "code-review", "security"]
model: "gpt-4-turbo"
providers: ["openai_gpt4"]
mcpServers: ["github", "sonarqube"]
allowedAgents: ["code/test-runner", "deploy/staging-manager", "external/security-auditor"]
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

**Multi-System Execution:**
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

### 3.3 Legal Document Analysis with Federated Expertise

**Scenario:** A company needs comprehensive contract analysis using both internal knowledge and external legal expertise.

**Repository Structure:**
```
main-agents/
├── legal/contract-coordinator/prompt.md
├── legal/compliance-checker/prompt.md
└── legal/risk-assessor/prompt.md

partner-agents/ (external A2A registrations)
└── external/specialized-legal-ai
```

**Multi-Repository Agent Coordination:**
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

### 3.4 Cross-Organization Agent Federation

**Scenario:** Multiple organizations want to share specialized agents while maintaining security boundaries.

**Organization A (Financial Services):**
```
Exposes via A2A:
- public/risk-calculator
- public/compliance-validator

Consumes externally:  
- partner-bank/fraud-detector
- regtech-vendor/aml-screener
```

**Organization B (RegTech Vendor):**
```
Exposes via A2A:
- public/aml-screener  
- public/kyc-validator

Consumes externally:
- finserv-partner/risk-calculator
- data-vendor/sanctions-checker
```

**Configuration Example:**
```json
{
  "agentRepositories": [
    {
      "name": "main-agents",
      "gitUrl": "https://github.com/company/agents.git",
      "isRoot": true,
      "branch": "production"
    }
  ],
  
  "agentExposure": {
    "allowedPrefixes": ["public/"],
    "securitySchemes": {
      "oauth2": {
        "type": "oauth2",
        "flows": {
          "clientCredentials": {
            "tokenUrl": "https://auth.company.com/oauth/token"
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
        "clientId": "company-integration",
        "clientSecret": "env(PARTNER_BANK_SECRET)"
      }
    }
  }
}
```
