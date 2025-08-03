/**
 * Worker configuration types
 */

export type WorkerConfig = {
  foremanEndpoint: string;
  foremanApiKey: string;
  internalA2AUrl: string;
  jwtSecret: string;
  concurrency?: number;
  queues?: {
    taskQueue?: string;
    resultQueue?: string;
  };
};