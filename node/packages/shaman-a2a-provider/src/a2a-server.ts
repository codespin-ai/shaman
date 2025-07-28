/**
 * packages/shaman-a2a-provider/src/a2a-server.ts
 * 
 * Express server implementing the A2A protocol for agent federation
 */

import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { createLogger } from '@codespin/shaman-logger';

import { getAllAgents, getAgent } from '@codespin/shaman-agents';
import type { AgentsConfig } from '@codespin/shaman-agents';

import type {
  A2AProviderConfig,
  A2ADiscoveryResponse,
  A2AExecutionRequest,
  A2AExecutionResponse,
  A2AHealthResponse,
  A2AAgentCard
} from './types.js';
import { convertToA2ACard, canExposeAgent } from './agent-adapter.js';
import { executeAgentForA2A } from './agent-executor.js';

/**
 * Create an Express application configured for A2A protocol
 */
export function createA2AServer(
  config: A2AProviderConfig,
  agentsConfig: AgentsConfig
): express.Application {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // Authentication middleware if configured
  if (config.authentication && config.authentication.type !== 'none') {
    app.use((req, res, next) => {
      void createAuthMiddleware(config)(req, res, next);
    });
  }
  
  // Rate limiting middleware if configured
  if (config.rateLimiting?.enabled) {
    app.use(createRateLimitMiddleware(config));
  }
  
  const basePath = config.basePath || '/a2a/v1';
  
  /**
   * GET /agents - Discover available agents
   */
  app.get(`${basePath}/agents`, (req: Request, res: Response) => {
    void (async () => {
    try {
      // Get all Git agents (we only expose Git agents, not external ones)
      const agentsResult = await getAllAgents(agentsConfig, { source: 'git' });
      
      if (!agentsResult.success) {
        return res.status(500).json({
          error: {
            code: 'AGENT_FETCH_ERROR',
            message: agentsResult.error
          }
        });
      }
      
      // Filter agents based on configuration
      const exposableAgents = agentsResult.data
        .filter(ua => ua.source === 'git')
        .map(ua => ua.agent)
        .filter(agent => canExposeAgent(agent, config));
      
      // Convert to A2A cards
      const baseUrl = getBaseUrl(req);
      const agentCards: A2AAgentCard[] = exposableAgents.map(agent => 
        convertToA2ACard(agent, baseUrl)
      );
      
      const response: A2ADiscoveryResponse = {
        agents: agentCards,
        totalCount: agentCards.length
      };
      
      res.json(response);
    } catch (error) {
      const logger = createLogger('A2AServer');
      logger.error('Error in agent discovery:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch agents'
        }
      });
    }
    })();
  });
  
  /**
   * GET /agents/:agentName - Get specific agent details
   */
  app.get(`${basePath}/agents/:agentName`, (req: Request, res: Response) => {
    void (async () => {
    try {
      const { agentName } = req.params;
      
      const agentResult = await getAgent(agentName, agentsConfig);
      
      if (!agentResult.success) {
        return res.status(500).json({
          error: {
            code: 'AGENT_FETCH_ERROR',
            message: agentResult.error
          }
        });
      }
      
      if (!agentResult.data || agentResult.data.source !== 'git') {
        return res.status(404).json({
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${agentName} not found`
          }
        });
      }
      
      const gitAgent = agentResult.data.agent;
      
      // Check if agent can be exposed
      if (!canExposeAgent(gitAgent, config)) {
        return res.status(403).json({
          error: {
            code: 'AGENT_NOT_EXPOSED',
            message: `Agent ${agentName} is not available via A2A`
          }
        });
      }
      
      const baseUrl = getBaseUrl(req);
      const agentCard = convertToA2ACard(gitAgent, baseUrl);
      
      res.json(agentCard);
    } catch (error) {
      const logger = createLogger('A2AServer');
      logger.error('Error fetching agent:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch agent'
        }
      });
    }
    })();
  });
  
  /**
   * POST /agents/:agentName/execute - Execute an agent
   */
  app.post(`${basePath}/agents/:agentName/execute`, (req: Request, res: Response) => {
    void (async () => {
    try {
      const { agentName } = req.params;
      const executionRequest = req.body as A2AExecutionRequest;
      
      // Validate request
      if (!executionRequest.prompt) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Prompt is required'
          }
        });
      }
      
      // Get the agent
      const agentResult = await getAgent(agentName, agentsConfig);
      
      if (!agentResult.success || !agentResult.data || agentResult.data.source !== 'git') {
        return res.status(404).json({
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${agentName} not found`
          }
        });
      }
      
      const gitAgent = agentResult.data.agent;
      
      // Check if agent can be exposed
      if (!canExposeAgent(gitAgent, config)) {
        return res.status(403).json({
          error: {
            code: 'AGENT_NOT_EXPOSED',
            message: `Agent ${agentName} is not available for execution via A2A`
          }
        });
      }
      
      // Execute the agent
      const executionResult = await executeAgentForA2A(gitAgent, executionRequest);
      
      const response: A2AExecutionResponse = executionResult;
      res.json(response);
    } catch (error) {
      const logger = createLogger('A2AServer');
      logger.error('Error executing agent:', error);
      res.status(500).json({
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Failed to execute agent'
        }
      });
    }
    })();
  });
  
  /**
   * GET /health - Health check endpoint
   */
  app.get(`${basePath}/health`, (req: Request, res: Response) => {
    void (async () => {
    try {
      const _startTime = process.hrtime();
      
      // Check if we can fetch agents
      const agentsCheck = await checkAgentsHealth(agentsConfig);
      
      const response: A2AHealthResponse = {
        status: agentsCheck ? 'healthy' : 'degraded',
        version: '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: true, // TODO: Implement actual database check
          agents: agentsCheck,
          workflow: true // TODO: Implement workflow engine check
        }
      };
      
      res.json(response);
    } catch (error) {
      const logger = createLogger('A2AServer');
      logger.error('Error in health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        version: '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: false,
          agents: false
        }
      });
    }
    })();
  });
  
  /**
   * GET / - Metadata endpoint
   */
  app.get(basePath, (req: Request, res: Response) => {
    res.json({
      name: 'Shaman A2A Provider',
      version: '1.0.0',
      protocol: 'A2A/1.0',
      metadata: config.metadata || {},
      endpoints: {
        discovery: `${basePath}/agents`,
        health: `${basePath}/health`
      }
    });
  });
  
  return app;
}

