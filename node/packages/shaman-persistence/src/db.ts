/**
 * packages/shaman-persistence/src/db.ts
 *
 * This module initializes and exports a singleton instance of the pg-promise database connection.
 */

import pgPromise from "pg-promise";
import { IMain } from "pg-promise";

// Initialize pg-promise
const pgp: IMain = pgPromise({});

// Database connection configuration
const cn = {
  host: process.env.SHAMAN_DB_HOST || 'localhost',
  port: process.env.SHAMAN_DB_PORT
    ? parseInt(process.env.SHAMAN_DB_PORT, 10)
    : 5432,
  database: process.env.SHAMAN_DB_NAME,
  user: process.env.SHAMAN_DB_USER,
  password: process.env.SHAMAN_DB_PASSWORD,
};

// Create the database instance
export const db = pgp(cn);
