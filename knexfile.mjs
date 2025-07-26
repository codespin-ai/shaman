/**
 * @type {import('knex').Knex.Config}
 */
const config = {
  client: "postgresql",
  connection: {
    host: process.env.SHAMAN_DB_HOST,
    database: process.env.SHAMAN_DB_NAME,
    user: process.env.SHAMAN_DB_USER,
    password: process.env.SHAMAN_DB_PASSWORD,
    port: process.env.SHAMAN_DB_PORT ? parseInt(process.env.SHAMAN_DB_PORT, 10) : 5432,
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: "knex_migrations",
    directory: "./database/migrations",
    loadExtensions: [".mjs"],
  },
  seeds: {
    directory: "./database/seeds",
    loadExtensions: [".mjs"],
  },
};

export default config;
