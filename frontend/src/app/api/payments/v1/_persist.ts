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
//
// ─────────────────────────────────────────────────────────────────────────
// ДВА РАЗНЫХ ВОПРОСА, и раньше на них отвечала одна функция:
//
//   route()      — КУДА идти за данными. Решается наличием переменных.
//   durability() — ЧТО можно обещать человеку. Учитывает ещё и то, отвечало
//                  ли KV отказом в этом процессе.
//
// Пока это было одно и то же, отказ KV был невидим: запись уезжала в память
// процесса, а /api/health и страница ссылок продолжали говорить "kv" — то
// есть обещали долговечность записи, которой не существует. Механизм
// честности на страницах уже написан (payments/links/durability.ts), он
// просто ни разу не включался для этого случая: настроенный, но упавший KV
// выглядел здоровым.
//
// Деградация — ЗАЩЁЛКА, а не кулдаун. Записи, уехавшие в память, останутся
// в памяти и после того, как KV снова начнёт отвечать; значит и обещание
// долговечности возвращать нельзя до перезапуска.

type KvBackend = "kv" | "memory";

/**
 * Три исхода чтения вместо двух. { ok: false } — это «не смог спросить», и
 * оно НЕ равно value: null («такого ключа нет»). Пока разницы не было,
 * упавшее чтение становилось фактом «записи не существует».
 */
type Read<T> = { ok: true; value: T | null } | { ok: false };

/** Тот же контракт для списков: при успехе список есть всегда, пусть пустой. */
type ReadList<T> = { ok: true; value: T[] } | { ok: false };

type ScanResult<T> = { items: T[]; cursor: number; ok: boolean };

const memMap = (() => {
  const g = globalThis as unknown as { __aevionPayKv?: Map<string, string> };
  if (!g.__aevionPayKv) g.__aevionPayKv = new Map();
  return g.__aevionPayKv;
})();

type Degradation = { at: number; op: string };

const degraded = (() => {
  const g = globalThis as unknown as { __aevionPayKvDegraded?: Degradation | null };
  return {
    get(): Degradation | null {
      return g.__aevionPayKvDegraded ?? null;
    },
    note(op: string, err: unknown): void {
      // След обязателен: молчаливый откат в память неотличим от успеха, и
      // узнать о нём иначе можно только тогда, когда данные понадобятся.
      const msg = err instanceof Error ? err.message : String(err);
      if (!g.__aevionPayKvDegraded) g.__aevionPayKvDegraded = { at: Date.now(), op };
      console.error(`[payments/kv] ${op}: отказ, данные в памяти процесса — ${msg}`);
    },
    clear(): void {
      g.__aevionPayKvDegraded = null;
    },
  };
})();

function creds(): { url: string; tok: string } | null {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) return { url, tok };
  return null;
}

/** Куда физически идти за данными. Отказ KV этого не меняет: ключи остаются
 *  в KV, и уводить чтение в память значило бы потерять к ним доступ. */
function route(): KvBackend {
  return creds() ? "kv" : "memory";
}

/** Что честно обещать человеку про сохранность. */
function durability(): KvBackend {
  if (!creds()) return "memory";
  return degraded.get() ? "memory" : "kv";
}

/** Ключ, под которым держим записи, не доехавшие до KV. */
function pendingKey(key: string): string {
  return `__pending__:${key}`;
}

