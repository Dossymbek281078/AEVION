"use strict";
/**
 * Real ML-DSA-65 (FIPS 204 Dilithium) — opt-in via QSIGN_DILITHIUM_V1_SEED.
 *
 * Backed by `@noble/post-quantum`, a pure-JS audited implementation. The
 * package is ESM-only; this backend is CJS, so we load it via a runtime
 * `new Function('return import()')` shim that survives tsc's transformation
 * to require(). The module is loaded lazily on first sign/verify call and
 * cached for the process lifetime.
 *
 * Two modes coexist for backward compatibility with rows signed under the
 * old preview path:
 *
 *   PREVIEW  — deterministic SHA-512(canonical || kid), 128 hex chars,
 *              `mode: "preview"`. No private key needed. Fallback when
 *              QSIGN_DILITHIUM_V1_SEED is unset.
 *
 *   REAL     — actual ML-DSA-65 signature, ~6618 hex chars, `mode: "real"`.
 *              Requires QSIGN_DILITHIUM_V1_SEED (32-hex-byte seed).
 *
 * Verify auto-detects by signature length so a /verify call against a
 * historical preview row still returns valid even after env upgrade.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DILITHIUM_REAL_HEX_LEN = exports.DILITHIUM_PREVIEW_HEX_LEN = exports.DILITHIUM_KID_PREVIEW = exports.DILITHIUM_KID_REAL = void 0;
exports.getActiveDilithium = getActiveDilithium;
exports.dilithiumStatus = dilithiumStatus;
exports.signDilithium = signDilithium;
exports.verifyDilithium = verifyDilithium;
const crypto_1 = __importDefault(require("crypto"));
let mldsaCache = null;
/** Use a CJS shim (./dilithiumLoader.js) for the actual `import()` call.
 * The shim sits in plain JS so neither tsc (module: commonjs would lower
 * import() to require(), which fails on ESM-only packages) nor vitest's
 * module transformer touches it. The path inside the shim is a literal —
 * no user input reaches dynamic import. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dilithiumLoader = require("./dilithiumLoader.js");
async function loadMlDsa() {
    if (mldsaCache)
        return mldsaCache;
    const mod = await dilithiumLoader.loadMlDsa();
    mldsaCache = mod.ml_dsa65;
    return mldsaCache;
}
exports.DILITHIUM_KID_REAL = "qsign-dilithium-mldsa65-v1";
exports.DILITHIUM_KID_PREVIEW = "qsign-dilithium-mldsa65-preview-v1";
exports.DILITHIUM_PREVIEW_HEX_LEN = 128; // SHA-512 hex
exports.DILITHIUM_REAL_HEX_LEN = 6618; // 3309 bytes * 2
let realKeypairCache = null;
/**
 * Reads QSIGN_DILITHIUM_V1_SEED → 32-byte hex seed → derives keypair via
 * deterministic ML-DSA-65 keygen. Returns null if env unset/invalid (so
 * caller falls through to preview mode).
 *
 * Cached per-process. Keys are large (~6 KB combined) but only resident
 * once.
 */
async function getActiveDilithium() {
    if (realKeypairCache)
        return realKeypairCache;
    const seedHex = process.env.QSIGN_DILITHIUM_V1_SEED?.trim();
    if (!seedHex)
        return null;
    if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
        console.warn("[qsign v2] QSIGN_DILITHIUM_V1_SEED set but not a 64-hex-char string; falling back to preview mode");
        return null;
    }
    const seed = Buffer.from(seedHex, "hex");
    const ml = await loadMlDsa();
    const { publicKey, secretKey } = ml.keygen(seed);
    realKeypairCache = { kid: exports.DILITHIUM_KID_REAL, publicKey, secretKey };
    return realKeypairCache;
}
/**
 * Синхронный статус режима подписи — без загрузки ключей и без keygen.
 *
 * Раскрытия не добавляет: тот же `mode` уже возвращается в каждом ответе
 * /api/qsign/v2/sign, а публичное описание API прямым текстом говорит, что
 * preview-дайджест «NOT a cryptographic signature». Сюда вынесено ровно
 * затем, чтобы ответ на вопрос «а что на проде» стоил одного запроса, а не
 * похода в переменные окружения.
 *
 * Сам сид наружу не отдаётся ни в каком виде — ни значение, ни длина.
 */
