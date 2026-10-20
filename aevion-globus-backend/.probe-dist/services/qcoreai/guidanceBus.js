"use strict";
/**
 * Mid-run guidance queue with two interchangeable backends:
 *
 *   1. InMemoryGuidanceBus — single-process Map. Default. Fine for the
 *      common single-instance deploy.
 *   2. RedisGuidanceBus — pub/sub on a channel per-runId. Enables
 *      horizontal scaling: the HTTP node that takes /guidance can be
 *      different from the node running the orchestrator. Each node
 *      keeps a local buffer; pushes are broadcast over Redis so every
 *      node's buffer for that run sees them; drain reads + clears
 *      locally.
 *
 * Selection: if process.env.QCORE_REDIS_URL is set AND `ioredis` is
 * installed, we boot the Redis bus. Otherwise the in-memory bus runs.
 *
 * `ioredis` is an *optional* dependency — the Redis bus uses dynamic
 * import + try/catch so build doesn't require it. This file works
 * unchanged whether or not ioredis is on disk.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisGuidanceBus = exports.InMemoryGuidanceBus = void 0;
exports.getGuidanceBus = getGuidanceBus;
exports.__resetGuidanceBusForTests = __resetGuidanceBusForTests;
/* ─── In-memory ───────────────────────────────────────────────────────── */
class InMemoryGuidanceBus {
    constructor() {
        this.kind = "memory";
        this.buffers = new Map();
    }
    register(runId) {
        if (!this.buffers.has(runId))
            this.buffers.set(runId, []);
    }
    push(runId, text) {
        const arr = this.buffers.get(runId);
        if (!arr)
            return false;
        arr.push(text);
        return true;
    }
    drain(runId) {
        const arr = this.buffers.get(runId);
        if (!arr || arr.length === 0)
            return [];
        const out = arr.slice();
        arr.length = 0;
        return out;
    }
    unregister(runId) {
        this.buffers.delete(runId);
    }
    liveRuns() {
        return Array.from(this.buffers.keys());
    }
}
exports.InMemoryGuidanceBus = InMemoryGuidanceBus;
/* ─── Redis pub/sub ───────────────────────────────────────────────────── */
const REDIS_CHANNEL_PREFIX = "qcore:guidance:";
class RedisGuidanceBus {
    constructor(redisUrl, IORedis) {
        this.kind = "redis";
        this.buffers = new Map();
        this.pub = new IORedis(redisUrl);
        this.sub = new IORedis(redisUrl);
        this.sub.on("messageBuffer", (chan, msg) => {
            const channel = chan.toString("utf8");
            if (!channel.startsWith(REDIS_CHANNEL_PREFIX))
                return;
            const runId = channel.slice(REDIS_CHANNEL_PREFIX.length);
            const arr = this.buffers.get(runId);
            if (!arr)
                return; // not live on this node — ignore
            try {
                arr.push(msg.toString("utf8"));
            }
            catch {
                /* noop */
            }
        });
        this.pub.on("error", (e) => {
            console.warn(`[QCoreAI] Redis pub error: ${e?.message || e}`);
        });
        this.sub.on("error", (e) => {
            console.warn(`[QCoreAI] Redis sub error: ${e?.message || e}`);
        });
    }
    async register(runId) {
        if (!this.buffers.has(runId))
            this.buffers.set(runId, []);
        await this.sub.subscribe(REDIS_CHANNEL_PREFIX + runId);
    }
    async push(runId, text) {
        // We can't be 100% sure a run is live (it may be on another node).
        // Publish unconditionally; subscribers with no buffer just drop.
        await this.pub.publish(REDIS_CHANNEL_PREFIX + runId, text);
        return true;
    }
    drain(runId) {
        const arr = this.buffers.get(runId);
        if (!arr || arr.length === 0)
            return [];
        const out = arr.slice();
        arr.length = 0;
        return out;
    }
    async unregister(runId) {
        this.buffers.delete(runId);
        try {
            await this.sub.unsubscribe(REDIS_CHANNEL_PREFIX + runId);
        }
        catch {
            /* noop */
        }
    }
    liveRuns() {
        return Array.from(this.buffers.keys());
    }
}
exports.RedisGuidanceBus = RedisGuidanceBus;
/* ─── Factory ─────────────────────────────────────────────────────────── */
let busPromise = null;
let cachedBus = null;
function getGuidanceBus() {
    if (cachedBus)
        return Promise.resolve(cachedBus);
    if (busPromise)
        return busPromise;
    busPromise = (async () => {
        const url = process.env.QCORE_REDIS_URL?.trim();
        if (!url) {
            const bus = new InMemoryGuidanceBus();
            cachedBus = bus;
            return bus;
        }
        try {
            // Dynamic import via indirect eval so TypeScript doesn't try to type-
            // check the missing module — ioredis is an *optional* dep.
            const dynamicImport = new Function("m", "return import(m)");
            const mod = await dynamicImport("ioredis").catch(() => null);
            if (!mod) {
                console.warn("[QCoreAI] QCORE_REDIS_URL set but ioredis not installed — falling back to in-memory bus");
                const bus = new InMemoryGuidanceBus();
                cachedBus = bus;
                return bus;
            }
            const IORedis = mod.default || mod;
            const bus = new RedisGuidanceBus(url, IORedis);
            console.log(`[QCoreAI] guidance bus: redis (${url.replace(/\/\/[^@]*@/, "//***@")})`);
            cachedBus = bus;
            return bus;
        }
        catch (e) {
            console.warn(`[QCoreAI] Failed to init Redis guidance bus, using in-memory: ${e?.message || e}`);
            const bus = new InMemoryGuidanceBus();
            cachedBus = bus;
            return bus;
        }
    })();
    return busPromise;
}
/** For tests — reset the cached bus. */
function __resetGuidanceBusForTests() {
    cachedBus = null;
    busPromise = null;
}
