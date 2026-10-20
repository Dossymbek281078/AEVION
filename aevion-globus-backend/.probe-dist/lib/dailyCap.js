"use strict";
// Per-user 24h amount cap for /topup and /transfer.
//
// In-memory bucket keyed by (email, kind, UTC-day-number). Day rolls over
// at 00:00 UTC. If the requested amount would push the day's running total
// over the cap, returns { ok:false, retryInSec } so the route can answer
// 429 + Retry-After.
//
// Env-tunable:
//   BANK_DAILY_TOPUP_CAP     default 5000   (AEC per user per UTC day)
//   BANK_DAILY_TRANSFER_CAP  default 2000   (AEC per user per UTC day)
//
// Why an in-memory bucket and not Postgres-aware:
//   - The qtrade ledger itself is JSON-file backed; re-summing per request
//     would mean re-reading the whole ledger on each topup/transfer.
//     A 5kb in-memory map per worker is cheaper and accurate enough for
//     test net + early prod traffic. Multi-worker deployments would need
//     Redis or a shared store; flagged in the comment below.
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeDailyCap = consumeDailyCap;
exports.peekDailyCap = peekDailyCap;
exports._resetDailyCaps = _resetDailyCaps;
const buckets = new Map();
function dayKey(now = Date.now()) {
    const d = new Date(now);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function nextMidnightUtc(now = Date.now()) {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
}
function gc(now) {
    // Bounded sweep to avoid unbounded growth across many days/users.
    if (buckets.size < 256)
        return;
    for (const [k, v] of buckets) {
        if (v.resetsAt <= now)
            buckets.delete(k);
    }
}
function capFor(kind) {
    const env = kind === "topup"
        ? process.env.BANK_DAILY_TOPUP_CAP
        : process.env.BANK_DAILY_TRANSFER_CAP;
    const parsed = env ? Number(env) : NaN;
    if (Number.isFinite(parsed) && parsed > 0)
        return parsed;
    return kind === "topup" ? 5000 : 2000;
}
function consumeDailyCap(email, kind, amount, now = Date.now()) {
    gc(now);
    const cap = capFor(kind);
    const key = `${email.toLowerCase()}|${kind}|${dayKey(now)}`;
    const reset = nextMidnightUtc(now);
    const cur = buckets.get(key);
    const used = cur && cur.resetsAt > now ? cur.used : 0;
    const next = used + amount;
    const retryInSec = Math.max(1, Math.ceil((reset - now) / 1000));
    if (next > cap) {
        return { ok: false, used, cap, retryInSec };
    }
    buckets.set(key, { used: next, resetsAt: reset });
    return { ok: true, used: next, cap, remainingSec: retryInSec };
}
// Read the current bucket state without consuming any capacity. Used by
// the GET /api/qtrade/cap-status surface so the UI can show a progress
// bar before the user hits 429.
function peekDailyCap(email, kind, now = Date.now()) {
    const cap = capFor(kind);
    const key = `${email.toLowerCase()}|${kind}|${dayKey(now)}`;
    const cur = buckets.get(key);
    const used = cur && cur.resetsAt > now ? cur.used : 0;
    const reset = nextMidnightUtc(now);
    const remainingSec = Math.max(1, Math.ceil((reset - now) / 1000));
    return { used, cap, remainingSec };
}
// Test helpers — only for the integration test suite.
function _resetDailyCaps() {
    buckets.clear();
}
