/**
 * Test setup and utilities for Shaman integration tests
 */

import pgPromise from "pg-promise";
import type { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import type { ForemanConfig } from "@codespin/foreman-client";

const pgp = pgPromise();

// Test configuration
export const TEST_CONFIG = {
  shaman: {
    db: {
      host: process.env.SHAMAN_DB_HOST || "localhost",
      port: parseInt(process.env.SHAMAN_DB_PORT || "5432"),
      database: "shaman_test",
      user: process.env.SHAMAN_DB_USER || "shaman",
      password: process.env.SHAMAN_DB_PASSWORD || "shaman",
    },
    a2a: {
      publicUrl: process.env.A2A_PUBLIC_URL || "http://localhost:5000",
      internalUrl: process.env.A2A_INTERNAL_URL || "http://localhost:5001",
      apiKey: process.env.TEST_API_KEY || "test-api-key-123",
    },
    graphql: {
      url: process.env.GRAPHQL_URL || "http://localhost:4000/graphql",
    },
  },
  foreman: {
    endpoint: process.env.FOREMAN_ENDPOINT || "http://localhost:3001",
    apiKey: process.env.FOREMAN_API_KEY || "fmn_test_shaman_xyz789",
    queues: {
      taskQueue: "shaman-test:tasks",
      resultQueue: "shaman-test:results",
    },
  } as ForemanConfig,
  permiso: {
    endpoint: process.env.PERMISO_ENDPOINT || "http://localhost:5001",
    apiKey: process.env.PERMISO_API_KEY || undefined,
  },
};

// Database utilities
let db: IDatabase<unknown>;

export async function setupTestDatabase(): Promise<void> {
  // Connect to postgres to create test database
  const adminDb = pgp({
    ...TEST_CONFIG.shaman.db,
    database: "postgres",
  });

  try {
    // Drop and recreate test database
    await adminDb.none(`DROP DATABASE IF EXISTS shaman_test`);
    await adminDb.none(`CREATE DATABASE shaman_test`);
  } finally {
    await adminDb.$pool.end();
  }

  // Connect to test database
  db = pgp({
    ...TEST_CONFIG.shaman.db,
    database: "shaman_test",
  });

  // Run migrations (simplified - in real setup, use knex migrations)
  await runMigrations();
}

export async function cleanupTestDatabase(): Promise<void> {
  if (db) {
    await db.$pool.end();
  }
}

export async function truncateAllTables(): Promise<void> {
  // Get all tables except migrations
  const tables = await db.many<{ tablename: string }>(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE '%migration%'
  `);

  // Truncate all tables
  for (const table of tables) {
    await db.none(`TRUNCATE TABLE ${table.tablename} CASCADE`);
  }
}

async function runMigrations(): Promise<void> {
  // Create core tables for testing
  await db.none(`
    -- Organization table
    CREATE TABLE IF NOT EXISTS organization (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- User table
    CREATE TABLE IF NOT EXISTS "user" (
      id VARCHAR(100) PRIMARY KEY,
      organization_id VARCHAR(100) REFERENCES organization(id),
      email VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- API Keys table
    CREATE TABLE IF NOT EXISTS api_key (
      id VARCHAR(100) PRIMARY KEY,
      organization_id VARCHAR(100) REFERENCES organization(id),
      user_id VARCHAR(100) REFERENCES "user"(id),
      key_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Agent Repository table
    CREATE TABLE IF NOT EXISTS agent_repository (
      id SERIAL PRIMARY KEY,
      organization_id VARCHAR(100) REFERENCES organization(id),
      name VARCHAR(255) NOT NULL,
      git_url TEXT NOT NULL,
      branch VARCHAR(255) DEFAULT 'main',
      is_root BOOLEAN DEFAULT false,
      last_sync_commit_hash VARCHAR(255),
      last_sync_at TIMESTAMP,
      last_sync_status VARCHAR(50),
      last_sync_errors JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Git Agent table
    CREATE TABLE IF NOT EXISTS git_agent (
      id SERIAL PRIMARY KEY,
      repository_id INTEGER REFERENCES agent_repository(id),
      name VARCHAR(255) NOT NULL,
      version VARCHAR(50),
      description TEXT,
      model VARCHAR(100),
      temperature NUMERIC(3,2),
      exposed BOOLEAN DEFAULT false,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      frontmatter JSONB,
      last_modified_commit_hash VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Run table (simplified)
    CREATE TABLE IF NOT EXISTS run (
      id VARCHAR(26) PRIMARY KEY,
      organization_id VARCHAR(100) REFERENCES organization(id),
      status VARCHAR(20) NOT NULL,
      initial_input JSONB NOT NULL,
      final_output JSONB,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Step table (simplified)
    CREATE TABLE IF NOT EXISTS step (
      id VARCHAR(26) PRIMARY KEY,
      run_id VARCHAR(26) REFERENCES run(id),
      parent_step_id VARCHAR(26) REFERENCES step(id),
      step_type VARCHAR(20) CHECK (step_type IN ('agent', 'tool')),
      name VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL,
      input JSONB NOT NULL,
      output JSONB,
      webhook_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

// Test data generators
export function generateTestOrganization() {
  return {
    id: `org-${uuidv4()}`,
    name: `Test Organization ${Date.now()}`,
  };
}

export function generateTestUser(organizationId: string) {
  return {
    id: `user-${uuidv4()}`,
    organizationId,
    email: `test-${Date.now()}@example.com`,
  };
}

export function generateTestApiKey(organizationId: string, userId: string) {
  const key = `sk-test-${uuidv4()}`;
  const keyHash = Buffer.from(key).toString("base64"); // Simplified for testing

  return {
    id: `key-${uuidv4()}`,
    organizationId,
    userId,
    key, // Return the actual key for testing
    keyHash,
    name: `Test Key ${Date.now()}`,
  };
}

// HTTP utilities
export async function makeA2ARequest(
  endpoint: string,
  method: string,
  params: unknown,
  options: {
    apiKey?: string;
    jwt?: string;
    isInternal?: boolean;
  } = {},
) {
  const url = options.isInternal
    ? TEST_CONFIG.shaman.a2a.internalUrl
    : TEST_CONFIG.shaman.a2a.publicUrl;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.apiKey) {
    headers["x-api-key"] = options.apiKey;
  } else if (options.jwt) {
    headers["Authorization"] = `Bearer ${options.jwt}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: uuidv4(),
      method,
      params,
    }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

export async function waitForTaskCompletion(
  taskId: string,
  options: {
    apiKey?: string;
    jwt?: string;
    isInternal?: boolean;
    maxAttempts?: number;
    delay?: number;
  } = {},
): Promise<unknown> {
  const maxAttempts = options.maxAttempts || 30;
  const delay = options.delay || 1000;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await makeA2ARequest(
      "",
      "tasks/get",
      { id: taskId },
      options,
    );

    if (response.body.result?.status?.state === "completed") {
      return response.body.result;
    }

    if (response.body.result?.status?.state === "failed") {
      throw new Error(`Task failed: ${JSON.stringify(response.body.result)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Task ${taskId} did not complete within timeout`);
}

// Export database for direct queries in tests
export function getTestDatabase() {
  return db;
}
