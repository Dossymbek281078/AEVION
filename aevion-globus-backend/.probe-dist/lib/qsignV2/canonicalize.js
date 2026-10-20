"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICALIZATION_SPEC = void 0;
exports.canonicalJson = canonicalJson;
exports.sha256Hex = sha256Hex;
exports.canonicalHash = canonicalHash;
const crypto_1 = __importDefault(require("crypto"));
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
exports.CANONICALIZATION_SPEC = "RFC8785";
function normalize(value, path) {
    if (value === null)
        return null;
    const t = typeof value;
    if (t === "undefined") {
        throw new Error(`qsign/canonicalize: undefined at ${path || "<root>"}`);
    }
    if (t === "function" || t === "symbol" || t === "bigint") {
        throw new Error(`qsign/canonicalize: unsupported type '${t}' at ${path || "<root>"}`);
    }
    if (t === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(`qsign/canonicalize: non-finite number at ${path || "<root>"}`);
        }
        return value;
    }
    if (t === "string" || t === "boolean")
        return value;
    if (Array.isArray(value)) {
        return value.map((item, idx) => normalize(item, `${path}[${idx}]`));
    }
    if (t === "object") {
        const obj = value;
        const keys = Object.keys(obj).sort();
        const out = {};
        for (const k of keys) {
            const v = obj[k];
            if (typeof v === "undefined")
                continue; // RFC 8259: undefined properties omitted
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
function canonicalJson(value) {
    if (typeof value === "undefined") {
        throw new Error("qsign/canonicalize: payload must not be undefined");
    }
    const normalized = normalize(value, "");
    return JSON.stringify(normalized);
}
/** SHA-256 hex digest of a canonical string. */
function sha256Hex(input) {
    return crypto_1.default.createHash("sha256").update(input, "utf8").digest("hex");
}
/** Convenience: canonicalize + hash in one step. */
function canonicalHash(value) {
    const canonical = canonicalJson(value);
    const hash = sha256Hex(canonical);
    return { canonical, hash };
}
