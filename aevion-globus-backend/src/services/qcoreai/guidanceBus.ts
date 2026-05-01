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

export interface GuidanceBus {
  register(runId: string): Promise<void> | void;
  push(runId: string, text: string): Promise<boolean> | boolean;
  drain(runId: string): Promise<string[]> | string[];
  unregister(runId: string): Promise<void> | void;
  /** Telemetry / debug. Returns the list of currently live runs on *this* node. */
  liveRuns(): string[];
  /** Bus identity, for /health response. */
  readonly kind: "memory" | "redis";
}

/* ─── In-memory ───────────────────────────────────────────────────────── */

export class InMemoryGuidanceBus implements GuidanceBus {
  readonly kind = "memory" as const;
  private buffers = new Map<string, string[]>();

  register(runId: string): void {
    if (!this.buffers.has(runId)) this.buffers.set(runId, []);
  }

  push(runId: string, text: string): boolean {
    const arr = this.buffers.get(runId);
    if (!arr) return false;
    arr.push(text);
    return true;
  }

  drain(runId: string): string[] {
    const arr = this.buffers.get(runId);
    if (!arr || arr.length === 0) return [];
    const out = arr.slice();
    arr.length = 0;
    return out;
  }

  unregister(runId: string): void {
    this.buffers.delete(runId);
  }

  liveRuns(): string[] {
    return Array.from(this.buffers.keys());
  }
}

/* ─── Redis pub/sub ───────────────────────────────────────────────────── */

const REDIS_CHANNEL_PREFIX = "qcore:guidance:";

export class RedisGuidanceBus implements GuidanceBus {
  readonly kind = "redis" as const;
  private buffers = new Map<string, string[]>();
  private pub: any;
  private sub: any;

  constructor(redisUrl: string, IORedis: any) {
    this.pub = new IORedis(redisUrl);
    this.sub = new IORedis(redisUrl);
    this.sub.on("messageBuffer", (chan: Buffer, msg: Buffer) => {
      const channel = chan.toString("utf8");
      if (!channel.startsWith(REDIS_CHANNEL_PREFIX)) return;
      const runId = channel.slice(REDIS_CHANNEL_PREFIX.length);
      const arr = this.buffers.get(runId);
      if (!arr) return; // not live on this node — ignore
      try {
        arr.push(msg.toString("utf8"));
      } catch {
        /* noop */
      }
    });
    this.pub.on("error", (e: any) => {
      console.warn(`[QCoreAI] Redis pub error: ${e?.message || e}`);
    });
    this.sub.on("error", (e: any) => {
      console.warn(`[QCoreAI] Redis sub error: ${e?.message || e}`);
    });
  }

  async register(runId: string): Promise<void> {
    if (!this.buffers.has(runId)) this.buffers.set(runId, []);
    await this.sub.subscribe(REDIS_CHANNEL_PREFIX + runId);
  }

  async push(runId: string, text: string): Promise<boolean> {
    // We can't be 100% sure a run is live (it may be on another node).
    // Publish unconditionally; subscribers with no buffer just drop.
    await this.pub.publish(REDIS_CHANNEL_PREFIX + runId, text);
    return true;
  }

  drain(runId: string): string[] {
    const arr = this.buffers.get(runId);
    if (!arr || arr.length === 0) return [];
    const out = arr.slice();
    arr.length = 0;
    return out;
  }

  async unregister(runId: string): Promise<void> {
    this.buffers.delete(runId);
    try {
      await this.sub.unsubscribe(REDIS_CHANNEL_PREFIX + runId);
    } catch {
      /* noop */
    }
  }

  liveRuns(): string[] {
    return Array.from(this.buffers.keys());
  }
}

/* ─── Factory ─────────────────────────────────────────────────────────── */

let busPromise: Promise<GuidanceBus> | null = null;
let cachedBus: GuidanceBus | null = null;

export function getGuidanceBus(): Promise<GuidanceBus> {
  if (cachedBus) return Promise.resolve(cachedBus);
  if (busPromise) return busPromise;

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
      const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;
      const mod: any = await dynamicImport("ioredis").catch(() => null);
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
    } catch (e: any) {
      console.warn(`[QCoreAI] Failed to init Redis guidance bus, using in-memory: ${e?.message || e}`);
      const bus = new InMemoryGuidanceBus();
      cachedBus = bus;
      return bus;
    }
  })();
  return busPromise;
}

/** For tests — reset the cached bus. */
export function __resetGuidanceBusForTests(): void {
  cachedBus = null;
  busPromise = null;
}
