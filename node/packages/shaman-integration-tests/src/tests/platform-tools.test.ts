/**
 * Integration tests for platform tools
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
  type ForemanConfig 
} from '@codespin/foreman-client';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  truncateAllTables,
  TEST_CONFIG
} from '../setup.js';

describe('Platform Tools Integration', () => {
  let foremanConfig: ForemanConfig;
  let foremanClient: any;

  before(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Initialize Foreman client
    foremanConfig = TEST_CONFIG.foreman;
    foremanClient = await initializeForemanClient(foremanConfig);
  });

  after(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('Run Data Tools via Foreman', () => {
    it('should write and read run data', async () => {
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { test: true },
        metadata: { source: 'test' }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Create a task
      const taskResult = await createTask(foremanConfig, {
        runId,
        type: 'test-task',
        inputData: { action: 'test' }
      });
      
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;
      
      const taskId = taskResult.data.id;

      // Write run data
      const writeResult = await createRunData(foremanConfig, runId, {
        taskId,
        key: 'test-key',
        value: { message: 'Hello World', count: 42 },
        tags: ['test', 'integration']
      });

      expect(writeResult.success).to.be.true;
      if (!writeResult.success) return;
      expect(writeResult.data.key).to.equal('test-key');

      // Read run data
      const readResult = await queryRunData(foremanConfig, runId, {
        key: 'test-key'
      });

      expect(readResult.success).to.be.true;
      if (!readResult.success) return;
      expect(readResult.data.data).to.have.lengthOf(1);
      expect(readResult.data.data[0].value).to.deep.equal({ 
        message: 'Hello World', 
        count: 42 
      });
    });

    it('should query run data by tags', async () => {
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { test: true },
        metadata: { source: 'test' }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Create a task
      const taskResult = await createTask(foremanConfig, {
        runId,
        type: 'test-task',
        inputData: { action: 'test' }
      });
      
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;
      
      const taskId = taskResult.data.id;

      // Write multiple run data entries
      await createRunData(foremanConfig, runId, {
        taskId,
        key: 'data-1',
        value: { id: 1 },
        tags: ['type:response', 'agent:test']
      });

      await createRunData(foremanConfig, runId, {
        taskId,
        key: 'data-2',
        value: { id: 2 },
        tags: ['type:error', 'agent:test']
      });

      await createRunData(foremanConfig, runId, {
        taskId,
        key: 'data-3',
        value: { id: 3 },
        tags: ['type:response', 'agent:other']
      });

      // Query by single tag
      const responseResult = await queryRunData(foremanConfig, runId, {
        tags: ['type:response']
      });

      expect(responseResult.success).to.be.true;
      if (!responseResult.success) return;
      expect(responseResult.data.data).to.have.lengthOf(2);

      // Query by multiple tags (AND condition)
      const agentTestResult = await queryRunData(foremanConfig, runId, {
        tags: ['type:response', 'agent:test']
      });

      expect(agentTestResult.success).to.be.true;
      if (!agentTestResult.success) return;
      expect(agentTestResult.data.data).to.have.lengthOf(1);
      expect(agentTestResult.data.data[0].key).to.equal('data-1');
    });

    it('should query run data by key prefix', async () => {
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { test: true },
        metadata: { source: 'test' }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Create a task
      const taskResult = await createTask(foremanConfig, {
        runId,
        type: 'test-task',
        inputData: { action: 'test' }
      });
      
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;
      
      const taskId = taskResult.data.id;

      // Write run data with different key patterns
      await createRunData(foremanConfig, runId, {
        taskId,
        key: 'agent-response-1',
        value: { response: 1 },
        tags: []
      });

      await createRunData(foremanConfig, runId, {
        taskId,
        key: 'agent-response-2',
        value: { response: 2 },
        tags: []
      });

      await createRunData(foremanConfig, runId, {
        taskId,
        key: 'system-log-1',
        value: { log: 'info' },
        tags: []
      });

      // Query by key prefix
      const agentResult = await queryRunData(foremanConfig, runId, {
        keyStartsWith: ['agent-']
      });

      expect(agentResult.success).to.be.true;
      if (!agentResult.success) return;
      expect(agentResult.data.data).to.have.lengthOf(2);
      
      const keys = agentResult.data.data.map(d => d.key);
      expect(keys).to.include('agent-response-1');
      expect(keys).to.include('agent-response-2');
    });

    it('should support pagination and sorting', async () => {
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { test: true },
        metadata: { source: 'test' }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Create a task
      const taskResult = await createTask(foremanConfig, {
        runId,
        type: 'test-task',
        inputData: { action: 'test' }
      });
      
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;
      
      const taskId = taskResult.data.id;

      // Write multiple entries
      for (let i = 1; i <= 5; i++) {
        await createRunData(foremanConfig, runId, {
          taskId,
          key: `data-${i}`,
          value: { index: i },
          tags: ['test']
        });
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Query with limit
      const limitedResult = await queryRunData(foremanConfig, runId, {
        limit: 3,
        sortBy: 'created_at',
        sortOrder: 'asc'
      });

      expect(limitedResult.success).to.be.true;
      if (!limitedResult.success) return;
      expect(limitedResult.data.data).to.have.lengthOf(3);
      expect(limitedResult.data.data[0].key).to.equal('data-1');
      expect(limitedResult.data.data[2].key).to.equal('data-3');

      // Query with different sort order
      const descResult = await queryRunData(foremanConfig, runId, {
        limit: 3,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });

      expect(descResult.success).to.be.true;
      if (!descResult.success) return;
      expect(descResult.data.data).to.have.lengthOf(3);
      expect(descResult.data.data[0].key).to.equal('data-5');
      expect(descResult.data.data[2].key).to.equal('data-3');
    });

    it('should handle non-existent keys gracefully', async () => {
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { test: true },
        metadata: { source: 'test' }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Query non-existent key
      const result = await queryRunData(foremanConfig, runId, {
        key: 'non-existent-key'
      });

      expect(result.success).to.be.true;
      if (!result.success) return;
      expect(result.data.data).to.have.lengthOf(0);
    });

    it('should handle complex JSON values', async () => {
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { test: true },
        metadata: { source: 'test' }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Create a task
      const taskResult = await createTask(foremanConfig, {
        runId,
        type: 'test-task',
        inputData: { action: 'test' }
      });
      
      expect(taskResult.success).to.be.true;
      if (!taskResult.success) return;
      
      const taskId = taskResult.data.id;

      // Complex nested object
      const complexValue = {
        user: {
          id: 'user-123',
          name: 'John Doe',
          preferences: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false
            }
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          tags: ['important', 'user-data']
        },
        items: [
          { id: 1, name: 'Item 1', price: 10.99 },
          { id: 2, name: 'Item 2', price: 25.50 }
        ]
      };

      // Write complex value
      const writeResult = await createRunData(foremanConfig, runId, {
        taskId,
        key: 'complex-data',
        value: complexValue,
        tags: ['complex', 'nested']
      });

      expect(writeResult.success).to.be.true;

      // Read it back
      const readResult = await queryRunData(foremanConfig, runId, {
        key: 'complex-data'
      });

      expect(readResult.success).to.be.true;
      if (!readResult.success) return;
      expect(readResult.data.data).to.have.lengthOf(1);
      expect(readResult.data.data[0].value).to.deep.equal(complexValue);
    });
  });

  describe('Agent Collaboration via Run Data', () => {
    it('should enable data sharing between agents', async () => {
      // Simulate a workflow where multiple agents share data
      
      // Create a run
      const runResult = await createRun(foremanConfig, {
        inputData: { 
          orderId: 'ORD-123',
          customerId: 'CUST-456'
        },
        metadata: { 
          source: 'test',
          workflow: 'order-processing'
        }
      });
      
      expect(runResult.success).to.be.true;
      if (!runResult.success) return;
      
      const runId = runResult.data.id;

      // Task 1: Inventory Agent checks stock
      const inventoryTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: { 
          agent: 'InventoryAgent',
          action: 'check-stock'
        }
      });
      
      expect(inventoryTask.success).to.be.true;
      if (!inventoryTask.success) return;

      // Inventory Agent writes its results
      await createRunData(foremanConfig, runId, {
        taskId: inventoryTask.data.id,
        key: 'inventory-check',
        value: {
          available: true,
          items: [
            { productId: 'PROD-1', stock: 10 },
            { productId: 'PROD-2', stock: 5 }
          ]
        },
        tags: ['agent:inventory', 'step:1', 'type:result']
      });

      // Task 2: Fraud Detection Agent
      const fraudTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: { 
          agent: 'FraudDetectionAgent',
          action: 'analyze-order'
        }
      });
      
      expect(fraudTask.success).to.be.true;
      if (!fraudTask.success) return;

      // Fraud Agent reads inventory data
      const inventoryData = await queryRunData(foremanConfig, runId, {
        key: 'inventory-check'
      });
      
      expect(inventoryData.success).to.be.true;
      if (!inventoryData.success) return;
      expect(inventoryData.data.data[0].value).to.have.property('available', true);

      // Fraud Agent writes its results
      await createRunData(foremanConfig, runId, {
        taskId: fraudTask.data.id,
        key: 'fraud-analysis',
        value: {
          riskScore: 15,
          approved: true,
          flags: []
        },
        tags: ['agent:fraud', 'step:2', 'type:result']
      });

      // Task 3: Order Processing Agent aggregates results
      const processingTask = await createTask(foremanConfig, {
        runId,
        type: 'agent-execution',
        inputData: { 
          agent: 'OrderProcessingAgent',
          action: 'finalize-order'
        }
      });
      
      expect(processingTask.success).to.be.true;
      if (!processingTask.success) return;

      // Read all agent results
      const allResults = await queryRunData(foremanConfig, runId, {
        tags: ['type:result'],
        sortBy: 'created_at',
        sortOrder: 'asc'
      });

      expect(allResults.success).to.be.true;
      if (!allResults.success) return;
      expect(allResults.data.data).to.have.lengthOf(2);
      
      // Verify data from both agents is available
      const keys = allResults.data.data.map(d => d.key);
      expect(keys).to.include('inventory-check');
      expect(keys).to.include('fraud-analysis');
    });
  });
});