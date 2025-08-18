import type { GitAgent } from "@codespin/shaman-types";
import type { Database } from "@codespin/shaman-db";
import { mapGitAgentFromDb } from "./mappers/map-git-agent-from-db.js";
import type { GitAgentDbRow } from "./types.js";

export async function getGitAgent(
  db: Database,
  id: number,
): Promise<GitAgent | null> {
  const result = await db.oneOrNone<GitAgentDbRow>(
    `SELECT * FROM git_agent WHERE id = $(id)`,
    { id },
  );
  return result ? mapGitAgentFromDb(result) : null;
}
