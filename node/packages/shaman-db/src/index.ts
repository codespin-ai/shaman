import pgPromise from "pg-promise";
import { RlsDatabaseWrapper } from "./rls-wrapper.js";

const pgp = pgPromise();

// Type for query parameters - can be object with named params or array for positional
// We use unknown to allow any object type, as pg-promise handles the conversion
export type QueryParams = unknown;

export interface Database {
  query: <T>(query: string, values?: QueryParams) => Promise<T[]>;
  one: <T>(query: string, values?: QueryParams) => Promise<T>;
  oneOrNone: <T>(query: string, values?: QueryParams) => Promise<T | null>;
  none: (query: string, values?: QueryParams) => Promise<null>;
  many: <T>(query: string, values?: QueryParams) => Promise<T[]>;
  manyOrNone: <T>(query: string, values?: QueryParams) => Promise<T[]>;
  any: <T>(query: string, values?: QueryParams) => Promise<T[]>;
  result: (
    query: string,
    values?: QueryParams,
  ) => Promise<pgPromise.IResultExt>;
  tx: <T>(callback: (t: Database) => Promise<T>) => Promise<T>;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Create RLS-enabled database connection
export function createRlsDb(orgId: string): Database {
  if (!orgId) {
    throw new Error("Organization ID is required for RLS database");
  }

  const config: DatabaseConfig = {
    host: process.env.SHAMAN_DB_HOST || "localhost",
    port: process.env.SHAMAN_DB_PORT
      ? parseInt(process.env.SHAMAN_DB_PORT, 10)
      : 5432,
    database: process.env.SHAMAN_DB_NAME || "shaman",
    user: process.env.RLS_DB_USER || "rls_db_user",
    password: process.env.RLS_DB_USER_PASSWORD || "",
  };

  if (!config.password) {
    throw new Error("RLS_DB_USER_PASSWORD environment variable is required");
  }

  const db = pgp(config) as pgPromise.IDatabase<Record<string, unknown>>;
  return new RlsDatabaseWrapper(db, orgId);
}

// Create unrestricted database connection (for migrations, admin tasks)
export function createUnrestrictedDb(): Database {
  const config: DatabaseConfig = {
    host: process.env.SHAMAN_DB_HOST || "localhost",
    port: process.env.SHAMAN_DB_PORT
      ? parseInt(process.env.SHAMAN_DB_PORT, 10)
      : 5432,
    database: process.env.SHAMAN_DB_NAME || "shaman",
    user: process.env.UNRESTRICTED_DB_USER || "unrestricted_db_user",
    password: process.env.UNRESTRICTED_DB_USER_PASSWORD || "",
  };

  if (!config.password) {
    throw new Error(
      "UNRESTRICTED_DB_USER_PASSWORD environment variable is required",
    );
  }

  return pgp(config) as Database;
}

// Legacy functions for backwards compatibility
// Default database connection (for backwards compatibility - uses unrestricted user)
const defaultDb = pgp({
  host: process.env.SHAMAN_DB_HOST || "localhost",
  port: process.env.SHAMAN_DB_PORT
    ? parseInt(process.env.SHAMAN_DB_PORT, 10)
    : 5432,
  database: process.env.SHAMAN_DB_NAME || "shaman",
  user: process.env.SHAMAN_DB_USER || "postgres",
  password: process.env.SHAMAN_DB_PASSWORD || "postgres",
});

export function getDb(): Database {
  // DEPRECATED: getDb() uses legacy connection. Use createRlsDb() or createUnrestrictedDb() instead.
  return defaultDb as Database;
}

export function createDatabaseConnection(config: DatabaseConfig): Database {
  return pgp(config) as Database;
}

// Support for multiple databases (existing Shaman pattern)
const databaseConnections = new Map<string, Database>();

export function getDatabaseConnection(dbName: string): Database {
  if (databaseConnections.has(dbName)) {
    return databaseConnections.get(dbName)!;
  }

  const config: DatabaseConfig = {
    host: process.env[`${dbName.toUpperCase()}_DB_HOST`] || "localhost",
    port: process.env[`${dbName.toUpperCase()}_DB_PORT`]
      ? parseInt(process.env[`${dbName.toUpperCase()}_DB_PORT`]!, 10)
      : 5432,
    database: process.env[`${dbName.toUpperCase()}_DB_NAME`] || dbName,
    user: process.env[`${dbName.toUpperCase()}_DB_USER`] || "postgres",
    password: process.env[`${dbName.toUpperCase()}_DB_PASSWORD`] || "postgres",
  };

  const connection = createDatabaseConnection(config);
  databaseConnections.set(dbName, connection);
  return connection;
}
