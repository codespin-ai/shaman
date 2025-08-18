import type { Database } from "@codespin/shaman-db";

export async function deleteGitAgent(
  db: Database,
  id: number,
): Promise<boolean> {
  const result = await db.result("DELETE FROM git_agent WHERE id = $(id)", {
    id,
  });
  return result.rowCount > 0;
}
