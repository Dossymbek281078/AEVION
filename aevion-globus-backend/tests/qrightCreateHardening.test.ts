import { describe, test, expect } from "vitest";
import { _qrightClampStr, _qrightKinds } from "../src/routes/qright";

// QRight POST /objects Tier 3 hardening — 2026-05-09.
//
// Findings:
//   1. No length caps. A single anonymous POST could insert a 10MB
//      description (limited only by Express body parser).
//   2. `kind` accepted any string — pollutes the registry with arbitrary
//      categories that frontend filters can't render.
//   3. Authenticated user could pass arbitrary ownerName/ownerEmail in body
//      and have them stored alongside their resolved ownerUserId — display
//      gradient broke (anyone could "claim" another user's display name).
//   4. 500 response leaked Postgres internals (err.code, err.name,
//      err.message) — fingerprinting + DoS surface.
//
// Fixed:
//   - clampStr: trim + max-length truncation, null for invalid types
//   - QRIGHT_KINDS allowlist: code/text/image/music/movie/design/other
//   - When auth present, ownerName/ownerEmail are OVERWRITTEN from JWT subject
//   - 500 response is now stable {error: "create_failed"} only

describe("QRight clampStr — fix #1 length caps", () => {
  test("returns trimmed string when within limit", () => {
    expect(_qrightClampStr("hello", 100)).toBe("hello");
    expect(_qrightClampStr("  spaced  ", 100)).toBe("spaced");
  });

  test("truncates to max length", () => {
    const long = "x".repeat(10_000);
    expect(_qrightClampStr(long, 300)).toBe("x".repeat(300));
    expect(_qrightClampStr(long, 300)?.length).toBe(300);
  });

  test("returns null for null/undefined/empty", () => {
    expect(_qrightClampStr(null, 100)).toBeNull();
    expect(_qrightClampStr(undefined, 100)).toBeNull();
    expect(_qrightClampStr("", 100)).toBeNull();
    expect(_qrightClampStr("   ", 100)).toBeNull();
  });

  test("returns null for non-string types", () => {
    expect(_qrightClampStr(123, 100)).toBeNull();
    expect(_qrightClampStr({}, 100)).toBeNull();
    expect(_qrightClampStr([], 100)).toBeNull();
    expect(_qrightClampStr(true, 100)).toBeNull();
  });

  test("preserves unicode safely (no byte truncation)", () => {
    const cyrillic = "Произведение".repeat(50);
    const out = _qrightClampStr(cyrillic, 30);
    expect(out?.length).toBe(30);
    // Each character is a UTF-16 code unit; no half-encoded surrogate pairs
    // since this string has none. Just verify length cap holds.
  });

  test("trims first, then measures", () => {
    expect(_qrightClampStr("  hi  ", 100)).toBe("hi");
    // Whitespace-only of any length still null
    expect(_qrightClampStr("       ".repeat(100), 100)).toBeNull();
  });
});

describe("QRight kind enum — fix #2", () => {
  test("contains expected work types", () => {
    expect(_qrightKinds.has("code")).toBe(true);
    expect(_qrightKinds.has("text")).toBe(true);
    expect(_qrightKinds.has("image")).toBe(true);
    expect(_qrightKinds.has("music")).toBe(true);
    expect(_qrightKinds.has("movie")).toBe(true);
    expect(_qrightKinds.has("design")).toBe(true);
    expect(_qrightKinds.has("other")).toBe(true);
  });

  test("rejects arbitrary strings (registry cleanliness)", () => {
    expect(_qrightKinds.has("malicious-payload")).toBe(false);
    expect(_qrightKinds.has("<script>")).toBe(false);
    expect(_qrightKinds.has("'; DROP TABLE")).toBe(false);
    expect(_qrightKinds.has("CODE")).toBe(false); // case-sensitive
    expect(_qrightKinds.has(" code")).toBe(false); // whitespace-sensitive
    expect(_qrightKinds.has("")).toBe(false);
  });

  test("size is bounded — adding kinds requires conscious change", () => {
    // Pin the count so a future PR can't silently add 'admin' or similar
    // without updating tests.
    expect(_qrightKinds.size).toBe(7);
  });
});
