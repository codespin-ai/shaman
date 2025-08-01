/**
 * A2A HTTP client for agent-to-agent communication
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@codespin/shaman-logger';
import type { Result } from '@codespin/shaman-core';
import type { WorkflowContext } from '@codespin/shaman-types';
import { generateInternalJWT } from './jwt.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  A2AClientConfig,
  A2ADiscoveryResponse,
  A2AAgentCard,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2ASendMessageRequest,
  A2ASendMessageResponse,
  A2AMessage,
  A2ATask
} from './types.js';

const logger = createLogger('A2AClient');

/**
 * A2A client for making agent-to-agent calls
 */
export class A2AClient {
  private axios: AxiosInstance;
  private config: A2AClientConfig;
  
  constructor(config: A2AClientConfig) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add retry interceptor if configured
    if (config.retry) {
      this.setupRetryInterceptor();
    }
  }
  
  /**
   * Send a message via A2A protocol
   */
  async sendMessage(
    message: A2AMessage,
    context: WorkflowContext,
    options?: {
      blocking?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Result<A2ASendMessageResponse>> {
    try {
      // Generate JWT token for this request
      const token = generateInternalJWT(context, this.config.jwtSecret);
      
      const request: A2AJsonRpcRequest<A2ASendMessageRequest> = {
        jsonrpc: '2.0',
        id: uuidv4(),
        method: 'message/send',
        params: {
          message,
          configuration: {
            blocking: options?.blocking
          },
          metadata: {
            ...options?.metadata,
            'shaman:runId': context.runId,
            'shaman:parentStepId': context.parentStepId,
            'shaman:depth': context.depth,
            'shaman:organizationId': context.tenantId
          }
        }
      };
      
      logger.debug('Sending A2A message', {
        messageId: message.messageId,
        contextId: message.contextId,
        blocking: options?.blocking
      });
      
      const response = await this.axios.post<A2AJsonRpcResponse<A2ASendMessageResponse>>(
        '/a2a/v1/message/send',
        request,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Handle JSON-RPC response
      if (response.data.error) {
        logger.error('A2A error response', response.data.error);
        return {
          success: false,
          error: response.data.error.message
        };
      }
      
      if (!response.data.result) {
        return {
          success: false,
          error: 'No result in response'
        };
      }
      
      logger.debug('A2A message response', {
        responseType: 'kind' in response.data.result ? response.data.result.kind : 'unknown'
      });
      
      return {
        success: true,
        data: response.data.result
      };
    } catch (error) {
      logger.error('A2A message send failed', error);
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: new Error(`A2A message send failed: ${error.response?.data?.error?.message || error.message}`)
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  /**
   * Execute an agent with a simple text prompt
   * This is a convenience method that uses message/send under the hood
   */
  async executeAgent(
    agentName: string,
    prompt: string,
    context: WorkflowContext,
    options?: {
      blocking?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Result<A2ATask>> {
    // Create a message targeting the specific agent
    const message: A2AMessage = {
      role: 'user',
      parts: [{
        kind: 'text',
        text: `@${agentName} ${prompt}`
      }],
      messageId: uuidv4(),
      contextId: context.contextId || uuidv4()
    };
    
    const result = await this.sendMessage(message, context, {
      blocking: options?.blocking ?? true,
      metadata: options?.metadata
    });
    
    if (!result.success) {
      return result;
    }
    
    // Ensure we got a task back
    if ('kind' in result.data && result.data.kind === 'task') {
      return {
        success: true,
        data: result.data
      };
    }
    
    // If we got a simple message response, wrap it in a task
    if ('role' in result.data) {
      const task: A2ATask = {
        id: uuidv4(),
        contextId: message.contextId!,
        status: {
          state: 'completed',
          message: result.data as A2AMessage,
          timestamp: new Date().toISOString()
        },
        artifacts: [],
        history: [message, result.data as A2AMessage],
        kind: 'task'
      };
      
      return {
        success: true,
        data: task
      };
    }
    
    return {
      success: false,
      error: new Error('Unexpected response type from A2A server')
    };
  }
  
  /**
   * Discover available agents
   */
  async discoverAgents(context: WorkflowContext): Promise<Result<A2ADiscoveryResponse>> {
    try {
      const token = generateInternalJWT(context, this.config.jwtSecret);
      
      const response = await this.axios.get<A2ADiscoveryResponse>(
        '/a2a/v1/agents',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Agent discovery failed', { error });
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: new Error(`Agent discovery failed: ${error.response?.data?.error?.message || error.message}`)
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  /**
   * Get details of a specific agent
   */
  async getAgent(
    agentName: string,
    context: WorkflowContext
  ): Promise<Result<A2AAgentCard>> {
    try {
      const token = generateInternalJWT(context, this.config.jwtSecret);
      
      const response = await this.axios.get<A2AAgentCard>(
        `/a2a/v1/agents/${agentName}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Get agent failed', { agentName, error });
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: new Error(`Get agent failed: ${error.response?.data?.error?.message || error.message}`)
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  /**
   * Check health of A2A server
   */
  async checkHealth(): Promise<Result<boolean>> {
    try {
      const response = await this.axios.get('/a2a/v1/health');
      return {
        success: true,
        data: response.data.status === 'healthy'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Health check failed')
      };
    }
  }
  
  /**
   * Setup retry interceptor
   */
  private setupRetryInterceptor(): void {
    this.axios.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        
        if (!config || !this.config.retry || config.__retryCount >= this.config.retry.maxRetries) {
          return Promise.reject(error);
        }
        
        config.__retryCount = config.__retryCount || 0;
        config.__retryCount += 1;
        
        // Exponential backoff
        const delay = this.config.retry.retryDelay * Math.pow(2, config.__retryCount - 1);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.axios(config);
      }
    );
  }
}