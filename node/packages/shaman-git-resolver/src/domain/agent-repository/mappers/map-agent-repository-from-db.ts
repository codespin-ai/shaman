import type { AgentRepository } from "@codespin/shaman-types";
import type { AgentRepositoryDbRow } from "../types.js";

/**
 * Map database row to domain type
 */
export function mapAgentRepositoryFromDb(
  row: AgentRepositoryDbRow,
): AgentRepository {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    gitUrl: row.git_url,
    branch: row.branch,
    isRoot: row.is_root,
    lastSyncCommitHash: row.last_sync_commit_hash,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as AgentRepository["lastSyncStatus"],
    lastSyncErrors: row.last_sync_errors as Record<string, unknown> | null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
