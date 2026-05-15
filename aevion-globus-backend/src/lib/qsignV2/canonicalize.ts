import crypto from "crypto";

/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS).
 *
 * NOTE on dependency choice:
 * We deliberately do NOT depend on the npm `canonicalize` package.
 * `canonicalize@3.x` is ESM-only; this backend is CommonJS
 * (tsconfig module=commonjs, package.json type=commonjs), so requiring
 * the ESM module from CJS is unreliable across Node runtimes.
 *
 * The JCS algorithm itself is small and deterministic:
 *   - object members sorted lexicographically by UTF-16 code units
 *     (= default JS string comparison)
 *   - recursive canonicalization of nested values
 *   - numbers formatted per ECMA-262 Number.prototype.toString,
 *     which is exactly what native JSON.stringify produces
 *   - strings escaped per RFC 8259 (native JSON.stringify compliant)
 *
 * The implementation below is intentionally strict: any non-JSON value
 * (undefined, functions, Symbols, BigInt, NaN, Infinity) raises an error
 * so callers cannot accidentally sign non-canonical data.
 */

export const CANONICALIZATION_SPEC = "RFC8785";

function normalize(value: unknown, path: string): unknown {
  if (value === null) return null;

  const t = typeof value;

  if (t === "undefined") {
    throw new Error(`qsign/canonicalize: undefined at ${path || "<root>"}`);
  }
  if (t === "function" || t === "symbol" || t === "bigint") {
    throw new Error(`qsign/canonicalize: unsupported type '${t}' at ${path || "<root>"}`);
  }
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error(`qsign/canonicalize: non-finite number at ${path || "<root>"}`);
    }
    return value;
  }
  if (t === "string" || t === "boolean") return value;

  if (Array.isArray(value)) {
    return (value as unknown[]).map((item, idx) => normalize(item, `${path}[${idx}]`));
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "undefined") continue; // RFC 8259: undefined properties omitted
      out[k] = normalize(v, path ? `${path}.${k}` : k);
    }
    return out;
  }

  throw new Error(`qsign/canonicalize: unsupported value at ${path || "<root>"}`);
}

/**
 * Canonicalize a JSON-serializable value per RFC 8785 (JCS).
 * Deterministic key ordering, no whitespace, rejects non-JSON types.
 */
export function canonicalJson(value: unknown): string {
  if (typeof value === "undefined") {
    throw new Error("qsign/canonicalize: payload must not be undefined");
  }
  const normalized = normalize(value, "");
  return JSON.stringify(normalized);
}

/** SHA-256 hex digest of a canonical string. */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Convenience: canonicalize + hash in one step. */
export function canonicalHash(value: unknown): { canonical: string; hash: string } {
  const canonical = canonicalJson(value);
  const hash = sha256Hex(canonical);
  return { canonical, hash };
}
