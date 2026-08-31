import { signHmac } from "./_lib";
import { kvList, kvListChecked, kvPush, kvSet } from "./_persist";

export type QueuedAttempt = {
  id: string;
  webhook_id: string;
  webhook_url: string;
  webhook_secret: string;
  event: string;
  payload: string;
  attempts: number;
  next_retry_at: number;
  first_attempt_at: number;
  last_attempt_at: number | null;
  last_error: string | null;
  last_http_code: number | null;
  status: "pending" | "delivered" | "failed";
};

const QUEUE_KEY = "webhook.queue.v1";
const QUEUE_CAP = 1000;
const MAX_ATTEMPTS = 6;
// 10s, 30s, 2m, 10m, 1h, 6h
const BACKOFF_MS = [10_000, 30_000, 120_000, 600_000, 3_600_000, 21_600_000];

// 31.08.2026. Обрезка очереди была ПЕРЕВЁРНУТА, и это хуже обычной потери.
// kvPush и slice(0, CAP) выбрасывают хвост, а хвост очереди — самые старые
// записи. Доставленные и провалившиеся остаются в списке наравне с
// ожидающими, поэтому самые старые здесь — это ровно те доставки, которые
// ещё НЕ сделаны: попытка с растущей паузой стареет и уходит в хвост.
// Итог: под нагрузкой из очереди молча выпадала НЕСДЕЛАННАЯ работа, а
// сделанная занимала место. Снаружи очередь при этом выглядела здоровой —
// длина в пределах, ошибок нет, счётчики delivered/failed на месте.
//
// Здесь обрезка считается со статусом: ожидающие удерживаются первыми,
// остаток места достаётся уже завершённым (список идёт новыми вперёд, то
// есть выпадает самое старое завершённое). Порядок записей сохраняется.
let droppedPending = 0;

export function capKeepingPending(
  items: QueuedAttempt[],
  cap = QUEUE_CAP
): QueuedAttempt[] {
  if (items.length <= cap) return items;
  const keep = new Set<string>();
  for (const a of items) {
    if (a.status === "pending" && keep.size < cap) keep.add(a.id);
  }
  for (const a of items) {
    if (keep.size >= cap) break;
    if (!keep.has(a.id)) keep.add(a.id);
  }
  const kept = items.filter((a) => keep.has(a.id));

  // Если ожидающих больше самого предела, вытеснить их всё же приходится —
  // но молчать об этом нельзя. Потеря доставки без следа неотличима от
  // успеха: получатель ничего не ждёт, а у нас пропадает обязательство.
  const lost = items.filter((a) => a.status === "pending" && !keep.has(a.id));
  if (lost.length > 0) {
    droppedPending += lost.length;
    for (const a of lost.slice(0, 5)) {
      console.warn(
        `[webhook-queue] доставка потеряна при обрезке: ${a.id} -> ${a.webhook_url} (${a.event}), попыток ${a.attempts}`
      );
    }
    if (lost.length > 5) {
      console.warn(`[webhook-queue] ...и ещё ${lost.length - 5} потерянных доставок`);
    }
  }
  return kept;
}

export function __droppedPendingCount(): number {
  return droppedPending;
}

export async function enqueueAttempt(opts: {
  webhook_id: string;
  webhook_url: string;
  webhook_secret: string;
  event: string;
  payload: string;
  immediate?: boolean;
}): Promise<QueuedAttempt> {
  const now = Date.now();
  const attempt: QueuedAttempt = {
    id: `att_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    webhook_id: opts.webhook_id,
    webhook_url: opts.webhook_url,
    webhook_secret: opts.webhook_secret,
    event: opts.event,
    payload: opts.payload,
    attempts: 0,
    next_retry_at: opts.immediate === false ? now + BACKOFF_MS[0] : now,
    first_attempt_at: now,
    last_attempt_at: null,
    last_error: null,
    last_http_code: null,
    status: "pending",
  };
  // Раньше здесь было «прочитать всю очередь → unshift → записать обратно».
  // При упавшем чтении очередь читалась как пустая, и запись стирала ВСЕ
  // ожидающие доставки. kvPush делает ровно то же добавление в начало с тем
  // же ограничением длины, но при неудачном чтении не трогает ключ и
  // придерживает запись — поэтому здесь он, а не своя копия этой логики.
  // Не голый kvPush: он режет хвост вслепую, а хвост — несделанные доставки.
  // Читаем проверяемо; если хранилище не читается, возвращаемся к kvPush —
  // он придержит запись и не затрёт чужое (в этом и была его роль здесь).
  const q = await kvListChecked<QueuedAttempt>(QUEUE_KEY);
  if (q.ok) {
    await persistQueue([attempt, ...q.value]);
  } else {
    await kvPush(QUEUE_KEY, attempt, QUEUE_CAP);
  }
  return attempt;
}

export async function readQueue(): Promise<QueuedAttempt[]> {
  return (await kvList<QueuedAttempt>(QUEUE_KEY)) ?? [];
}

async function persistQueue(items: QueuedAttempt[]): Promise<void> {
  // Обрезка со статусом, а не slice(0, CAP): см. capKeepingPending выше.
  await kvSet(QUEUE_KEY, capKeepingPending(items));
}

async function fireOnce(att: QueuedAttempt): Promise<{
  httpCode: number | null;
  err: string | null;
}> {
  const ts = Math.floor(Date.now() / 1000);
  const sig = signHmac(att.webhook_secret, `${ts}.${att.payload}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  let httpCode: number | null = null;
  let err: string | null = null;
  try {
    const r = await fetch(att.webhook_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aevion-signature": sig,
        "x-aevion-timestamp": String(ts),
        "x-aevion-event": att.event,
        "x-aevion-webhook": att.webhook_id,
        "user-agent": `AEVION-Payments/1.4 attempt=${att.attempts + 1}`,
      },
      body: att.payload,
      signal: ctrl.signal,
    });
    httpCode = r.status;
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }
  return { httpCode, err };
}

