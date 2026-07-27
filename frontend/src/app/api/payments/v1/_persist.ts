// Persistence adapter for Payments Rail.
//
// Two backends:
//   1. "kv"     — Upstash Redis REST (used by Vercel KV and the Upstash
//                 marketplace integration). Activated when EITHER pair of
//                 env vars is present:
//                   • KV_REST_API_URL + KV_REST_API_TOKEN          (Vercel KV)
//                   • UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//                                                                  (Upstash)
//   2. "memory" — globalThis Map (default). Survives warm starts on the same
//                 serverless instance, lost on cold start.
//
// Wire-up on Vercel:
//   1. Project → Storage → Create Database → pick "Upstash" (Redis).
//   2. Click "Connect to Project". Env vars are auto-injected.
//   3. Vercel re-deploys; /api/health flips persistence to "kv".

type KvBackend = "kv" | "memory";

type ScanResult<T> = { items: T[]; cursor: number };

const memMap = (() => {
  const g = globalThis as unknown as { __aevionPayKv?: Map<string, string> };
  if (!g.__aevionPayKv) g.__aevionPayKv = new Map();
  return g.__aevionPayKv;
})();

function creds(): { url: string; tok: string } | null {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) return { url, tok };
  return null;
}

function backend(): KvBackend {
  return creds() ? "kv" : "memory";
}

async function kvFetch(path: string[], init?: RequestInit): Promise<unknown> {
  const c = creds();
  if (!c) throw new Error("kv-not-configured");
  const { url, tok } = c;
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

/**
 * Сериализация операций «прочитал → проверил → записал» по одному ключу.
 *
 * `kvPush`/`kvSet` — это чтение-изменение-запись, а не атомарная операция.
 * На возврате средств из-за этого настоящая гонка: два одновременных запроса
 * читают ОДИН И ТОТ ЖЕ список прошлых возвратов, оба видят полный остаток, оба
 * проходят проверку «не больше остатка» — и ссылка возвращается дважды. Второй
 * `kvPush` вдобавок может затереть запись первого (потерянное обновление).
 * Ровно этот класс уже чинился в QContract (атомарный `UPDATE … WHERE`) и
 * QMaskCard; здесь SQL нет, поэтому нужен замок.
 *
 * В памяти — цепочка промисов на ключ: внутри инстанса это точная
 * сериализация, а `memory`-режим и живёт в пределах инстанса.
 * В KV — `SET lock NX EX`, атомарный на стороне Redis; если замок занят,
 * вызывающий получает отказ и честный 409 вместо тихого двойного возврата.
 */
const memLocks = new Map<string, Promise<unknown>>();

export async function withKeyLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T | "locked"> {
  if (backend() === "memory") {
    const prev = memLocks.get(key) ?? Promise.resolve();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const chain = prev.then(() => gate);
    memLocks.set(key, chain);
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      release();
      // не даём карте расти: снимаем запись, если за нами никто не встал
      if (memLocks.get(key) === chain) memLocks.delete(key);
    }
  }

  const lockKey = `lock:${key}`;
  try {
    const out = (await kvFetch(["set", lockKey, "1", "nx", "ex", "10"])) as {
      result: string | null;
    };
    if (!out.result) return "locked";
  } catch {
    // KV недоступен — не выдумываем успех, но и не блокируем работу:
    // падаем на тот же путь, что и memory-режим.
    return await fn();
  }
  try {
    return await fn();
  } finally {
    await kvDel(lockKey).catch(() => {});
  }
}
