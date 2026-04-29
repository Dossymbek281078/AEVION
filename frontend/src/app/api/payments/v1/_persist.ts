// Persistence adapter for Payments Rail.
//
// Two backends:
//   1. "kv"     — Vercel KV (Upstash REST). Activated when both
//                 KV_REST_API_URL and KV_REST_API_TOKEN env vars are set.
//   2. "memory" — globalThis Map (default). Survives warm starts on the same
//                 serverless instance, lost on cold start. Same behavior as
//                 the legacy `store` exported from _lib.ts.
//
// Wire-up on Vercel:
//   1. Vercel dashboard → Storage → Create Database → KV
//   2. Connect to project → env vars KV_REST_API_URL + KV_REST_API_TOKEN
//      are auto-injected. No code change needed.

type KvBackend = "kv" | "memory";

type ScanResult<T> = { items: T[]; cursor: number };

const memMap = (() => {
  const g = globalThis as unknown as { __aevionPayKv?: Map<string, string> };
  if (!g.__aevionPayKv) g.__aevionPayKv = new Map();
  return g.__aevionPayKv;
})();

function backend(): KvBackend {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  return url && tok ? "kv" : "memory";
}

async function kvFetch(path: string[], init?: RequestInit): Promise<unknown> {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) throw new Error("kv-not-configured");
  const r = await fetch(`${url}/${path.map(encodeURIComponent).join("/")}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${tok}`,
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`kv-${r.status}`);
  return r.json();
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (backend() === "memory") {
    const raw = memMap.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  try {
    const out = (await kvFetch(["get", key])) as { result: string | null };
    return out.result ? (JSON.parse(out.result) as T) : null;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const body = JSON.stringify(value);
  if (backend() === "memory") {
    memMap.set(key, body);
    return;
  }
  try {
    await kvFetch(["set", key, body], { method: "POST" });
  } catch {
    memMap.set(key, body);
  }
}

export async function kvDel(key: string): Promise<void> {
  if (backend() === "memory") {
    memMap.delete(key);
    return;
  }
  try {
    await kvFetch(["del", key], { method: "POST" });
  } catch {
    memMap.delete(key);
  }
}

export async function kvScan<T>(prefix: string, limit = 100): Promise<ScanResult<T>> {
  if (backend() === "memory") {
    const items: T[] = [];
    for (const [k, v] of memMap.entries()) {
      if (k.startsWith(prefix)) {
        try {
          items.push(JSON.parse(v) as T);
        } catch {
          // skip malformed
        }
      }
      if (items.length >= limit) break;
    }
    return { items, cursor: 0 };
  }
  try {
    const out = (await kvFetch(["scan", "0", "match", `${prefix}*`, "count", String(limit)])) as {
      result: [string, string[]];
    };
    const keys = out.result[1] ?? [];
    const items: T[] = [];
    for (const k of keys.slice(0, limit)) {
      const v = await kvGet<T>(k);
      if (v) items.push(v);
    }
    return { items, cursor: Number(out.result[0]) || 0 };
  } catch {
    return { items: [], cursor: 0 };
  }
}

export async function kvPush<T>(key: string, value: T, cap = 200): Promise<void> {
  const list = (await kvGet<T[]>(key)) ?? [];
  list.unshift(value);
  if (list.length > cap) list.length = cap;
  await kvSet(key, list);
}

export async function kvList<T>(key: string): Promise<T[]> {
  return (await kvGet<T[]>(key)) ?? [];
}

export function kvBackend(): KvBackend {
  return backend();
}
