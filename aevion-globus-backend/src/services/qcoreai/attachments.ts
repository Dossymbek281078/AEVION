import { getPool } from "../../lib/dbPool";
import { isDbReady } from "../../lib/ensureQCoreTables";

/**
 * QRight context attachments — a lightweight "tool use" for QCoreAI.
 *
 * The user picks one or more existing QRight objects (works/IPs they
 * registered) on the multi-agent UI; backend pre-fetches them from the
 * QRightObject table and prepends a compact context block to the
 * Analyst's user prompt. The agents now reason against the user's own
 * registered IP without needing a live tool-call loop. This is the
 * pragmatic 90% of "Tool use" without the multi-turn LLM machinery.
 *
 * Read-only and decoupled from the QRight router on purpose: this code
 * never mutates QRight state and never widens its API surface.
 */

export type QRightAttachment = {
  id: string;
  title: string | null;
  description: string | null;
  kind: string | null;
  ownerName: string | null;
  country: string | null;
  city: string | null;
  createdAt: string | null;
};

/** Sanitize, dedupe, and bound the requested IDs. */
export function normalizeAttachmentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    if (t.length > 64) continue;
    seen.add(t);
    if (seen.size >= 8) break; // soft cap — keep prompts compact
  }
  return Array.from(seen);
}

/** Fetch the requested QRight objects in a single round-trip. Missing IDs
 * are silently skipped (caller can compare to know what wasn't found). */
export async function fetchQRightAttachments(ids: string[]): Promise<QRightAttachment[]> {
  if (ids.length === 0) return [];
  if (!isDbReady()) return []; // graceful degrade in in-memory mode

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, title, description, kind, "ownerName", country, city, "createdAt"
     FROM "QRightObject"
     WHERE id = ANY($1::text[])`,
    [ids]
  );
  return (result.rows as Array<Record<string, unknown>>).map((row) => {
    const created = row.createdAt;
    return {
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : null,
      description: typeof row.description === "string" ? row.description : null,
      kind: typeof row.kind === "string" ? row.kind : null,
      ownerName: typeof row.ownerName === "string" ? row.ownerName : null,
      country: typeof row.country === "string" ? row.country : null,
      city: typeof row.city === "string" ? row.city : null,
      createdAt: created instanceof Date ? created.toISOString() : null,
    };
  });
}

/** Render the context block prepended to the Analyst's user prompt. */
export function renderAttachmentsContext(items: QRightAttachment[]): string {
  if (items.length === 0) return "";
  const lines: string[] = [
    "[Attached QRight objects — your registered intellectual-property records]",
  ];
  for (const it of items) {
    lines.push("");
    lines.push(`- id: ${it.id}`);
    if (it.title) lines.push(`  title: ${it.title}`);
    if (it.kind) lines.push(`  kind: ${it.kind}`);
    if (it.ownerName) lines.push(`  owner: ${it.ownerName}`);
    if (it.country || it.city) {
      lines.push(`  jurisdiction: ${[it.country, it.city].filter(Boolean).join(" / ")}`);
    }
    if (it.description) {
      const desc = it.description.replace(/\s+/g, " ").trim().slice(0, 800);
      lines.push(`  description: ${desc}`);
    }
  }
  lines.push("");
  lines.push("[End attached objects. Use them as factual grounding for your answer.]");
  return lines.join("\n");
}
