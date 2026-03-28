"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = stableStringify;
function isPlainObject(value) {
    if (!value || typeof value !== "object")
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function normalize(value) {
    if (value === null)
        return null;
    if (value === undefined)
        return null;
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean")
        return value;
    if (t === "bigint")
        return value.toString();
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value)) {
        return value.map((x) => normalize(x));
    }
    if (isPlainObject(value)) {
        const entries = Object.keys(value)
            .sort()
            .map((k) => [k, normalize(value[k])]);
        return Object.fromEntries(entries);
    }
    // Fallback: best-effort stable representation
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return String(value);
    }
}
function stableStringify(value) {
    return JSON.stringify(normalize(value));
}