/**
 * Create authentication middleware
 */
function createAuthMiddleware(config: A2AProviderConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header required'
        }
      });
      return;
    }
    
    if (config.authentication?.type === 'bearer') {
      const token = authHeader.replace('Bearer ', '');
      
      if (config.authentication.validateToken) {
        const isValid = await config.authentication.validateToken(token);
        if (!isValid) {
          res.status(401).json({
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid authentication token'
            }
          });
          return;
        }
      }
    }
    
    next();
  };
}

/**
 * Create rate limiting middleware (simplified implementation)
 */
function createRateLimitMiddleware(config: A2AProviderConfig) {
  const requests = new Map<string, number[]>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.rateLimiting?.enabled) {
      return next();
    }
    
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = config.rateLimiting.windowMs;
    const maxRequests = config.rateLimiting.maxRequests;
    
    // Get existing requests for this client
    const clientRequests = requests.get(clientId) || [];
    
    // Filter out old requests
    const recentRequests = clientRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests'
        }
      });
    }
    
    // Add current request
    recentRequests.push(now);
    requests.set(clientId, recentRequests);
    
    next();
  };
}

/**
 * Get base URL from request
 */
function getBaseUrl(req: Request): string {
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost';
  return `${protocol}://${host}`;
}

/**
 * Check if agents can be fetched
 */
async function checkAgentsHealth(agentsConfig: AgentsConfig): Promise<boolean> {
  try {
    const result = await getAllAgents(agentsConfig, { source: 'git' });
    return result.success;
  } catch {
    return false;
  }
}