/**
 * A2A HTTP client for agent-to-agent communication
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '@codespin/shaman-logger';
import type { Result } from '@codespin/shaman-core';
import type { WorkflowContext } from '@codespin/shaman-types';
import { generateInternalJWT } from './jwt.js';
import type {
  A2AClientConfig,
  A2AExecutionRequest,
  A2AExecutionResponse,
  A2ADiscoveryResponse,
  A2AAgentCard
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
   * Execute an agent via A2A protocol
   */
  async executeAgent(
    agentName: string,
    request: A2AExecutionRequest,
    context: WorkflowContext
  ): Promise<Result<A2AExecutionResponse>> {
    try {
      // Generate JWT token for this request
      const token = generateInternalJWT(context, this.config.jwtSecret);
      
      logger.debug('Executing agent via A2A', {
        agentName,
        contextRunId: context.runId,
        contextDepth: context.depth
      });
      
      const response = await this.axios.post<A2AExecutionResponse>(
        `/a2a/v1/agents/${agentName}/execute`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      logger.debug('A2A execution response', {
        agentName,
        status: response.data.status,
        taskId: response.data.taskId
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('A2A execution failed', {
        agentName,
        error
      });
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: new Error(`A2A execution failed: ${error.response?.data?.error?.message || error.message}`)
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
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