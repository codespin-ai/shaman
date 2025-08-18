/**
 * @codespin/shaman-gql-server
 *
 * GraphQL management API server for Shaman
 * Handles all management operations - NO agent execution
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Re-export the GraphQL schema as a string
export const schemaPath = join(__dirname, "schema.graphql");

export function getSchema(): string {
  return readFileSync(schemaPath, "utf-8");
}

// Export types
export type { GraphQLContext } from "./context.js";
