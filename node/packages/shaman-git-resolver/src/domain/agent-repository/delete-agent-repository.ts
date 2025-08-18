import type { Database } from "@codespin/shaman-db";

export async function deleteAgentRepository(
  db: Database,
  id: number,
): Promise<boolean> {
  const result = await db.result(
    "DELETE FROM agent_repository WHERE id = $(id)",
    { id },
  );
  return result.rowCount > 0;
}
