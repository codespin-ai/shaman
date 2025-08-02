#!/usr/bin/env node

import { Command } from 'commander';
import { createA2AServer } from './server.js';
import { loadConfig } from '@codespin/shaman-config';
import { createLogger } from '@codespin/shaman-logger';
// import { resolveAgent } from '@codespin/shaman-agents';
import type { AgentCard } from '@codespin/shaman-a2a-protocol';

const logger = createLogger('A2AServerCLI');

const program = new Command();

program
  .name('shaman-a2a-server')
  .description('Start the Shaman A2A protocol server')
  .requiredOption('--role <role>', 'Server role: public or internal', (value) => {
    if (value !== 'public' && value !== 'internal') {
      throw new Error('Role must be either "public" or "internal"');
    }
    return value;
  })
  .option('--port <port>', 'Port to listen on', (value) => parseInt(value, 10), 5000)
  .option('--base-url <url>', 'Base URL for A2A endpoints', '')
  .action(async (options) => {
    try {
      const typedOptions = options as { role: 'public' | 'internal'; port: number; baseUrl: string };
      logger.info('Starting A2A server', { 
        role: typedOptions.role, 
        port: typedOptions.port, 
        baseUrl: typedOptions.baseUrl 
      });

      // Load configuration
      const config = loadConfig();
      if (typedOptions.role === 'internal') {
        if (!config.success) {
          throw new Error('Failed to load configuration');
        }
        // For MVP, we'll use a default JWT secret and organization ID
        // In production, these should come from environment variables
      } else {
        // Public server needs API key validation
        // For MVP, we'll use a simple static check
      }

      // Create agent card provider
      async function getAgentCard(): Promise<AgentCard> {
        // For MVP, return a static agent card
        return {
          protocolVersion: '0.3.0',
          url: `http://localhost:${typedOptions.port}${typedOptions.baseUrl}`,
          name: 'Shaman A2A Server',
          description: 'Federated AI agent execution platform',
          version: '0.2.5',
          capabilities: {
            streaming: true,
            stateTransitionHistory: false
          },
          defaultInputModes: ['text/plain', 'application/json'],
          defaultOutputModes: ['text/plain', 'application/json'],
          skills: [{
            id: 'agent-execution',
            name: 'agent-execution',
            description: 'Execute AI agents with tool calling capabilities',
            tags: ['ai', 'agent', 'execution']
          }]
        };
      }

      // Create server
      const server = createA2AServer({
        role: typedOptions.role,
        port: typedOptions.port,
        baseUrl: typedOptions.baseUrl,
        jwtSecret: typedOptions.role === 'internal' ? process.env.JWT_SECRET || 'dev-secret' : undefined,
        organizationId: typedOptions.role === 'internal' ? process.env.ORGANIZATION_ID || 'default' : undefined,
        getAgentCard,
        validateApiKey: typedOptions.role === 'public' 
          ? async (apiKey: string) => {
              // MVP: Accept any API key and use default org
              if (!apiKey) {
                return { success: false, error: new Error('Invalid API key') };
              }
              return { 
                success: true, 
                data: { organizationId: process.env.ORGANIZATION_ID || 'default' }
              };
            }
          : undefined
      });

      // Start server
      await server.start();

      // Handle shutdown
      process.on('SIGINT', () => {
        void (async () => {
          logger.info('Shutting down server...');
          await server.stop();
          process.exit(0);
        })();
      });

      process.on('SIGTERM', () => {
        void (async () => {
          logger.info('Shutting down server...');
          await server.stop();
          process.exit(0);
        })();
      });

    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  });

program.parse();