function dilithiumStatus() {
    const seedHex = process.env.QSIGN_DILITHIUM_V1_SEED?.trim();
    if (!seedHex)
        return { mode: "preview", reason: "seed_unset" };
    if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) {
        return { mode: "preview", reason: "seed_malformed" };
    }
    return { mode: "real", reason: "seed_set" };
}
/**
 * Sign a canonical payload string. Returns real ML-DSA-65 signature when
 * env seed is set, otherwise the deterministic SHA-512 preview fingerprint.
 * The signed payload has the same shape as `signEd25519Hex` consumes
 * (canonical UTF-8 string).
 */
async function signDilithium(canonical) {
    const real = await getActiveDilithium();
    if (real) {
        const ml = await loadMlDsa();
        const sig = ml.sign(Buffer.from(canonical, "utf8"), real.secretKey);
        return {
            kid: real.kid,
            signature: Buffer.from(sig).toString("hex"),
            mode: "real",
            publicKey: Buffer.from(real.publicKey).toString("hex"),
        };
    }
    // Preview fallback — deterministic fingerprint of canonical||kid.
    const fingerprint = crypto_1.default
        .createHash("sha512")
        .update(canonical + "||" + exports.DILITHIUM_KID_PREVIEW, "utf8")
        .digest("hex");
    return {
        kid: exports.DILITHIUM_KID_PREVIEW,
        signature: fingerprint,
        mode: "preview",
    };
}
/**
 * Verify a Dilithium signature on a canonical payload. Auto-detects mode
 * by signature length so historical preview rows continue to verify after
 * the operator turns on real ML-DSA via env.
 *
 * Returns:
 *   { valid: boolean, mode: "preview" | "real" | "unknown" }
 */
async function verifyDilithium(canonical, signatureHex, storedKid) {
    if (!signatureHex || typeof signatureHex !== "string") {
        return { valid: false, mode: "unknown" };
    }
    // Strip whitespace defensively, no other normalization.
    const sig = signatureHex.trim();
    // Preview mode: 128 hex chars OR explicit preview kid stored on row.
    const looksPreview = sig.length === exports.DILITHIUM_PREVIEW_HEX_LEN ||
        storedKid === exports.DILITHIUM_KID_PREVIEW;
    if (looksPreview) {
        const expected = crypto_1.default
            .createHash("sha512")
            .update(canonical + "||" + exports.DILITHIUM_KID_PREVIEW, "utf8")
            .digest("hex");
        return { valid: timingSafeHexEq(sig, expected), mode: "preview" };
    }
    // Real mode: ~6618 hex chars; fall through to ML-DSA-65 verify.
    if (sig.length !== exports.DILITHIUM_REAL_HEX_LEN) {
        return { valid: false, mode: "unknown" };
    }
    const real = await getActiveDilithium();
    if (!real) {
        // Real-mode signature but operator lacks the seed to derive the public
        // key. Treat as unknown rather than invalid — surfaces a config issue
        // instead of a false "tampered" verdict.
        return { valid: false, mode: "real" };
    }
    try {
        const ml = await loadMlDsa();
        const sigBytes = Buffer.from(sig, "hex");
        const ok = ml.verify(sigBytes, Buffer.from(canonical, "utf8"), real.publicKey);
        return { valid: ok, mode: "real" };
    }
    catch {
        return { valid: false, mode: "real" };
    }
}
function timingSafeHexEq(a, b) {
    if (a.length !== b.length)
        return false;
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    }
    catch {
        return false;
    }
}
