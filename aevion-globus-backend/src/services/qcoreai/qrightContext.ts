/**
 * Tool use lite — Analyst sees the caller's QRight objects.
 *
 * Read-only access: we query "QRightObject" via the shared pg pool. We do NOT
 * touch the qright router or its schema (per CLAUDE.md §1 — cross-module
 * read-only is explicitly allowed for QCore → QRight).
 *
 * Returns a compact markdown block to prepend to the user's prompt. Empty
 * string when the user has no objects, isn't authenticated, or the table
 * isn't reachable. Never throws.
 */

import { getPool } from "../../lib/dbPool";

const pool = getPool();

const MAX_ITEMS = 25;

type QRightSummary = {
  id: string;
  kind: string | null;
  name: string | null;
  status: string | null;
  createdAt: string | null;
};

/**
 * Fetch up to 25 of the caller's QRight objects, formatted for an LLM.
 * Both ownership predicates (userId, email) match the qright /objects?mine=1 path.
 */
export async function fetchQRightContext(
  userId: string | null,
  email: string | null
): Promise<string> {
  if (!userId && !email) return "";
  try {
    const params: any[] = [];
    let predicate = "";
    if (userId && email) {
      predicate = `("ownerUserId" = $1) OR ("ownerUserId" IS NULL AND "ownerEmail" = $2)`;
      params.push(userId, email);
    } else if (userId) {
      predicate = `"ownerUserId" = $1`;
      params.push(userId);
    } else {
      predicate = `"ownerUserId" IS NULL AND "ownerEmail" = $1`;
      params.push(email!);
    }
    const r = await pool.query(
      `SELECT "id","kind","name","status","createdAt"
         FROM "QRightObject"
        WHERE ${predicate}
        ORDER BY "createdAt" DESC
        LIMIT ${MAX_ITEMS}`,
      params
    );
    const items: QRightSummary[] = r.rows;
    if (!items.length) {
      return "## Tool: QRight objects\n_The user has no QRight objects yet._\n";
    }
    const lines = items.map((it) => {
      const kind = it.kind || "object";
      const name = (it.name || "(untitled)").replace(/\s+/g, " ").slice(0, 80);
      const status = it.status || "unknown";
      const created = it.createdAt
        ? new Date(it.createdAt as any).toISOString().slice(0, 10)
        : "?";
      return `- **${name}** · kind=${kind} · status=${status} · id=${it.id} · created=${created}`;
    });
    const more = items.length === MAX_ITEMS ? `\n_(showing latest ${MAX_ITEMS} only)_` : "";
    return [
      "## Tool: QRight objects (read-only context for the user)",
      "",
      "These are the caller's intellectual-property records on the AEVION platform.",
      "Reference them by name when relevant; do NOT fabricate ids.",
      "",
      ...lines,
      more,
      "",
    ].join("\n");
  } catch {
    return ""; // best-effort; missing table or DB down → no context
  }
}
