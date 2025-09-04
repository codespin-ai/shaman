import type pgPromise from "pg-promise";
import type { Database, QueryParams } from "./index.js";

/**
 * RLS Database Wrapper
 *
 * This wrapper automatically injects the organization context (app.current_org_id)
 * before every query to ensure Row Level Security policies are applied.
 *
 * It uses transactions with SET LOCAL to ensure the context is properly scoped.
 */
export class RlsDatabaseWrapper implements Database {
  constructor(
    private db: pgPromise.IDatabase<Record<string, unknown>>,
    private orgId: string,
  ) {
    if (!orgId) {
      throw new Error("Organization ID is required for RLS database");
    }
  }

  /**
   * Wraps a database operation with organization context
   * Uses SET LOCAL within a transaction to ensure proper scoping
   */
  private async withOrgContext<T>(
    operation: (db: pgPromise.ITask<Record<string, unknown>>) => Promise<T>,
  ): Promise<T> {
    // For single queries, use a savepoint to minimize overhead
    return this.db.tx("rls-context", async (t) => {
      await t.none("SET LOCAL app.current_org_id = $1", [this.orgId]);
      return operation(t);
    });
  }

  async query<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.withOrgContext((db) => db.query<T>(query, values)) as Promise<
      T[]
    >;
  }

  async one<T>(query: string, values?: QueryParams): Promise<T> {
    return this.withOrgContext((db) => db.one<T>(query, values));
  }

  async oneOrNone<T>(query: string, values?: QueryParams): Promise<T | null> {
    return this.withOrgContext((db) => db.oneOrNone<T>(query, values));
  }

  async none(query: string, values?: QueryParams): Promise<null> {
    return this.withOrgContext((db) => db.none(query, values));
  }

  async many<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.withOrgContext((db) => db.many<T>(query, values));
  }

  async manyOrNone<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.withOrgContext((db) => db.manyOrNone<T>(query, values));
  }

  async any<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.withOrgContext((db) => db.any<T>(query, values));
  }

  async result(query: string, values?: QueryParams): Promise<pgPromise.IResultExt> {
    return this.withOrgContext((db) => db.result(query, values));
  }

  /**
   * Handle nested transactions
   * The organization context is set at the beginning of the transaction
   */
  async tx<T>(callback: (t: Database) => Promise<T>): Promise<T> {
    return this.db.tx("rls-tx", async (t) => {
      // Set context for this transaction
      await t.none("SET LOCAL app.current_org_id = $1", [this.orgId]);

      // Create a transaction wrapper that doesn't re-set context
      const txWrapper = new TransactionWrapper(t, this.orgId);
      return callback(txWrapper);
    });
  }
}

/**
 * Transaction Wrapper
 *
 * Used within transactions to avoid re-setting the organization context
 * since SET LOCAL is already applied at the transaction level.
 */
class TransactionWrapper implements Database {
  constructor(
    private t: pgPromise.ITask<Record<string, unknown>>,
    private orgId: string,
  ) {}

  async query<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.t.query<T>(query, values) as Promise<T[]>;
  }

  async one<T>(query: string, values?: QueryParams): Promise<T> {
    return this.t.one<T>(query, values);
  }

  async oneOrNone<T>(query: string, values?: QueryParams): Promise<T | null> {
    return this.t.oneOrNone<T>(query, values);
  }

  async none(query: string, values?: QueryParams): Promise<null> {
    return this.t.none(query, values);
  }

  async many<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.t.many<T>(query, values);
  }

  async manyOrNone<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.t.manyOrNone<T>(query, values);
  }

  async any<T>(query: string, values?: QueryParams): Promise<T[]> {
    return this.t.any<T>(query, values);
  }

  async result(query: string, values?: QueryParams): Promise<pgPromise.IResultExt> {
    return this.t.result(query, values);
  }

  /**
   * Nested transaction within an already contextualized transaction
   */
  async tx<T>(callback: (t: Database) => Promise<T>): Promise<T> {
    return this.t.tx("nested-tx", async (nestedT) => {
      // Context is already set by parent transaction
      const nestedWrapper = new TransactionWrapper(nestedT, this.orgId);
      return callback(nestedWrapper);
    });
  }
}
