import { describe, it, expect } from "vitest";
import {
  canonicalJson,
  sha256Hex,
  canonicalHash,
  CANONICALIZATION_SPEC,
} from "../src/lib/qsignV2/canonicalize";

/**
 * Anchors the QSign v2 canonicalization contract. If any of these flip,
 * existing signatures will fail to verify — guarding against silent
 * regressions to RFC 8785 conformance.
 */

describe("qsignV2 canonicalize", () => {
  it("exposes the right spec name", () => {
    expect(CANONICALIZATION_SPEC).toBe("RFC8785");
  });

  it("sorts object keys lexicographically", () => {
    expect(canonicalJson({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
    expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("omits undefined object properties (RFC 8259)", () => {
    expect(canonicalJson({ a: 1, b: undefined, c: 2 } as any)).toBe('{"a":1,"c":2}');
  });

  it("rejects undefined as a payload", () => {
    expect(() => canonicalJson(undefined as any)).toThrow(/undefined/);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ x: NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ x: Infinity })).toThrow(/non-finite/);
  });

  it("rejects unsupported types", () => {
    expect(() => canonicalJson({ x: () => 1 } as any)).toThrow(/unsupported type/);
    expect(() => canonicalJson({ x: Symbol("s") } as any)).toThrow(/unsupported type/);
    expect(() => canonicalJson({ x: BigInt(1) } as any)).toThrow(/unsupported type/);
  });

  it("path tracking points at the offending field in arrays", () => {
    // Note: undefined in object KEYS is silently omitted (RFC 8259 behavior),
    // but undefined in array slots throws because arrays preserve cardinality.
    expect(() => canonicalJson([1, 2, NaN] as any)).toThrow(/non-finite number at \[2\]/);
    expect(() => canonicalJson({ outer: [undefined] } as any)).toThrow(
      /undefined at outer\[0\]/,
    );
  });

  it("is byte-identical for semantically equal payloads with different key order", () => {
    const a = canonicalJson({ artifact: "x", ts: 100, claims: { jurisdiction: "KZ" } });
    const b = canonicalJson({ ts: 100, claims: { jurisdiction: "KZ" }, artifact: "x" });
    expect(a).toBe(b);
  });

  it("sha256Hex is deterministic and 64-char hex", () => {
    const h = sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("hello")).toBe(h);
  });

  it("canonicalHash combines both", () => {
    const { canonical, hash } = canonicalHash({ b: 1, a: 2 });
    expect(canonical).toBe('{"a":2,"b":1}');
    expect(hash).toBe(sha256Hex('{"a":2,"b":1}'));
  });

  it("nested arrays + objects round-trip identically", () => {
    const v = { z: [{ b: 1, a: 2 }, { d: 4, c: 3 }], a: { y: 5, x: 6 } };
    expect(canonicalJson(v)).toBe('{"a":{"x":6,"y":5},"z":[{"a":2,"b":1},{"c":3,"d":4}]}');
  });

  it("treats null as a valid value (not undefined)", () => {
    expect(canonicalJson({ x: null })).toBe('{"x":null}');
  });
});
