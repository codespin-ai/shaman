[← Previous: Overview & Concepts](./01-overview-and-concepts.md) | [🏠 Home](./README.md) | [Next: System Architecture →](./03-system-architecture.md)

---

# Use Cases and Agent Model

## Agent Types and Repository Structure

### Exposed vs Private Agents

Shaman distinguishes between two types of agents:

**Exposed Agents**: Accessible via public API endpoints at the organization's subdomain. These serve as entry points to workflows and can be called by external systems.

```markdown
---
name: "ProcessInvoice"
exposed: true  # This makes it an exposed agent
description: "Entry point for invoice processing workflows"
model: "gpt-4-turbo"
tags: ["finance", "public-api"]
---
```

**Private Agents**: Can only be called by other agents within the same repository. They have no public endpoints and are used for internal workflow steps.

```markdown
---
name: "ValidateInvoiceData"
exposed: false  # Or omit this field - agents are private by default
description: "Internal validation logic for invoice data"
model: "gpt-4-turbo"
tags: ["finance", "internal"]
---
```

### Repository Configuration with agents.json

Each repository includes an `agents.json` file that defines aliases for both external services and internal agents:

```json
{
  "TaxCalculator": {
    "url": "https://tax-service.com/a2a/agents/CalculateTax",
    "aliases": ["Tax", "TaxCalc"]
  },
  "ComplianceChecker": {
    "url": "compliance/legal/international/ComplianceChecker",
    "aliases": ["Compliance", "ComplianceCheck"]
  },
  "InvoiceValidator": {
    "url": "ValidateInvoiceData",
    "aliases": ["Validator"]
  }
}
```

This allows agents to use simple names regardless of whether the target is external or deeply nested internally.

## Enterprise Customer Support Automation

A large e-commerce company implements tiered customer support with intelligent escalation. The system uses exposed agents as entry points and private agents for internal processing.

### Repository Structure

```
customer-support-repo/
├── agents.json
├── Tier1Support/
│   └── prompt.md          # Exposed agent - customer entry point
├── BillingSpecialist/
│   └── prompt.md          # Private agent - internal escalation
├── RefundProcessor/
│   └── prompt.md          # Private agent - handles refunds
└── internal/
    ├── FraudChecker/
    │   └── prompt.md      # Private agent - fraud detection
    └── VIPHandler/
        └── prompt.md      # Private agent - VIP customer logic
```

### agents.json Configuration

```json
{
  "FraudDetector": {
    "url": "https://security.partner.com/a2a/agents/FraudCheck",
    "aliases": ["Fraud", "FraudCheck"]
  },
  "PaymentProcessor": {
    "url": "https://payments.internal.com/a2a/agents/Process"
  },
  "ComplianceAuditor": {
    "url": "internal/FraudChecker",
    "aliases": ["InternalFraud"]
  }
}
```

### Tier 1 Support Agent (Exposed)

````markdown
---
name: "Tier1Support"
exposed: true
description: "Customer-facing support agent for general inquiries"
version: "2.1.0"
tags: ["customer-support", "tier-1", "public"]
model: "gpt-4-turbo"
mcpServers:
  order-management:
    - "order_lookup"
    - "order_status"
  customer-db:
    - "customer_profile"
    - "account_history"
---

You are a Tier 1 Customer Support Agent. Help customers efficiently and escalate when needed.

## Available Tools

- **order_lookup**: Search for customer orders
- **order_status**: Get order status
- **customer_profile**: Get customer details
- **account_history**: View transaction history

## Agent Delegation

For billing issues, call BillingSpecialist
For refunds, call RefundProcessor
For VIP customers (>$10K annual), call internal/VIPHandler

Your task: {{prompt}}
````

### Execution Flow

```
Customer: "I want a refund for order #789"

1. Tier1Support (exposed) receives request
   → Calls order_lookup tool
   → Identifies VIP customer

2. Delegates to internal/VIPHandler (private)
   → VIPHandler checks customer value
   → Calls FraudDetector (external via alias)

3. FraudDetector returns clean result
   → VIPHandler calls RefundProcessor (private)

4. RefundProcessor processes refund
   → Returns success to VIPHandler
   → VIPHandler returns to Tier1Support

5. Tier1Support completes with customer response
```

## Software Development Workflow

A development team automates code review with security scanning. The system combines internal review processes with external security services.

### Repository Structure

```
dev-tools-repo/
├── agents.json
├── PRReviewer/
│   └── prompt.md          # Exposed - triggered by GitHub webhooks
├── SecurityScanner/
│   └── prompt.md          # Private - internal security checks
├── TestRunner/
│   └── prompt.md          # Private - runs test suites
└── deploy/
    └── StagingDeployer/
        └── prompt.md      # Private - handles deployments
```

