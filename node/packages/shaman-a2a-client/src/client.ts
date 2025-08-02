import axios, { AxiosInstance, AxiosError } from 'axios';
import { createLogger } from '@codespin/shaman-logger';
import type { Result } from '@codespin/shaman-core';
import type { 
  JsonRpcRequest, 
  JsonRpcResponse,
  JsonRpcError
} from '@codespin/shaman-jsonrpc';
import type { 
  SendMessageRequest, 
  SendMessageResponse,
  GetTaskRequest,
  GetTaskResponse,
  CancelTaskRequest,
  CancelTaskResponse,
  AgentCard,
  SendStreamingMessageResponse
} from '@codespin/shaman-a2a-protocol';
import type { A2AClient, A2AClientConfig } from './types.js';

const logger = createLogger('A2AClient');

/**
 * A2A protocol HTTP client implementation
 */
export class A2AClientImpl implements A2AClient {
  private axios: AxiosInstance;
  private requestId = 0;

  constructor(private readonly config: A2AClientConfig) {
    // Create axios instance
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: this.buildHeaders()
    });

    // Add retry interceptor if configured
    if (config.retry) {
      this.addRetryInterceptor();
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.jwtToken) {
      headers['Authorization'] = `Bearer ${this.config.jwtToken}`;
    }

    return headers;
  }

  private addRetryInterceptor(): void {
    const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000 } = this.config.retry!;

    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config;
        if (!config || !config.headers) {
          return Promise.reject(error);
        }

        const retryCount = (config as any).__retryCount || 0;
        
        // Don't retry if max attempts reached or non-retryable error
        if (retryCount >= maxAttempts || !this.isRetryableError(error)) {
          return Promise.reject(error);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, retryCount), maxDelay);
        
        logger.debug(`Retrying request (attempt ${retryCount + 1}/${maxAttempts}) after ${delay}ms`);
        
        // Increment retry count
        (config as any).__retryCount = retryCount + 1;
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.axios(config);
      }
    );
  }

  private isRetryableError(error: AxiosError): boolean {
    // Network errors
    if (!error.response) {
      return true;
    }

    // Server errors (5xx) and rate limits (429)
    const status = error.response.status;
    return status >= 500 || status === 429;
  }

  private async makeJsonRpcCall<TParams, TResult>(
    method: string,
    params: TParams
  ): Promise<Result<TResult, Error>> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: String(++this.requestId),
      method,
      params
    };

    try {
      const response = await this.axios.post<JsonRpcResponse>('/', request);
      const jsonRpcResponse = response.data;

      if ('error' in jsonRpcResponse) {
        const error = jsonRpcResponse.error as JsonRpcError;
        return {
          success: false,
          error: new Error(`${error.message} (code: ${error.code})`)
        };
      }

      return {
        success: true,
        data: jsonRpcResponse.result as TResult
      };
    } catch (error) {
      logger.error(`JSON-RPC call failed: ${method}`, error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async discover(): Promise<Result<AgentCard, Error>> {
    try {
      const response = await this.axios.get<AgentCard>('/.well-known/agent.json');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Discovery failed', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async sendMessage(request: SendMessageRequest): Promise<Result<SendMessageResponse, Error>> {
    return this.makeJsonRpcCall<SendMessageRequest, SendMessageResponse>('message/send', request);
  }

  async *streamMessage(request: SendMessageRequest): AsyncGenerator<SendStreamingMessageResponse> {
    const jsonRpcRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: String(++this.requestId),
      method: 'message/stream',
      params: request
    };

    try {
      const response = await this.axios.post('/', jsonRpcRequest, {
        responseType: 'stream',
        headers: {
          ...this.buildHeaders(),
          'Accept': 'text/event-stream'
        }
      });

      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const jsonRpcResponse = JSON.parse(data) as JsonRpcResponse;
              if ('result' in jsonRpcResponse) {
                yield jsonRpcResponse.result as SendStreamingMessageResponse;
              } else if ('error' in jsonRpcResponse) {
                const error = jsonRpcResponse.error as JsonRpcError;
                throw new Error(`${error.message} (code: ${error.code})`);
              }
            } catch (parseError) {
              logger.error('Failed to parse SSE data', parseError);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Stream message failed', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async getTask(request: GetTaskRequest): Promise<Result<GetTaskResponse, Error>> {
    return this.makeJsonRpcCall<GetTaskRequest, GetTaskResponse>('tasks/get', request);
  }

  async cancelTask(request: CancelTaskRequest): Promise<Result<CancelTaskResponse, Error>> {
    return this.makeJsonRpcCall<CancelTaskRequest, CancelTaskResponse>('tasks/cancel', request);
  }

  async *resubscribeTask(request: GetTaskRequest): AsyncGenerator<SendStreamingMessageResponse> {
    const jsonRpcRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: String(++this.requestId),
      method: 'tasks/resubscribe',
      params: request
    };

    try {
      const response = await this.axios.post('/', jsonRpcRequest, {
        responseType: 'stream',
        headers: {
          ...this.buildHeaders(),
          'Accept': 'text/event-stream'
        }
      });

      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const jsonRpcResponse = JSON.parse(data) as JsonRpcResponse;
              if ('result' in jsonRpcResponse) {
                yield jsonRpcResponse.result as SendStreamingMessageResponse;
              } else if ('error' in jsonRpcResponse) {
                const error = jsonRpcResponse.error as JsonRpcError;
                throw new Error(`${error.message} (code: ${error.code})`);
              }
            } catch (parseError) {
              logger.error('Failed to parse SSE data', parseError);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Resubscribe task failed', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

/**
 * Create an A2A client instance
 */
export function createA2AClient(config: A2AClientConfig): A2AClient {
  return new A2AClientImpl(config);
}