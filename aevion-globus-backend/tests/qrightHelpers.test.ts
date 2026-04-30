import { describe, test, expect } from "vitest";
import {
  readExpectedHash,
  timingSafeHexEq,
  refererHost,
} from "../src/lib/qrightHelpers";

describe("readExpectedHash", () => {
  const validHex = "a".repeat(64);

  test("returns null when query has no relevant key", () => {
    expect(readExpectedHash({})).toBeNull();
    expect(readExpectedHash({ other: "x" })).toBeNull();
  });

  test("returns null for non-string values", () => {
    expect(readExpectedHash({ "expected-hash": 123 })).toBeNull();
    expect(readExpectedHash({ "expected-hash": null })).toBeNull();
    expect(readExpectedHash({ "expected-hash": {} })).toBeNull();
  });

  test("accepts both expected-hash and expectedHash spellings", () => {
    expect(readExpectedHash({ "expected-hash": validHex })).toBe(validHex);
    expect(readExpectedHash({ expectedHash: validHex })).toBe(validHex);
  });

  test("normalizes uppercase to lowercase", () => {
    const upper = "A".repeat(64);
    expect(readExpectedHash({ "expected-hash": upper })).toBe("a".repeat(64));
  });

  test("trims surrounding whitespace before validation", () => {
    expect(readExpectedHash({ "expected-hash": `  ${validHex}  ` })).toBe(
      validHex
    );
  });

  test("rejects strings that are not exactly 64 hex chars", () => {
    expect(readExpectedHash({ "expected-hash": "abc" })).toBeNull();
    expect(readExpectedHash({ "expected-hash": "z".repeat(64) })).toBeNull();
    expect(readExpectedHash({ "expected-hash": "a".repeat(63) })).toBeNull();
    expect(readExpectedHash({ "expected-hash": "a".repeat(65) })).toBeNull();
  });

  test("picks the first element when value is an array", () => {
    expect(readExpectedHash({ "expected-hash": [validHex, "junk"] })).toBe(
      validHex
    );
  });

  test("expected-hash takes precedence over expectedHash", () => {
    const a = "a".repeat(64);
    const b = "b".repeat(64);
    expect(readExpectedHash({ "expected-hash": a, expectedHash: b })).toBe(a);
  });
});

describe("timingSafeHexEq", () => {
  test("returns true for identical hex strings", () => {
    expect(timingSafeHexEq("deadbeef", "deadbeef")).toBe(true);
  });

  test("returns false for different hex of equal length", () => {
    expect(timingSafeHexEq("deadbeef", "cafebabe")).toBe(false);
  });

  test("returns false for length mismatch without throwing", () => {
    expect(timingSafeHexEq("dead", "deadbeef")).toBe(false);
  });

  test("does not throw on invalid hex", () => {
    // Buffer.from("…", "hex") silently drops non-hex chars rather than
    // throwing. The function still returns a defined boolean — the contract
    // is "doesn't throw", not "rejects every malformed input upstream".
    // Caller (readExpectedHash) is responsible for syntactic validation.
    expect(() => timingSafeHexEq("zz", "zz")).not.toThrow();
  });

  test("is case-insensitive at the byte level (Node hex parses both)", () => {
    // Documented Node behaviour: Buffer.from(hex, "hex") accepts mixed case.
    // We rely on this so callers don't have to lowercase twice — readExpectedHash
    // already lowercases user input, so a stored uppercase hash would still match.
    expect(timingSafeHexEq("deadbeef", "DEADBEEF")).toBe(true);
  });
});

describe("refererHost", () => {
  function req(referer?: string | string[] | undefined): {
    headers: Record<string, string | string[] | undefined>;
  } {
    return { headers: referer === undefined ? {} : { referer } };
  }

  test("returns (direct) when no Referer header", () => {
    expect(refererHost(req())).toBe("(direct)");
  });

  test("returns (direct) when Referer is empty string", () => {
    expect(refererHost(req(""))).toBe("(direct)");
  });

  test("returns (direct) when Referer is unparseable", () => {
    expect(refererHost(req("not a url"))).toBe("(direct)");
    expect(refererHost(req("htp:/broken"))).toBe("(direct)");
  });

  test("extracts hostname from absolute URL", () => {
    expect(refererHost(req("https://example.com/blog/post"))).toBe(
      "example.com"
    );
  });

  test("strips leading www.", () => {
    expect(refererHost(req("https://www.example.com/"))).toBe("example.com");
  });

  test("does not strip non-leading www in subdomain", () => {
    expect(refererHost(req("https://api.www.example.com/"))).toBe(
      "api.www.example.com"
    );
  });

  test("lowercases hostname", () => {
    expect(refererHost(req("https://Example.COM/"))).toBe("example.com");
  });

  test("ignores port and path and query", () => {
    expect(
      refererHost(req("https://example.com:8443/foo/bar?baz=qux#frag"))
    ).toBe("example.com");
  });

  test("uses first element when Referer header is an array", () => {
    expect(refererHost(req(["https://first.com/", "https://second.com/"]))).toBe(
      "first.com"
    );
  });

  test("falls back to referrer (alt spelling) when referer missing", () => {
    const r = { headers: { referrer: "https://example.com/" } };
    expect(refererHost(r)).toBe("example.com");
  });

  test("caps abusive hostnames at 253 chars", () => {
    const long = "a".repeat(300) + ".com";
    const out = refererHost(req(`https://${long}/`));
    expect(out.length).toBeLessThanOrEqual(253);
  });
});
