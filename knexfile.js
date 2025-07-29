// Base knex configuration that can be extended by database-specific configs
export const baseConfig = {
  client: 'postgresql',
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations',
    loadExtensions: ['.mjs', '.js']
  }
};

// Helper function to create a database-specific config
export function createDbConfig(dbName, overrides = {}) {
  const dbNameUpper = dbName.toUpperCase();
  
  return {
    ...baseConfig,
    connection: {
      host: process.env[`${dbNameUpper}_DB_HOST`],
      port: process.env[`${dbNameUpper}_DB_PORT`] ? parseInt(process.env[`${dbNameUpper}_DB_PORT`], 10) : 5432,
      database: process.env[`${dbNameUpper}_DB_NAME`],
      user: process.env[`${dbNameUpper}_DB_USER`],
      password: process.env[`${dbNameUpper}_DB_PASSWORD`]
    },
    migrations: {
      ...baseConfig.migrations,
      directory: './migrations'
    },
    seeds: {
      directory: './seeds',
      loadExtensions: ['.mjs', '.js']
    },
    ...overrides
  };
}

// No default export - this file only provides base configuration for database-specific configs
// Each database must have its own knexfile.js that imports and uses createDbConfig