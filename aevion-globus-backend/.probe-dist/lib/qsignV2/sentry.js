"use strict";
/**
 * Thin Sentry wrapper for QSign v2 — opt-in via SENTRY_DSN env var.
 *
 * - If SENTRY_DSN is unset/empty → all calls become no-ops. No init, no
 *   network IO, no perf cost. The skip-if-no-DSN pattern matches how Sentry
 *   is wired across the rest of AEVION (QTrade, Bank).
 * - If SENTRY_DSN is set → Sentry.init() runs once on first call to
 *   initSentry(); subsequent calls are idempotent.
 * - Tracing is OFF by default (tracesSampleRate=0). Errors only. Set
 *   SENTRY_TRACES_SAMPLE_RATE in env to enable distributed tracing later.
 *
 * Usage:
 *   - bootstrap once in src/index.ts via initSentry()
 *   - call captureException(err, ctx) from any 5xx path
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSentry = initSentry;
exports.isSentryActive = isSentryActive;
exports.captureException = captureException;
exports.flushSentry = flushSentry;
const Sentry = __importStar(require("@sentry/node"));
let active = false;
/**
 * Idempotent boot hook. Reads SENTRY_DSN; if absent or empty, leaves the
 * module dormant and returns false. If present, runs Sentry.init() with
 * the QSign v2 service tag and returns true.
 */
function initSentry() {
    if (active)
        return true;
    const dsn = process.env.SENTRY_DSN?.trim();
    if (!dsn)
        return false;
    const env = process.env.NODE_ENV || "development";
    const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");
    Sentry.init({
        dsn,
        environment: env,
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
        serverName: process.env.RAILWAY_SERVICE_NAME || "aevion-globus-backend",
        initialScope: {
            tags: { service: "qsign-v2" },
        },
    });
    active = true;
    console.log(`[qsign v2] Sentry initialized (env=${env}, tracing=${tracesSampleRate})`);
    return true;
}
function isSentryActive() {
    return active;
}
/**
 * Forward an error to Sentry with structured request context. No-op when
 * Sentry is dormant. Never throws — secondary failure (Sentry SDK error)
 * is swallowed so primary error path is unaffected.
 */
function captureException(err, context = {}) {
    if (!active)
        return;
    try {
        Sentry.withScope((scope) => {
            for (const [k, v] of Object.entries(context)) {
                if (v === undefined || v === null)
                    continue;
                scope.setExtra(k, v);
            }
            if (typeof context.requestId === "string") {
                scope.setTag("requestId", context.requestId);
            }
            if (typeof context.errorCode === "string") {
                scope.setTag("errorCode", context.errorCode);
            }
            Sentry.captureException(err);
        });
    }
    catch {
        /* secondary — ignore so caller's error path is unaffected */
    }
}
/**
 * Best-effort flush before process exit. Awaits up to `timeoutMs` for
 * pending events to leave. Safe to call when dormant (returns immediately).
 */
async function flushSentry(timeoutMs = 2000) {
    if (!active)
        return;
    try {
        await Sentry.flush(timeoutMs);
    }
    catch {
        /* secondary */
    }
}
