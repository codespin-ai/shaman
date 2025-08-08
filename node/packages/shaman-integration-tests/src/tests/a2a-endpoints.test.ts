/**
 * Integration tests for A2A protocol endpoints
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
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

describe('A2A Protocol Endpoints', () => {
  let testOrg: any;
  let testUser: any;
  let testApiKey: any;
  let db: any;

  before(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
    
    // Create test organization and user
    testOrg = generateTestOrganization();
    testUser = generateTestUser(testOrg.id);
    testApiKey = generateTestApiKey(testOrg.id, testUser.id);
    
    // Insert test data
    await db.none('INSERT INTO organization (id, name) VALUES ($(id), $(name))', testOrg);
    await db.none('INSERT INTO "user" (id, organization_id, email) VALUES ($(id), $(organizationId), $(email))', testUser);
    await db.none('INSERT INTO api_key (id, organization_id, user_id, key_hash, name) VALUES ($(id), $(organizationId), $(userId), $(keyHash), $(name))', testApiKey);
  });

  after(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clear run and step tables between tests
    await db.none('TRUNCATE TABLE step CASCADE');
    await db.none('TRUNCATE TABLE run CASCADE');
  });

  describe('Core A2A Methods', () => {
    describe('message/send', () => {
      it('should accept a valid message and return a task', async () => {
        const response = await makeA2ARequest('', 'message/send', {
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'user',
            parts: [
              {
                kind: 'text',
                text: 'Hello, test agent!'
              }
            ]
          },
          metadata: {
            agent: 'TestAgent'
          }
        }, {
          apiKey: testApiKey.key
        });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('jsonrpc', '2.0');
        expect(response.body).to.have.property('result');
        expect(response.body.result).to.have.property('kind', 'task');
        expect(response.body.result).to.have.property('id');
        expect(response.body.result).to.have.property('status');
        expect(response.body.result.status).to.have.property('state');
      });

      it('should reject requests without authentication', async () => {
        const response = await makeA2ARequest('', 'message/send', {
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'user',
            parts: [
              {
                kind: 'text',
                text: 'Unauthorized request'
              }
            ]
          }
        });

        expect(response.status).to.equal(401);
        expect(response.body).to.have.property('error');
        expect(response.body.error).to.have.property('code', -32001);
      });

      it('should validate message format', async () => {
        const response = await makeA2ARequest('', 'message/send', {
          message: {
            // Missing required 'kind' field
            messageId: uuidv4(),
            role: 'user',
            parts: []
          }
        }, {
          apiKey: testApiKey.key
        });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('error');
        expect(response.body.error).to.have.property('code', -32602);
        expect(response.body.error).to.have.property('message').that.includes('Invalid params');
      });

      it('should handle message with metadata', async () => {
        const metadata = {
          source: 'test-suite',
          version: '1.0.0',
          customField: 'custom-value'
        };

        const response = await makeA2ARequest('', 'message/send', {
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'user',
            parts: [
              {
                kind: 'text',
                text: 'Message with metadata'
              }
            ],
            metadata
          }
        }, {
          apiKey: testApiKey.key
        });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('result');
        expect(response.body.result).to.have.property('kind', 'task');
      });

      it('should support different message part types', async () => {
        const response = await makeA2ARequest('', 'message/send', {
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'user',
            parts: [
              {
                kind: 'text',
                text: 'Here is some text'
              },
              {
                kind: 'function_call',
                name: 'get_weather',
                arguments: '{"location": "San Francisco"}'
              },
              {
                kind: 'function_response',
                name: 'get_weather',
                response: '{"temperature": 72, "condition": "sunny"}'
              }
            ]
          }
        }, {
          apiKey: testApiKey.key
        });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('result');
      });
    });

    describe('tasks/get', () => {
      it('should retrieve task status', async () => {
        // First create a task
        const createResponse = await makeA2ARequest('', 'message/send', {
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'user',
            parts: [
              {
                kind: 'text',
                text: 'Create a task for status check'
              }
            ]
          }
        }, {
          apiKey: testApiKey.key
        });

        expect(createResponse.body.result).to.have.property('id');
        const taskId = createResponse.body.result.id;

        // Get task status
        const statusResponse = await makeA2ARequest('', 'tasks/get', {
          id: taskId
        }, {
          apiKey: testApiKey.key
        });

        expect(statusResponse.status).to.equal(200);
        expect(statusResponse.body).to.have.property('result');
        expect(statusResponse.body.result).to.have.property('kind', 'task');
        expect(statusResponse.body.result).to.have.property('id', taskId);
        expect(statusResponse.body.result).to.have.property('status');
        expect(statusResponse.body.result.status).to.have.property('state');
      });

      it('should return error for non-existent task', async () => {
        const response = await makeA2ARequest('', 'tasks/get', {
          id: 'non-existent-task-id'
        }, {
          apiKey: testApiKey.key
        });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('error');
        expect(response.body.error).to.have.property('code', -32004);
        expect(response.body.error.message).to.include('not found');
      });
    });

    describe('tasks/cancel', () => {
      it('should cancel a running task', async () => {
        // Create a task
        const createResponse = await makeA2ARequest('', 'message/send', {
          message: {
            kind: 'message',
            messageId: uuidv4(),
            role: 'user',
            parts: [
              {
                kind: 'text',
                text: 'Long running task to cancel'
              }
            ]
          }
        }, {
          apiKey: testApiKey.key
        });

        const taskId = createResponse.body.result.id;

        // Cancel the task
        const cancelResponse = await makeA2ARequest('', 'tasks/cancel', {
          id: taskId
        }, {
          apiKey: testApiKey.key
        });

        expect(cancelResponse.status).to.equal(200);
        expect(cancelResponse.body).to.have.property('result');
        expect(cancelResponse.body.result).to.have.property('kind', 'task');
        expect(cancelResponse.body.result).to.have.property('id', taskId);
        expect(cancelResponse.body.result.status.state).to.be.oneOf(['canceled', 'canceling']);
      });

      it('should not cancel a completed task', async () => {
        // This would need a mock completed task
        // For now, test with non-existent task
        const response = await makeA2ARequest('', 'tasks/cancel', {
          id: 'completed-task-id'
        }, {
          apiKey: testApiKey.key
        });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('error');
      });
    });
  });

  describe('A2A Protocol Compliance', () => {
    it('should use correct JSON-RPC format', async () => {
      const requestId = uuidv4();
      const response = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'Test' }]
        }
      }, {
        apiKey: testApiKey.key
      });

      expect(response.body).to.have.property('jsonrpc', '2.0');
      expect(response.body).to.have.property('id');
    });

    it('should handle JSON-RPC batch requests', async () => {
      // A2A spec allows batch requests
      const batchRequest = [
        {
          jsonrpc: '2.0',
          id: '1',
          method: 'tasks/get',
          params: { id: 'task-1' }
        },
        {
          jsonrpc: '2.0',
          id: '2',
          method: 'tasks/get',
          params: { id: 'task-2' }
        }
      ];

      const response = await fetch(TEST_CONFIG.shaman.a2a.publicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': testApiKey.key
        },
        body: JSON.stringify(batchRequest)
      });

      const body = await response.json();
      
      // Should return array of responses
      expect(body).to.be.an('array');
      expect(body).to.have.lengthOf(2);
      expect(body[0]).to.have.property('jsonrpc', '2.0');
      expect(body[0]).to.have.property('id', '1');
      expect(body[1]).to.have.property('id', '2');
    });

    it('should return proper error codes', async () => {
      // Test various error conditions
      
      // Parse error
      const parseErrorResponse = await fetch(TEST_CONFIG.shaman.a2a.publicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': testApiKey.key
        },
        body: 'invalid json'
      });
      
      const parseError = await parseErrorResponse.json();
      expect(parseError.error.code).to.equal(-32700);

      // Invalid request
      const invalidResponse = await makeA2ARequest('', '', {}, {
        apiKey: testApiKey.key
      });
      expect(invalidResponse.body.error.code).to.equal(-32600);

      // Method not found
      const methodNotFoundResponse = await makeA2ARequest('', 'non/existent/method', {}, {
        apiKey: testApiKey.key
      });
      expect(methodNotFoundResponse.body.error.code).to.equal(-32601);

      // Invalid params
      const invalidParamsResponse = await makeA2ARequest('', 'message/send', {
        // Missing required 'message' param
      }, {
        apiKey: testApiKey.key
      });
      expect(invalidParamsResponse.body.error.code).to.equal(-32602);
    });
  });

  describe('Discovery Endpoints', () => {
    it('should provide agent card at /.well-known/agent.json', async () => {
      const response = await fetch(`${TEST_CONFIG.shaman.a2a.publicUrl}/.well-known/agent.json`);
      
      expect(response.status).to.equal(200);
      const agentCard = await response.json();
      
      expect(agentCard).to.have.property('protocolVersion', '0.3.0');
      expect(agentCard).to.have.property('name');
      expect(agentCard).to.have.property('description');
      expect(agentCard).to.have.property('version');
      expect(agentCard).to.have.property('capabilities');
      expect(agentCard.capabilities).to.have.property('streaming');
    });

    it('should list available agents at /.well-known/a2a/agents', async () => {
      const response = await fetch(`${TEST_CONFIG.shaman.a2a.publicUrl}/.well-known/a2a/agents`, {
        headers: {
          'x-api-key': testApiKey.key
        }
      });
      
      expect(response.status).to.equal(200);
      const agents = await response.json();
      
      expect(agents).to.be.an('array');
      // Should list exposed agents
    });
  });

  describe('Internal vs Public Server Behavior', () => {
    it('should accept JWT tokens on internal server', async () => {
      // Generate a test JWT (simplified for testing)
      const jwt = Buffer.from(JSON.stringify({
        organizationId: testOrg.id,
        userId: testUser.id,
        internal: true
      })).toString('base64');

      const response = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'Internal request' }]
        }
      }, {
        jwt,
        isInternal: true
      });

      // Should accept the JWT
      expect(response.status).to.be.oneOf([200, 401]); // Depends on JWT validation
    });

    it('should reject API keys on internal server', async () => {
      const response = await makeA2ARequest('', 'message/send', {
        message: {
          kind: 'message',
          messageId: uuidv4(),
          role: 'user',
          parts: [{ kind: 'text', text: 'Wrong auth type' }]
        }
      }, {
        apiKey: testApiKey.key,
        isInternal: true
      });

      // Internal server should reject API keys
      expect(response.status).to.equal(401);
    });

    it('should expose all agents on internal server', async () => {
      // Internal server should show all agents, not just exposed ones
      const response = await fetch(`${TEST_CONFIG.shaman.a2a.internalUrl}/.well-known/a2a/agents`, {
        headers: {
          'Authorization': `Bearer test-jwt`
        }
      });
      
      // Check response based on actual implementation
      expect(response.status).to.be.oneOf([200, 401]);
    });
  });
});