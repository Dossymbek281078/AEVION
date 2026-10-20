"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAttachmentIds = normalizeAttachmentIds;
exports.fetchQRightAttachments = fetchQRightAttachments;
exports.renderAttachmentsContext = renderAttachmentsContext;
const dbPool_1 = require("../../lib/dbPool");
const ensureQCoreTables_1 = require("../../lib/ensureQCoreTables");
/** Sanitize, dedupe, and bound the requested IDs. */
function normalizeAttachmentIds(raw) {
    if (!Array.isArray(raw))
        return [];
    const seen = new Set();
    for (const v of raw) {
        if (typeof v !== "string")
            continue;
        const t = v.trim();
        if (!t)
            continue;
        if (t.length > 64)
            continue;
        seen.add(t);
        if (seen.size >= 8)
            break; // soft cap — keep prompts compact
    }
    return Array.from(seen);
}
/** Fetch the requested QRight objects in a single round-trip. Missing IDs
 * are silently skipped (caller can compare to know what wasn't found). */
async function fetchQRightAttachments(ids) {
    if (ids.length === 0)
        return [];
    if (!(0, ensureQCoreTables_1.isDbReady)())
        return []; // graceful degrade in in-memory mode
    const pool = (0, dbPool_1.getPool)();
    const result = await pool.query(`SELECT id, title, description, kind, "ownerName", country, city, "createdAt"
     FROM "QRightObject"
     WHERE id = ANY($1::text[])`, [ids]);
    return result.rows.map((row) => {
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
function renderAttachmentsContext(items) {
    if (items.length === 0)
        return "";
    const lines = [
        "[Attached QRight objects — your registered intellectual-property records]",
    ];
    for (const it of items) {
        lines.push("");
        lines.push(`- id: ${it.id}`);
        if (it.title)
            lines.push(`  title: ${it.title}`);
        if (it.kind)
            lines.push(`  kind: ${it.kind}`);
        if (it.ownerName)
            lines.push(`  owner: ${it.ownerName}`);
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
