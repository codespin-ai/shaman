/**
 * Agent execution worker using Foreman
 */

import { initializeForemanClient, type ForemanConfig, type TaskHandler } from '@codespin/foreman-client';
import { createLogger } from '@codespin/shaman-logger';
import { createA2AClient } from '@codespin/shaman-a2a-client';
import { createJWT } from '@codespin/shaman-security';
import type { Message } from '@codespin/shaman-a2a-protocol';
import type { WorkerConfig } from './types.js';

const logger = createLogger('AgentWorker');

/**
 * Create agent execution worker
 */
export async function createAgentWorker(config: WorkerConfig) {
  const foremanConfig: ForemanConfig = {
    endpoint: config.foremanEndpoint,
    apiKey: config.foremanApiKey,
    queues: config.queues
  };

  // Initialize Foreman client
  const client = await initializeForemanClient(foremanConfig);

  // Define task handler
  const agentExecutionHandler: TaskHandler = async (task) => {
      logger.info('Processing agent execution task', {
        taskId: task.id,
        runId: task.runId
      });

      // Type cast input data
      const inputData = task.inputData as Record<string, unknown>;
      const agentName = inputData.agentName as string;
      const input = inputData.input;

      const { organizationId, userId } = task.metadata as {
        organizationId: string;
        userId?: string;
      };

      try {
        // Generate JWT for internal A2A communication
        const jwt = await createJWT(
          {
            organizationId,
            userId: userId || 'system',
            runId: task.runId,
            taskId: task.id
          },
          config.jwtSecret,
          { expiresIn: '1h' }
        );

        // Create A2A client
        const a2aClient = createA2AClient({
          baseUrl: config.internalA2AUrl,
          jwtToken: jwt
        });

        // Build message
        const message: Message = {
          kind: 'message',
          messageId: task.id,
          contextId: task.runId,
          role: 'user',
          parts: [{
            kind: 'text',
            text: typeof input === 'string' ? input : JSON.stringify(input)
          }],
          metadata: {
            agent: agentName,
            'shaman:runId': task.runId,
            'shaman:taskId': task.id
          }
        };

        // Send message to agent via A2A
        const response = await a2aClient.sendMessage({
          id: task.id,
          jsonrpc: '2.0',
          method: 'message/send',
          params: { message }
        });

        if (!response.success) {
          throw new Error(`Agent execution failed: ${response.error.message}`);
        }

        const result = response.data;
        
        // Handle the response
        if ('result' in result && result.result) {
          const resultData = result.result;
          
          if (resultData.kind === 'message') {
            // Agent returned a message - extract the response
            const responseText = resultData.parts
              .filter(part => part.kind === 'text')
              .map(part => part.text)
              .join('\n');
            
            return {
              success: true,
              response: responseText,
              metadata: resultData.metadata
            };
          } else if (resultData.kind === 'task') {
            // Agent returned a task ID for async processing
            return {
              success: true,
              taskId: resultData.id,
              status: resultData.status
            };
          }
        }

        throw new Error('Unexpected response format from agent');

      } catch (error) {
        logger.error('Agent execution failed', {
          taskId: task.id,
          agentName,
          error
        });
        
        throw error;
      }
  };

  // Create worker with handlers
  const worker = await client.createWorker(
    {
      'agent-execution': agentExecutionHandler
    },
    {
      concurrency: config.concurrency || 5
    }
  );

  return worker;
}