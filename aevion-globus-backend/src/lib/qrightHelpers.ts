// Pure (no DB / no IO) helpers extracted from src/routes/qright.ts so
// they can be exercised in isolation by vitest. The route file imports
// them; behaviour is unchanged.

import crypto from "node:crypto";

// Validate and normalize a SRI-like ?expected-hash=<sha256> query param.
// Embeds pin the contentHash they were originally built around so that any
// drift on the server (re-issued under same id, or DB tampering) is detected
// by the third-party page WITHOUT trusting the embed JSON itself. Returns the
// normalized lowercase hex if syntactically valid (64 hex chars), else null.
// Accepts both `expected-hash` and `expectedHash` for ergonomics.
export function readExpectedHash(query: Record<string, unknown>): string | null {
  const raw = query["expected-hash"] ?? query["expectedHash"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  const trimmed = v.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(trimmed)) return null;
  return trimmed;
}

// Constant-time string compare for hex hashes. Both inputs assumed lowercase
// hex of the same length; falls back to false on length mismatch or invalid hex.
export function timingSafeHexEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// Extract a privacy-safe bucket key from the Referer header.
// Hostname only (no path/port/query/protocol/UA), lowercased and stripped
// of leading "www." so example.com and www.example.com share a row.
// Anything that doesn't parse → "(direct)".
export function refererHost(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const raw = req.headers["referer"] || req.headers["referrer"];
  const ref = Array.isArray(raw) ? raw[0] : raw;
  if (!ref || typeof ref !== "string") return "(direct)";
  try {
    const u = new URL(ref);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (!host) return "(direct)";
    // Defensive cap — a malformed/abusive Referer with a 2 KB hostname
    // shouldn't be allowed to bloat the row.
    return host.slice(0, 253);
  } catch {
    return "(direct)";
  }
}
