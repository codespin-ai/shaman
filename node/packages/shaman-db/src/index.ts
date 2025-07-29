import pgPromise from "pg-promise";

const pgp = pgPromise();

// Default database connection (for backwards compatibility)
const defaultDb = pgp({
  host: process.env.SHAMAN_DB_HOST || 'localhost',
  port: process.env.SHAMAN_DB_PORT
    ? parseInt(process.env.SHAMAN_DB_PORT, 10)
    : 5432,
  database: process.env.SHAMAN_DB_NAME || 'shaman',
  user: process.env.SHAMAN_DB_USER || 'postgres',
  password: process.env.SHAMAN_DB_PASSWORD || 'postgres',
});

export function getDb(): Database {
  return defaultDb;
}

export type Database = pgPromise.IDatabase<unknown>;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function createDatabaseConnection(config: DatabaseConfig): Database {
  return pgp(config);
}

// Support for multiple databases (existing Shaman pattern)
const databaseConnections = new Map<string, Database>();

export function getDatabaseConnection(dbName: string): Database {
  if (databaseConnections.has(dbName)) {
    return databaseConnections.get(dbName)!;
  }

  const config: DatabaseConfig = {
    host: process.env[`${dbName.toUpperCase()}_DB_HOST`] || 'localhost',
    port: process.env[`${dbName.toUpperCase()}_DB_PORT`]
      ? parseInt(process.env[`${dbName.toUpperCase()}_DB_PORT`]!, 10)
      : 5432,
    database: process.env[`${dbName.toUpperCase()}_DB_NAME`] || dbName,
    user: process.env[`${dbName.toUpperCase()}_DB_USER`] || 'postgres',
    password: process.env[`${dbName.toUpperCase()}_DB_PASSWORD`] || 'postgres',
  };

  const connection = createDatabaseConnection(config);
  databaseConnections.set(dbName, connection);
  return connection;
}