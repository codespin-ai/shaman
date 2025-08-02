import type { Response } from 'express';
import type { SSEEvent, SSEWriter } from './types.js';
import { createLogger } from '@codespin/shaman-logger';

const logger = createLogger('SSE');

/**
 * Create an SSE writer for a response
 */
export function createSSEWriter(res: Response): SSEWriter {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial newline to establish connection
  res.write('\n');

  let closed = false;

  return {
    writeEvent(event: SSEEvent): void {
      if (closed) {
        logger.warn('Attempted to write to closed SSE connection');
        return;
      }

      try {
        // Format SSE event
        let eventString = '';
        
        if (event.id) {
          eventString += `id: ${event.id}\n`;
        }
        
        if (event.event) {
          eventString += `event: ${event.event}\n`;
        }
        
        if (event.retry) {
          eventString += `retry: ${event.retry}\n`;
        }
        
        // Data field is required and can be multi-line
        const dataLines = event.data.split('\n');
        for (const line of dataLines) {
          eventString += `data: ${line}\n`;
        }
        
        // End event with extra newline
        eventString += '\n';
        
        res.write(eventString);
      } catch (error) {
        logger.error('Error writing SSE event:', error);
        closed = true;
      }
    },
    
    close(): void {
      if (!closed) {
        closed = true;
        res.end();
      }
    }
  };
}

/**
 * Convert an async generator to SSE events
 */
export async function streamAsyncGenerator<T>(
  generator: AsyncGenerator<T>,
  writer: SSEWriter,
  formatter: (value: T) => SSEEvent
): Promise<void> {
  try {
    for await (const value of generator) {
      const event = formatter(value);
      writer.writeEvent(event);
    }
  } catch (error) {
    logger.error('Error streaming async generator:', error);
    throw error;
  } finally {
    writer.close();
  }
}

/**
 * Format a JSON-RPC response as an SSE event
 */
export function formatJsonRpcSSEEvent(response: unknown, id?: string): SSEEvent {
  return {
    id,
    data: JSON.stringify(response)
  };
}