export async function processOne(att: QueuedAttempt): Promise<QueuedAttempt> {
  const { httpCode, err } = await fireOnce(att);
  const updated: QueuedAttempt = {
    ...att,
    attempts: att.attempts + 1,
    last_attempt_at: Date.now(),
    last_error: err,
    last_http_code: httpCode,
  };
  if (httpCode !== null && httpCode >= 200 && httpCode < 300) {
    updated.status = "delivered";
    updated.next_retry_at = 0;
  } else if (updated.attempts >= MAX_ATTEMPTS) {
    updated.status = "failed";
    updated.next_retry_at = 0;
  } else {
    const idx = Math.min(updated.attempts - 1, BACKOFF_MS.length - 1);
    updated.next_retry_at = Date.now() + BACKOFF_MS[idx];
  }
  return updated;
}

export type ProcessResult = {
  scanned: number;
  processed: number;
  delivered: number;
  failed: number;
  retrying: number;
  /**
   * true = очередь прочитать НЕ удалось, поэтому обработки не было.
   * Без этого поля нули неотличимы от честного «очередь пуста»: вызывающий
   * увидел бы scanned: 0 и решил, что доставлять нечего.
   */
  unread?: boolean;
};

export async function processDue(maxBatch = 20): Promise<ProcessResult> {
  // Проверяемое чтение: ниже очередь перезаписывается целиком. При обычном
  // readQueue упавшее чтение дало бы пустой список, persistQueue стёр бы всю
  // очередь, а функция вернула бы scanned: 0 — то есть отчиталась «пусто,
  // всё спокойно» ровно в тот момент, когда доставки были уничтожены.
  const read = await kvListChecked<QueuedAttempt>(QUEUE_KEY);
  if (!read.ok) {
    return { scanned: 0, processed: 0, delivered: 0, failed: 0, retrying: 0, unread: true };
  }
  const all = read.value;
  const now = Date.now();
  const due = all
    .filter((a) => a.status === "pending" && a.next_retry_at <= now)
    .slice(0, maxBatch);

  let delivered = 0;
  let failed = 0;
  let retrying = 0;

  for (const a of due) {
    const updated = await processOne(a);
    if (updated.status === "delivered") delivered++;
    else if (updated.status === "failed") failed++;
    else retrying++;
    const idx = all.findIndex((x) => x.id === updated.id);
    if (idx >= 0) all[idx] = updated;
  }
  await persistQueue(all);
  return {
    scanned: all.length,
    processed: due.length,
    delivered,
    failed,
    retrying,
  };
}

export async function queueStats(): Promise<{
  total: number;
  pending: number;
  delivered: number;
  failed: number;
  next_due_in_sec: number | null;
  /**
   * Чтение очереди не удалось. Без этого признака оператор, спросивший
   * «есть ли застрявшие доставки», видел бы «ожидающих 0» при недоступном
   * хранилище и решил бы, что всё спокойно, — тогда как доставки просто не
   * видны. Признак назван так же, как у processDue выше: в одном файле один
   * образец.
   */
  unread?: boolean;
}> {
  const read = await kvListChecked<QueuedAttempt>(QUEUE_KEY);
  if (!read.ok) {
    return { total: 0, pending: 0, delivered: 0, failed: 0, next_due_in_sec: null, unread: true };
  }
  const all = read.value;
  const now = Date.now();
  const pending = all.filter((a) => a.status === "pending");
  const upcoming = pending
    .map((a) => a.next_retry_at - now)
    .filter((d) => d > 0)
    .sort((x, y) => x - y);
  return {
    total: all.length,
    pending: pending.length,
    delivered: all.filter((a) => a.status === "delivered").length,
    failed: all.filter((a) => a.status === "failed").length,
    next_due_in_sec: upcoming.length > 0 ? Math.ceil(upcoming[0] / 1000) : null,
  };
}
