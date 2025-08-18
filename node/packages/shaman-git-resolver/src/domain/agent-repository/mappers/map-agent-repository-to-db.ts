import type { AgentRepository } from "@codespin/shaman-types";
import type { AgentRepositoryDbRow } from "../types.js";

/**
 * Map domain type to database row (for inserts/updates)
 */
export function mapAgentRepositoryToDb(
  repo: Omit<AgentRepository, "id" | "createdAt" | "updatedAt">,
): Omit<AgentRepositoryDbRow, "id" | "created_at" | "updated_at"> {
  return {
    org_id: repo.orgId,
    name: repo.name,
    git_url: repo.gitUrl,
    branch: repo.branch,
    is_root: repo.isRoot,
    last_sync_commit_hash: repo.lastSyncCommitHash,
    last_sync_at: repo.lastSyncAt,
    last_sync_status: repo.lastSyncStatus,
    last_sync_errors: repo.lastSyncErrors,
    created_by: repo.createdBy,
  };
}