### Code Review Agent (Exposed)

```markdown
---
name: "PRReviewer"
exposed: true
description: "Automated pull request reviewer"
version: "1.5.0"
tags: ["development", "code-review", "public-api"]
model: "gpt-4-turbo"
mcpServers:
  github:
    - "get_pr_diff"
    - "add_comment"
    - "update_status"
  sonarqube: "*"  # Full access to all SonarQube tools
---

You are a Senior Code Reviewer. Analyze PRs for quality and security.

## Review Process

1. Get PR details and diff
2. For security-sensitive code, delegate to SecurityScanner
3. For all code, delegate to TestRunner
4. Add review comments and update PR status

External security scanning available via "SecurityAuditor" (alias in agents.json)

Your task: {{prompt}}
```

### Multi-Stage Review Flow

```
GitHub Webhook: "New PR #456 in payment-service"

1. PRReviewer (exposed) activated
   → Calls get_pr_diff tool
   → Detects payment processing changes

2. Delegates to SecurityScanner (private)
   → SecurityScanner calls external "SecurityAuditor"
   → External service performs deep analysis
   → Returns security report

3. PRReviewer delegates to TestRunner (private)
   → TestRunner executes test suite
   → Returns coverage and results

4. PRReviewer synthesizes all results
   → Adds review comments via GitHub
   → Updates PR status
   → Completes workflow
```

## Multi-Organization Federation

Organizations share specialized agents while maintaining security boundaries. Each organization exposes select agents and consumes others via A2A protocol.

### Financial Services Organization

```
finserv-agents-repo/
├── agents.json
├── public/
│   ├── RiskCalculator/
│   │   └── prompt.md      # Exposed - available to partners
│   └── ComplianceValidator/
│       └── prompt.md      # Exposed - available to partners
└── internal/
    ├── CustomerAnalyzer/
    │   └── prompt.md      # Private - internal only
    └── FraudDetector/
        └── prompt.md      # Private - internal only
```

**agents.json**:
```json
{
  "AMLScreener": {
    "url": "https://regtech.partner.com/a2a/agents/AMLScreener",
    "aliases": ["AML"]
  },
  "KYCValidator": {
    "url": "https://regtech.partner.com/a2a/agents/KYCValidator"
  },
  "DataEnricher": {
    "url": "https://data-vendor.com/a2a/agents/Enrichment"
  }
}
```

### RegTech Partner Organization

```
regtech-agents-repo/
├── agents.json
├── public/
│   ├── AMLScreener/
│   │   └── prompt.md      # Exposed - available to clients
│   └── KYCValidator/
│       └── prompt.md      # Exposed - available to clients
└── proprietary/
    └── RiskEngine/
        └── prompt.md      # Private - secret sauce
```

### Cross-Organization Transaction Flow

```
FinServ receives: "Validate high-value transaction from new customer"

1. internal/CustomerAnalyzer (private) performs initial analysis
   → Determines need for enhanced due diligence

2. Calls external AMLScreener via alias
   → POST https://regtech.partner.com/a2a/agents/AMLScreener
   → RegTech's exposed agent performs screening
   → Returns risk scores

3. Calls external KYCValidator
   → POST https://regtech.partner.com/a2a/agents/KYCValidator
   → Validates customer identity
   → Returns verification status

4. public/RiskCalculator aggregates all data
   → Combines internal and external analysis
   → Produces final risk assessment
```

## Agent Resolution Process

When an agent calls another agent, Shaman follows this resolution process:

```typescript
// Agent makes a call
call_agent({ agent: "TaxCalculator", task: "Calculate tax for $1000" })

// Resolution steps:
1. Check agents.json for alias "TaxCalculator"
   → Found: { "url": "https://tax-service.com/a2a/agents/CalculateTax" }
   → Use this URL

2. If not in agents.json, check same repository
   → Look for TaxCalculator/prompt.md
   → Look for TaxCalculator.md

3. If not found locally, check external registry
   → Query registered external A2A services

4. If still not found, return error
```

### Calling Rules by Agent Type

**Exposed Agents**:
- Can call any private agent in same repository
- Can call external agents via full URL or alias
- Can be called from outside via public API

**Private Agents**:
- Can call other agents in same repository by name
- Can call external agents only via aliases in agents.json
- Cannot be called from outside the repository

This design ensures:
- Clear security boundaries
- Simple agent authoring (just use names/aliases)
- Flexible integration with external services
- Repository-level access control

---

**Navigation:**

- [← Previous: Overview & Concepts](./01-overview-and-concepts.md)
- [🏠 Home](./README.md)
- [Next: System Architecture →](./03-system-architecture.md)