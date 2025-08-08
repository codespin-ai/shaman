/**
 * Agent execution worker using Foreman
 */

import { 
  initializeForemanClient, 
  createRunData,
  type ForemanConfig, 
  type TaskHandler 
} from '@codespin/foreman-client';
import { createLogger } from '@codespin/shaman-logger';
import { executeAgent } from '@codespin/shaman-agent-executor';
import type { AgentExecutionRequest } from '@codespin/shaman-agent-executor';
import { resolveAgent } from '@codespin/shaman-agents';
import type { AgentsConfig } from '@codespin/shaman-agents';
import { createToolRouter } from '@codespin/shaman-tool-router';
import type { ToolExecutionContext } from '@codespin/shaman-tool-router';
import { createVercelLLMProvider } from '@codespin/shaman-llm-vercel';
import { v4 as uuidv4 } from 'uuid';
import type { WorkerConfig } from './types.js';
import type { Step } from '@codespin/shaman-types';

const logger = createLogger('AgentWorker');

/**
 * Create agent execution worker
 */
export async function createAgentWorker(config: WorkerConfig): Promise<{
  start: () => Promise<void>;
  stop: () => Promise<void>;
}> {
  const foremanConfig: ForemanConfig = {
    endpoint: config.foremanEndpoint,
    apiKey: config.foremanApiKey,
    queues: config.queues
  };

  // Initialize Foreman client
  const client = await initializeForemanClient(foremanConfig);

  // Create LLM provider
  const llmProvider = createVercelLLMProvider({
    models: config.llmModels || {
      'gpt-4': {
        provider: 'openai',
        modelId: 'gpt-4',
        defaultTemperature: 0.7,
        defaultMaxTokens: 2000
      },
      'claude-3': {
        provider: 'anthropic',
        modelId: 'claude-3-opus-20240229',
        defaultTemperature: 0.5,
        defaultMaxTokens: 4000
      }
    },
    defaultModel: config.defaultModel || 'gpt-4',
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY
    }
  });

  // Define task handler
  const agentExecutionHandler: TaskHandler = async (task) => {
    logger.info('Processing agent execution task', {
      taskId: task.id,
      runId: task.runId,
      type: task.type
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
      // Configure agents module
      const agentsConfig: AgentsConfig = {
        gitRepositories: config.gitRepositories,
        externalRegistries: config.externalRegistries
      };

      // Resolve the agent
      const agentResult = await resolveAgent(agentName, agentsConfig);
      if (!agentResult.success || !agentResult.data) {
        throw new Error(`Failed to resolve agent ${agentName}`);
      }

      const agentResolution = agentResult.data;
      const unifiedAgent = agentResolution.agent;
      
      // Extract agent details for the executor
      let agentDescription: string = '';
      let agentModel = 'gpt-4';
      let agentTemperature = 0.7;
      let agentTools: string[] = [];
      
      if (unifiedAgent.source === 'git') {
        const gitAgent = unifiedAgent.agent;
        agentDescription = gitAgent.description || '';
        agentModel = gitAgent.model || 'gpt-4';
        // temperature would need to be in frontmatter, not in current types
        agentTools = []; // tools would need to be extracted from frontmatter
      } else {
        const externalAgent = unifiedAgent.agent;
        agentDescription = externalAgent.description || '';
        // External agents don't have model or tools info in current types
        agentTools = [];
      }

      // Create execution context for tools
      const toolContext: ToolExecutionContext = {
        runId: task.runId,
        taskId: task.id,
        agentName,
        organizationId,
        jwtToken: config.jwtSecret // This would need a proper JWT
      };

      // Create tool router with Foreman config for platform tools
      const toolRouter = createToolRouter(
        {
          enablePlatformTools: true,
          foremanConfig,
          internalA2AUrl: config.internalA2AUrl,
          jwtToken: config.jwtSecret // This would need a proper JWT
        },
        {
          persistenceLayer: {
            // Minimal persistence layer for tool router
            createRunData: async () => ({ id: '', createdAt: new Date() } as any),
            getRunData: async () => [],
            queryRunData: async () => [],
            listRunDataKeys: async () => []
          }
        }
      );

      // Create agent execution request  
      const executionRequest: AgentExecutionRequest = {
        agentName,
        input: typeof input === 'string' ? input : JSON.stringify(input),
        organizationId,
        runId: task.runId,
        stepId: task.id,
        depth: 0,
        context: {
          runId: task.runId,
          memory: new Map(),
          results: {
            intermediate: new Map(),
            final: undefined
          }
        }
      };

      // Execute the agent
      const executionResult = await executeAgent(
        executionRequest,
        {
          agentResolver: async () => ({
            success: true,
            data: {
              name: agentName,
              description: agentDescription,
              systemPrompt: agentDescription,
              model: agentModel,
              temperature: agentTemperature,
              tools: agentTools,
              maxIterations: 10
            }
          }),
          llmProvider,
          toolRouter: {
            executeTool: async (name, args) => 
              toolRouter.executeTool(name, args, toolContext),
            listTools: () => toolRouter.listTools(),
            getTool: (name) => toolRouter.getTool(name),
            hasTool: (name) => toolRouter.hasTool(name)
          },
          persistence: {
            createStep: async (): Promise<Step> => ({ 
              id: uuidv4(), 
              runId: task.runId,
              agentName,
              status: 'COMPLETED' as const,
              startTime: new Date(),
              endTime: new Date()
            } as Step),
            updateStep: async (_id: string, updates: Partial<Step>): Promise<Step> => updates as Step,
            getStep: async (): Promise<Step | null> => null
          }
        }
      );

      if (!executionResult.success) {
        throw new Error(`Agent execution failed`);
      }

      // Store the result in Foreman run data
      await createRunData(foremanConfig, task.runId, {
        taskId: task.id,
        key: `agent-result-${task.id}`,
        value: {
          output: executionResult.data.output,
          metadata: executionResult.data.metadata
        } as Record<string, unknown>,
        tags: [
          'agent-result',
          `agent:${agentName}`,
          `task:${task.id}`
        ]
      });

      return {
        success: true,
        output: executionResult.data.output,
        metadata: executionResult.data.metadata
      } as Record<string, unknown>;

    } catch (error) {
      logger.error('Agent execution failed', {
        taskId: task.id,
        agentName,
        error
      });

      // Store error in run data
      await createRunData(foremanConfig, task.runId, {
        taskId: task.id,
        key: `agent-error-${task.id}`,
        value: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        } as Record<string, unknown>,
        tags: [
          'agent-error',
          `agent:${agentName}`,
          `task:${task.id}`
        ]
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