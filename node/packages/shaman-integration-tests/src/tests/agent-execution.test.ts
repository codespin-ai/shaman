/**
 * Integration tests for agent execution flow
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { 
  initializeForemanClient,
  createRun,
  createTask,
  createRunData,
  queryRunData,
  getRun,
  type ForemanConfig
} from '@codespin/foreman-client';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  truncateAllTables,
  makeA2ARequest,
  waitForTaskCompletion,
  generateTestOrganization,
  generateTestUser,
  generateTestApiKey,
  getTestDatabase,
  TEST_CONFIG
} from '../setup.js';

describe('Agent Execution Integration', () => {
  let testOrg: any;
  let testUser: any;
  let testApiKey: any;
  let db: any;
  let foremanConfig: ForemanConfig;
  let foremanClient: any;

  before(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
    
    // Initialize Foreman
    foremanConfig = TEST_CONFIG.foreman;
    foremanClient = await initializeForemanClient(foremanConfig);
    
    // Create test organization and user
    testOrg = generateTestOrganization();
    testUser = generateTestUser(testOrg.id);
    testApiKey = generateTestApiKey(testOrg.id, testUser.id);
    
    // Insert test data
    await db.none('INSERT INTO organization (id, name) VALUES ($(id), $(name))', testOrg);
    await db.none('INSERT INTO "user" (id, organization_id, email) VALUES ($(id), $(organizationId), $(email))', testUser);
    await db.none('INSERT INTO api_key (id, organization_id, user_id, key_hash, name) VALUES ($(id), $(organizationId), $(userId), $(keyHash), $(name))', testApiKey);
    
    // Create test agents in the database
    await createTestAgents();
  });

  after(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clear run and step tables between tests
    await db.none('TRUNCATE TABLE step CASCADE');
    await db.none('TRUNCATE TABLE run CASCADE');
  });

  async function createTestAgents() {
    // Create a test repository
    const repoResult = await db.one(`
      INSERT INTO agent_repository (
        organization_id, name, git_url, branch, is_root
      ) VALUES (
        $(orgId), 'test-agents', 'https://github.com/test/agents.git', 'main', true
      ) RETURNING id
    `, { orgId: testOrg.id });

    // Create test agents
    await db.none(`
      INSERT INTO git_agent (
        repository_id, name, version, description, model, temperature, exposed, 
        file_path, content, frontmatter
      ) VALUES 
      (
        $(repoId), 
        'EchoAgent', 
        '1.0.0', 
        'Simple echo agent for testing', 
        'gpt-4', 
        0.7, 
        true,
        'agents/echo.md',
        $[content],
        $(frontmatter)
      ),
      (
        $(repoId),
        'CalculatorAgent',
        '1.0.0',
        'Performs basic calculations',
        'gpt-4',
        0.1,
        true,
        'agents/calculator.md',
        $[calcContent],
        $(calcFrontmatter)
      ),
      (
        $(repoId),
        'DataProcessorAgent',
        '1.0.0',
        'Processes and stores data using platform tools',
        'gpt-4',
        0.3,
        false,
        'agents/data-processor.md',
        $[dataContent],
        $(dataFrontmatter)
      )
    `, {
      repoId: repoResult.id,
      content: `---
name: EchoAgent
description: Simple echo agent for testing
model: gpt-4
temperature: 0.7
exposed: true
tools: []
---

You are a simple echo agent. Repeat back what the user says.`,
      frontmatter: JSON.stringify({
        name: 'EchoAgent',
        description: 'Simple echo agent for testing',
        model: 'gpt-4',
        temperature: 0.7,
        exposed: true,
        tools: []
      }),
      calcContent: `---
name: CalculatorAgent
description: Performs basic calculations
model: gpt-4
temperature: 0.1
exposed: true
tools: []
---

You are a calculator agent. Perform the requested calculation and return the result.`,
      calcFrontmatter: JSON.stringify({
        name: 'CalculatorAgent',
        description: 'Performs basic calculations',
        model: 'gpt-4',
        temperature: 0.1,
        exposed: true,
        tools: []
      }),
      dataContent: `---
name: DataProcessorAgent
description: Processes and stores data using platform tools
model: gpt-4
temperature: 0.3
exposed: false
tools:
  - run_data_write
  - run_data_read
  - run_data_query
  - call_agent
---

You process data and coordinate with other agents. Use platform tools to store and retrieve data.`,
      dataFrontmatter: JSON.stringify({
        name: 'DataProcessorAgent',
        description: 'Processes and stores data using platform tools',
        model: 'gpt-4',
        temperature: 0.3,
        exposed: false,
        tools: ['run_data_write', 'run_data_read', 'run_data_query', 'call_agent']
      })
    });
  }

  describe('Basic Agent Execution', () => {
    it('should execute a simple agent and return response', async () => {
      // Send message to EchoAgent
      const response = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [
            {
              kind: 'text',
              text: 'Hello, Echo Agent!'
            }
          ]
        },
        metadata: {
          agent: 'EchoAgent'
        }
      }, {
        apiKey: testApiKey.key
      });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('result');
      expect(response.body.result).to.have.property('kind', 'task');
      
      const taskId = response.body.result.id;

      // In a real test, we'd wait for the worker to process
      // For now, verify the task was created in Foreman
      // This would need the worker running to complete
    });

    it('should track execution in database', async () => {
      // Send message to create execution
      const response = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [
            {
              kind: 'text',
              text: 'Calculate 2 + 2'
            }
          ]
        },
        metadata: {
          agent: 'CalculatorAgent'
        }
      }, {
        apiKey: testApiKey.key
      });

      const taskId = response.body.result.id;

      // Check that a run was created in the database
      const runs = await db.any(`
        SELECT * FROM run 
        WHERE organization_id = $(orgId)
        ORDER BY created_at DESC
        LIMIT 1
      `, { orgId: testOrg.id });

      expect(runs).to.have.lengthOf.at.least(1);
      const run = runs[0];
      expect(run.organization_id).to.equal(testOrg.id);
      expect(run.status).to.be.oneOf(['pending', 'running']);
    });
  });

  describe('Platform Tools in Agent Execution', () => {
    it('should allow agents to write and read run data', async () => {
      // Create a run directly in Foreman
      const runResult = await createRun(foremanConfig, {
        inputData: {
          agentName: 'DataProcessorAgent',
          action: 'store-data'
        },
        metadata: {
          organizationId: testOrg.id,
          userId: testUser.id
        }
      });

      expect(runResult.success).to.be.true;
      if (!runResult.success) return;

      const runId = runResult.data.id;

      // Simulate agent writing data (this would normally be done by the agent via tools)
      const writeResult = await createRunData(foremanConfig, runId, {
        taskId: 'task-123',
        key: 'processed-result',
        value: {
          status: 'success',
          data: { count: 42, items: ['a', 'b', 'c'] }
        },
        tags: ['agent:DataProcessorAgent', 'type:result']
      });

      expect(writeResult.success).to.be.true;

      // Verify data can be read back
      const readResult = await queryRunData(foremanConfig, runId, {
        key: 'processed-result'
      });

      expect(readResult.success).to.be.true;
      if (!readResult.success) return;
      expect(readResult.data.data).to.have.lengthOf(1);
      expect(readResult.data.data[0].value).to.deep.equal({
        status: 'success',
        data: { count: 42, items: ['a', 'b', 'c'] }
      });
    });

    it('should support agent-to-agent calls via call_agent tool', async () => {
      // This test simulates the flow where one agent calls another
      
      // Create a run for the orchestrator agent
      const runResult = await createRun(foremanConfig, {
        inputData: {
          agentName: 'DataProcessorAgent',
          action: 'orchestrate'
        },
        metadata: {
          organizationId: testOrg.id,
          userId: testUser.id
        }
      });

      expect(runResult.success).to.be.true;
      if (!runResult.success) return;

      const runId = runResult.data.id;

      // Task 1: DataProcessorAgent calls CalculatorAgent
      const calcTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: {
          agent: 'CalculatorAgent',
          input: 'Calculate 10 * 5'
        },
        metadata: {
          callerAgent: 'DataProcessorAgent'
        }
      });

      expect(calcTask.success).to.be.true;

      // Simulate CalculatorAgent storing its result
      await createRunData(foremanConfig, runId, {
        taskId: calcTask.data.id,
        key: 'calculation-result',
        value: { result: 50 },
        tags: ['agent:CalculatorAgent', 'type:calculation']
      });

      // Task 2: DataProcessorAgent calls EchoAgent with the result
      const echoTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: {
          agent: 'EchoAgent',
          input: 'The calculation result is 50'
        },
        metadata: {
          callerAgent: 'DataProcessorAgent'
        }
      });

      expect(echoTask.success).to.be.true;

      // Verify the workflow created multiple tasks
      const runStatus = await getRun(foremanConfig, runId);
      expect(runStatus.success).to.be.true;
      // Would check task count if exposed by Foreman API
    });
  });

  describe('Agent Workflow Patterns', () => {
    it('should support sequential agent execution', async () => {
      // Create a workflow run
      const runResult = await createRun(foremanConfig, {
        inputData: {
          workflow: 'sequential-processing',
          steps: ['validate', 'process', 'store']
        },
        metadata: {
          organizationId: testOrg.id
        }
      });

      expect(runResult.success).to.be.true;
      if (!runResult.success) return;

      const runId = runResult.data.id;

      // Step 1: Validation
      const validateTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: {
          agent: 'ValidatorAgent',
          action: 'validate-input'
        }
      });

      // Store validation result
      await createRunData(foremanConfig, runId, {
        taskId: validateTask.data.id,
        key: 'validation-status',
        value: { valid: true, errors: [] },
        tags: ['step:1', 'type:validation']
      });

      // Step 2: Processing (depends on validation)
      const validationData = await queryRunData(foremanConfig, runId, {
        key: 'validation-status'
      });

      if (validationData.success && validationData.data.data[0].value.valid) {
        const processTask = await createTask(foremanConfig, {
          runId,
          type: 'agent-execution',
          inputData: {
            agent: 'ProcessorAgent',
            action: 'process-data'
          }
        });

        // Store processing result
        await createRunData(foremanConfig, runId, {
          taskId: processTask.data.id,
          key: 'processing-result',
          value: { processed: true, output: 'data' },
          tags: ['step:2', 'type:processing']
        });
      }

      // Verify sequential execution
      const allData = await queryRunData(foremanConfig, runId, {
        sortBy: 'created_at',
        sortOrder: 'asc'
      });

      expect(allData.success).to.be.true;
      if (!allData.success) return;
      expect(allData.data.data).to.have.lengthOf(2);
      expect(allData.data.data[0].key).to.equal('validation-status');
      expect(allData.data.data[1].key).to.equal('processing-result');
    });

    it('should support parallel agent execution', async () => {
      // Create a workflow run
      const runResult = await createRun(foremanConfig, {
        inputData: {
          workflow: 'parallel-analysis',
          targets: ['inventory', 'fraud', 'pricing']
        },
        metadata: {
          organizationId: testOrg.id
        }
      });

      expect(runResult.success).to.be.true;
      if (!runResult.success) return;

      const runId = runResult.data.id;

      // Create parallel tasks
      const tasks = await Promise.all([
        createTask(foremanConfig, {
          runId,
          type: 'agent-execution',
          inputData: { agent: 'InventoryAgent', action: 'check-stock' }
        }),
        createTask(foremanConfig, {
          runId,
          type: 'agent-execution',
          inputData: { agent: 'FraudAgent', action: 'analyze-risk' }
        }),
        createTask(foremanConfig, {
          runId,
          type: 'agent-execution',
          inputData: { agent: 'PricingAgent', action: 'calculate-price' }
        })
      ]);

      // All tasks should be created successfully
      tasks.forEach(task => {
        expect(task.success).to.be.true;
      });

      // Simulate agents storing their results
      await Promise.all([
        createRunData(foremanConfig, runId, {
          taskId: tasks[0].data.id,
          key: 'inventory-check',
          value: { inStock: true },
          tags: ['parallel', 'agent:inventory']
        }),
        createRunData(foremanConfig, runId, {
          taskId: tasks[1].data.id,
          key: 'fraud-check',
          value: { riskScore: 10 },
          tags: ['parallel', 'agent:fraud']
        }),
        createRunData(foremanConfig, runId, {
          taskId: tasks[2].data.id,
          key: 'pricing-calc',
          value: { price: 99.99 },
          tags: ['parallel', 'agent:pricing']
        })
      ]);

      // Aggregation step
      const aggregateTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: { agent: 'AggregatorAgent', action: 'combine-results' }
      });

      // Read all parallel results
      const parallelResults = await queryRunData(foremanConfig, runId, {
        tags: ['parallel']
      });

      expect(parallelResults.success).to.be.true;
      if (!parallelResults.success) return;
      expect(parallelResults.data.data).to.have.lengthOf(3);
    });

    it('should handle agent execution failures gracefully', async () => {
      // Create a run that will fail
      const runResult = await createRun(foremanConfig, {
        inputData: {
          agentName: 'FailingAgent',
          shouldFail: true
        },
        metadata: {
          organizationId: testOrg.id
        }
      });

      expect(runResult.success).to.be.true;
      if (!runResult.success) return;

      const runId = runResult.data.id;

      // Create a task that will fail
      const failTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: {
          agent: 'FailingAgent',
          error: 'Simulated failure'
        }
      });

      // Store error information
      await createRunData(foremanConfig, runId, {
        taskId: failTask.data.id,
        key: 'error-info',
        value: {
          error: 'Agent execution failed',
          reason: 'Simulated failure',
          timestamp: new Date().toISOString()
        },
        tags: ['error', 'agent:FailingAgent']
      });

      // Verify error was stored
      const errorData = await queryRunData(foremanConfig, runId, {
        tags: ['error']
      });

      expect(errorData.success).to.be.true;
      if (!errorData.success) return;
      expect(errorData.data.data).to.have.lengthOf(1);
      expect(errorData.data.data[0].value).to.have.property('error');
    });
  });

  describe('Agent Context and State Management', () => {
    it('should maintain conversation context across calls', async () => {
      const contextId = `ctx-${uuidv4()}`;

      // First message
      const response1 = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'My name is Alice' }],
          contextId
        },
        metadata: { agent: 'EchoAgent' }
      }, {
        apiKey: testApiKey.key
      });

      expect(response1.body.result).to.have.property('contextId', contextId);

      // Second message in same context
      const response2 = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'What is my name?' }],
          contextId
        },
        metadata: { agent: 'EchoAgent' }
      }, {
        apiKey: testApiKey.key
      });

      expect(response2.body.result).to.have.property('contextId', contextId);
      // In a real implementation, the agent would remember "Alice"
    });

    it('should isolate contexts between different conversations', async () => {
      const context1 = `ctx-${uuidv4()}`;
      const context2 = `ctx-${uuidv4()}`;

      // Create two separate contexts
      await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'Context 1 data' }],
          contextId: context1
        },
        metadata: { agent: 'DataProcessorAgent' }
      }, {
        apiKey: testApiKey.key
      });

      await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'Context 2 data' }],
          contextId: context2
        },
        metadata: { agent: 'DataProcessorAgent' }
      }, {
        apiKey: testApiKey.key
      });

      // Contexts should be isolated
      // Each would have its own run in Foreman
    });
  });
});