function parseList<T>(raw: string | undefined): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Придержать запись в памяти процесса, не трогая ключ в KV. */
function holdPending<T>(key: string, value: T, cap: number): void {
  const kept = parseList<T>(memMap.get(pendingKey(key)));
  kept.unshift(value);
  if (kept.length > cap) kept.length = cap;
  memMap.set(pendingKey(key), JSON.stringify(kept));
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

/** Чтение, которое умеет сказать «не знаю». Используйте его везде, где по
 *  результату принимается решение ЗАПИСАТЬ. */
export async function kvGetChecked<T>(key: string): Promise<Read<T>> {
  if (route() === "memory") {
    const raw = memMap.get(key);
    return { ok: true, value: raw ? (JSON.parse(raw) as T) : null };
  }
  try {
    const out = (await kvFetch(["get", key])) as { result: string | null };
    return { ok: true, value: out.result ? (JSON.parse(out.result) as T) : null };
  } catch (e) {
    degraded.note(`get ${key}`, e);
    return { ok: false };
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const r = await kvGetChecked<T>(key);
  return r.ok ? r.value : null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const body = JSON.stringify(value);
  if (route() === "memory") {
    memMap.set(key, body);
    return;
  }
  try {
    await kvFetch(["set", key, body], { method: "POST" });
  } catch (e) {
    degraded.note(`set ${key}`, e);
    memMap.set(key, body);
  }
}

export async function kvDel(key: string): Promise<void> {
  if (route() === "memory") {
    memMap.delete(key);
    return;
  }
  try {
    await kvFetch(["del", key], { method: "POST" });
  } catch (e) {
    // Здесь молчание опаснее всего: запись в KV осталась жива, а вызвавший
    // считает, что удалил. Ссылка продолжит принимать оплату.
    degraded.note(`del ${key}`, e);
    memMap.delete(key);
  }
}

export async function kvScan<T>(prefix: string, limit = 100): Promise<ScanResult<T>> {
  if (route() === "memory") {
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
    return { items, cursor: 0, ok: true };
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
    return { items, cursor: Number(out.result[0]) || 0, ok: true };
  } catch (e) {
    // ok отличает «ничего не нашлось» от «не смог спросить». Без него пустой
    // список читается как «у продавца нет ни одной ссылки».
    degraded.note(`scan ${prefix}`, e);
    return { items: [], cursor: 0, ok: false };
  }
}

export async function kvPush<T>(key: string, value: T, cap = 200): Promise<void> {
  const prev = await kvGetChecked<T[]>(key);
  if (!prev.ok) {
    // САМОЕ ДОРОГОЕ МЕСТО ФАЙЛА. Раньше здесь стояло «?? пустой список», и
    // упавшее чтение превращалось в «список был пуст» — а следом kvSet
    // записывал этот пустой список поверх настоящего. Один моргнувший
    // запрос стирал ВЕСЬ журнал под ключом: для REFUNDS_KEY это история
    // возвратов денег, для AUDIT_KEY — журнал аудита платежей. Не потеря
    // записи, а потеря бухгалтерии, и притом бесшумная.
    //
    // Поэтому ключ не трогаем вовсе. Новую запись держим отдельно в памяти
    // процесса, чтобы она не пропала совсем и была видна в kvList.
    holdPending(key, value, cap);
    return;
  }
  if (prev.value !== null && !Array.isArray(prev.value)) {
    // Под ключом журнала лежит не список. Прочитать смогли, понять — нет.
    // Затирать нельзя (та же потеря бухгалтерии), а звать .unshift на этом
    // значило бы бросить TypeError: в refunds/route.ts kvPush вызывается без
    // перехвата, и возврат денег ответил бы 500 уже после того, как возврат
    // посчитан. Поэтому ведём себя как при неудачном чтении.
    degraded.note(`push ${key}`, new Error("kv-value-not-a-list"));
    holdPending(key, value, cap);
    return;
  }
  const list = prev.value ?? [];
  list.unshift(value);
  if (list.length > cap) list.length = cap;
  await kvSet(key, list);
}

export async function kvList<T>(key: string): Promise<T[]> {
  const r = await kvListChecked<T>(key);
  return r.ok ? r.value : [];
}

/**
 * То же, что kvList, но умеет сказать «не смог прочитать».
 *
 * Нужно везде, где список читают, меняют и записывают ОБРАТНО. При обычном
 * kvList упавшее чтение даёт пустой список, и запись стирает всё, что там
 * было: так вели себя очередь вебхуков (enqueueAttempt, processDue) и споры
 * (loadAll/persistAll). У очереди это особенно тихо — processDue после
 * стирания отчитывается `scanned: 0`, то есть «очередь пуста, всё спокойно».
 */
export async function kvListChecked<T>(key: string): Promise<ReadList<T>> {
  const main = await kvGetChecked<T[]>(key);
  if (!main.ok) return { ok: false };
  const base = Array.isArray(main.value) ? main.value : [];
  // Отложенные записи новее — иначе человек увидит журнал с дырой на самом
  // свежем событии и решит, что возврат не прошёл.
  const pending = parseList<T>(memMap.get(pendingKey(key)));
  return { ok: true, value: pending.length ? [...pending, ...base] : base };
}

/** Отвечает на вопрос «что обещать про сохранность», а не «куда мы ходим». */
export function kvBackend(): KvBackend {
  return durability();
}

/** Непустое значение = KV настроен, но отказывал; часть данных в памяти. */
export function kvDegradedSince(): Degradation | null {
  return degraded.get();
}

/** Только для тестов: защёлка живёт в globalThis и переживает импорты. */
export function __resetKvDegradedForTests(): void {
  degraded.clear();
}
