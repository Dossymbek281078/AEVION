/**
 * Model-reply JSON extraction — shared across every route that asks an LLM
 * for structured output (DevHub /generate, /plan, agent tools…).
 *
 * Models wrap JSON in prose and fences in every combination, and max_tokens
 * can cut a reply mid-string. Born in DevHub's flagship-flow hardening
 * (2026-07-22/23): first as inline parsing, then generalized here.
 */

/** Try the likeliest extractions in order: raw object → fenced block →
 * first-'{' through last-'}'. Returns the parsed value or null. */
export function extractJsonObject(reply: string): unknown | null {
  const raw = reply.trim();
  const candidates: string[] = [];
  if (raw.startsWith("{")) candidates.push(raw);
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]+?)```/);
  if (fence) candidates.push(fence[1].trim());
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch { /* try the next extraction */ }
  }
  return null;
}

/**
 * Recover every COMPLETE object from a (possibly truncated) `"key": [...]`
 * array. Walks strings with escape awareness so braces inside string values
 * don't fool the depth counter; the cut-off tail object is dropped.
 */
export function salvageCompleteArrayObjects(raw: string, arrayKey: string): unknown[] {
  const keyIdx = raw.indexOf(`"${arrayKey}"`);
  if (keyIdx < 0) return [];
  const out: unknown[] = [];
  let i = raw.indexOf("[", keyIdx);
  if (i < 0) return [];
  const n = raw.length;
  while (i < n) {
    const objStart = raw.indexOf("{", i);
    if (objStart < 0) break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let j = objStart; j < n; j++) {
      const ch = raw[j];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end < 0) break; // truncated tail — stop here
    try {
      out.push(JSON.parse(raw.slice(objStart, end + 1)));
    } catch { /* malformed object — skip it */ }
    i = end + 1;
  }
  return out;
}
