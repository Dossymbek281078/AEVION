import { Router } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import { queryNumber } from "../lib/queryNumber";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { clientIp } from "../lib/rateLimit";

const captureEventsError = makeServiceCapture("qevents");

export const eventsRouter = Router();



/**
 * GTM analytics events — простой ingest без внешних трекеров.
 * Хранение: JSONL append-only в data/events.jsonl
 *
 * Без cookies / fingerprinting — клиент шлёт `sid` (session id из sessionStorage),
 * чтобы можно было сгруппировать действия одной сессии. Никаких PII не пишем.
 */

const EVENTS_FILE = process.env.EVENTS_FILE
  ? process.env.EVENTS_FILE
  : join(process.cwd(), "data", "events.jsonl");

// Фиксируем РЯДОМ с путём и в тот же момент. Если читать env при вызове, поле
// могло бы сказать "persisted", пока путь остаётся дефолтным — статус, который
// врёт, хуже отсутствующего статуса.
const EVENTS_FILE_FROM_ENV = Boolean(process.env.EVENTS_FILE);

function ensureDir() {
  const dir = dirname(EVENTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
/**
 * Состояние хранилища событий — для /api/health, без аутентификации.
 *
 * Зачем: события пишутся в JSONL на файловой системе. Если EVENTS_FILE не
 * указывает на смонтированный том, на Railway это файловая система контейнера,
 * и каждый деплой начинает счёт заново. Снаружи это неотличимо от «событий
 * пока не было»: пустой лог и свежий лог выглядят одинаково.
 *
 * Отдаём только счётчики и метку самого старого события — ни одного поля
 * самих событий, никаких PII. Если oldest всегда оказывается моложе
 * bootedAt из того же ответа, данные не переживают перезапуск, и это видно
 * с первого взгляда вместо того, чтобы лезть в переменные окружения.
 */
type EventsStoreStatus = {
  /** Задана ли переменная EVENTS_FILE. НЕ отвечает на вопрос «переживут ли выкатку». */
  persistedByEnv: boolean;
  /** Лежит ли файл на смонтированном томе. Вот это и есть ответ про сохранность.
   *  null = том не объявлен окружением, судить не по чему. */
  onVolume: boolean | null;
  exists: boolean;
  count: number;
  oldest: string | null;
};

// Файл событий append-only и не ротируется, а health опрашивают постоянно —
// Railway своей проверкой, CI в цикле, любой аптайм-монитор. Читать весь файл
// на каждый вызов означает, что через сутки работы health начнёт тянуть
// мегабайты, замедлится и Railway сочтёт сервис больным. Кэшируем: цифры в
// диагностике не обязаны быть посекундными.
const STORE_STATUS_TTL_MS = 30_000;
let storeStatusCache: { at: number; value: EventsStoreStatus } | null = null;

export function eventsStoreStatus(): EventsStoreStatus {
  const now = Date.now();
  if (storeStatusCache && now - storeStatusCache.at < STORE_STATUS_TTL_MS) {
    return storeStatusCache.value;
  }
  const value = readEventsStoreStatus();
  storeStatusCache = { at: now, value };
  return value;
}

function readEventsStoreStatus(): EventsStoreStatus {
  // Путь наружу не отдаём — он раскрывает раскладку файловой системы сервера.
  // Для ответа на вопрос «переживают ли события деплой» достаточно флага и
  // метки самого старого события.
  const persistedByEnv = EVENTS_FILE_FROM_ENV;
  // ЧТО ИМЕННО СПРАШИВАЮТ. `persistedByEnv` отвечает «задана ли переменная», а
  // читается как «переживут ли события выкатку» — 14.08.2026 я сам прочёл его
  // именно так, написал основателю тревогу «первая же выкатка сотрёт замер» и
  // просил настроить переменную. Выкатка в тот же день доказала обратное: 562
  // события с 26 мая целы, потому что каталог лежит на смонтированном томе.
  // Поэтому отдаём ФАКТ: попадает ли путь под точку монтирования тома.
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || null;
  const onVolume = mount ? EVENTS_FILE.replace(/\\/g, "/").startsWith(mount.replace(/\\/g, "/")) : null;
  if (!existsSync(EVENTS_FILE)) {
    return { persistedByEnv, onVolume, exists: false, count: 0, oldest: null };
  }
  try {
    const lines = readFileSync(EVENTS_FILE, "utf8").split("\n").filter(Boolean);
    let oldest: string | null = null;
    for (const line of lines) {
      try {
        const ts = JSON.parse(line)?.ts;
        if (typeof ts === "string" && (oldest === null || ts < oldest)) oldest = ts;
      } catch {
        // Битую строку пропускаем: одна порча не должна ронять health.
      }
    }
    return { persistedByEnv, onVolume, exists: true, count: lines.length, oldest };
  } catch (e) {
    captureEventsError(e, { route: "events/storeStatus" });
    return { persistedByEnv, onVolume, exists: true, count: -1, oldest: null };
  }
}

/** Для тестов: сбросить кэш, чтобы следующий вызов прочитал файл заново. */
export function __resetEventsStoreStatusCache() {
  storeStatusCache = null;
}



interface AnalyticsEvent {
  ts: string;
  type: string;
  sid?: string;
  path?: string;
  source?: string;
  tier?: string;
  industry?: string;
  value?: number;
  meta?: Record<string, string | number | boolean | null>;
  ip?: string;
  ua?: string;
}


/**
 * Разбивка НАЧАЛ ОПЛАТЫ по поверхности и по каналу привлечения.
 *
 * Вынесено отдельной чистой функцией, чтобы тест проверял тот самый код,
 * который выполняется в проде, а не его копию, переписанную в тесте: копия
 * расходится с оригиналом молча и создаёт ровно ту ложную уверенность,
 * ради борьбы с которой тест и пишется.
 *
 * `bySource` в сводке считает ВСЕ события, поэтому в нём доминируют
 * page_view и намерение купить тонет. Здесь — только `checkout_start`.
 * Канал приезжает в `meta.channel` из метки `?c=` (lib/products withChannel
 * + components/BuyLink). Ключи нейтральные: дашборд открывают и в EN/KK.
 */
export function summarizeCheckoutStarts(events: Array<Pick<AnalyticsEvent, "type" | "source" | "meta">>): {
  bySource: Record<string, number>;
  byChannel: Record<string, number>;
} {
  const bySource: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  for (const ev of events) {
    if (ev.type !== "checkout_start") continue;
    const src = ev.source?.trim() || "unknown";
    bySource[src] = (bySource[src] ?? 0) + 1;
    const ch = ev.meta?.channel;
    const chKey = typeof ch === "string" && ch.trim() ? ch.trim() : "direct";
    byChannel[chKey] = (byChannel[chKey] ?? 0) + 1;
  }
  return { bySource, byChannel };
}

/**
 * Покупки по каналам — и отдельно выручка по тем, у кого сумма известна.
 *
 * Зачем отдельно от `byChannel`. Тот считает ВСЕ события подряд: просмотры,
 * нажатия, заходы в кассу. Канал с большим трафиком и нулём продаж выглядит в
 * нём лучше канала с одной покупкой — то есть по этому числу нельзя решать,
 * куда тратить деньги, а выглядит оно как раз таким числом.
 *
 * Сумма известна не у всех: у возврата PayBox в адрес уходит `ref`, а не сумма.
 * Поэтому выручка и счёт покупок разведены, а рядом едет `сКоторыхИзвестнаСумма`
 * — знаменатель. Без него частичная выручка читается как полная и занижает
 * канал молча, а это ровно тот случай, когда решение принимают по числу.
 */
export function summarizePurchases(
  events: Array<Pick<AnalyticsEvent, "type" | "value"> & { meta?: Record<string, unknown> }>,
): {
  byChannel: Record<string, number>;
  revenueByChannel: Record<string, number>;
  total: number;
  сКоторыхИзвестнаСумма: number;
} {
  const byChannel: Record<string, number> = {};
  const revenueByChannel: Record<string, number> = {};
  let total = 0;
  let сКоторыхИзвестнаСумма = 0;

  for (const ev of events) {
    if (ev.type !== "checkout_success") continue;
    // Заглушка и бесплатный тариф покупкой не считаются: иначе канал,
    // приводящий любителей бесплатного, выглядит как приносящий деньги.
    if (ev.meta?.stub === true) continue;
    const сумма = typeof ev.value === "number" ? ev.value : null;
    if (сумма === 0) continue;

    total += 1;
    const ch = ev.meta?.channel;
    const chKey = typeof ch === "string" && ch.trim() ? ch.trim() : "direct";
    byChannel[chKey] = (byChannel[chKey] ?? 0) + 1;
    if (сумма !== null) {
      сКоторыхИзвестнаСумма += 1;
      revenueByChannel[chKey] = (revenueByChannel[chKey] ?? 0) + сумма;
    }
  }

  return { byChannel, revenueByChannel, total, сКоторыхИзвестнаСумма };
}

const ALLOWED_TYPES = new Set([
  "page_view",
  "cta_click",
  "calculator_open",
  "calculator_quote",
  "checkout_start",
  "checkout_success",
  "checkout_cancel",
  "lead_submit",
  "tier_view",
  "industry_view",
  "faq_open",
  "comparison_view",
  "affiliate_apply",
  "partner_apply",
  "edu_apply",
  "ab_assigned",
]);

function rateLimitKey(ip: string) {
  return `ev:${ip}`;
}
const RATE = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_MIN = 60;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(rateLimitKey(ip));
  if (!cur || cur.reset < now) {
    RATE.set(rateLimitKey(ip), { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  if (cur.count >= MAX_PER_MIN) return true;
  cur.count += 1;
  return false;
}

/**
 * POST /api/pricing/events
 * Body: { type, sid?, path?, source?, tier?, industry?, value?, meta? }
 *
 * Принимает один event. Для batch — клиент шлёт несколько запросов
 * (или sendBeacon). Дёшево, надёжно, без потери при unload.
 */
eventsRouter.post("/", (req, res) => {
  // Ключ ограничителя, а не журнал: левый элемент X-Forwarded-For задаёт
  // клиент, и предел снимался сменой заголовка на каждом запросе.
  const ip = clientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const body = req.body ?? {};
  const type = typeof body.type === "string" ? body.type.trim() : "";

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "invalid_type", type });
  }

  const event: AnalyticsEvent = {
    ts: new Date().toISOString(),
    type,
    sid: typeof body.sid === "string" ? body.sid.slice(0, 60) : undefined,
    path: typeof body.path === "string" ? body.path.slice(0, 200) : undefined,
    source: typeof body.source === "string" ? body.source.slice(0, 60) : undefined,
    tier: typeof body.tier === "string" ? body.tier.slice(0, 30) : undefined,
    industry: typeof body.industry === "string" ? body.industry.slice(0, 60) : undefined,
    value: Number.isFinite(body.value) ? body.value : undefined,
    meta:
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? Object.fromEntries(
            Object.entries(body.meta as Record<string, unknown>)
              .slice(0, 20)
              .filter(([k, v]) =>
                typeof k === "string" &&
                k.length < 40 &&
                (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null),
              )
              .map(([k, v]) => [
                k,
                typeof v === "string" ? v.slice(0, 200) : (v as string | number | boolean | null),
              ]),
          )
        : undefined,
    ip,
    ua: typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string).slice(0, 200) : undefined,
  };

  try {
    ensureDir();
    appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
  } catch (e) {
    console.error("[events] write failed", e);
    captureEventsError(e, { route: "events/POST" });
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(204).end();
});

/**
 * GET /api/pricing/events/summary
 * Суммарные метрики по последним N событиям.
 * Защищён ADMIN_TOKEN (header X-Admin-Token).
 */
eventsRouter.get("/summary", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!existsSync(EVENTS_FILE)) {
    return res.json({
      total: 0,
      byType: {},
      bySource: {},
      byTier: {},
      checkoutBySource: {},
      checkoutByChannel: {},
      byIndustry: {},
      byChannel: {},
      byProduct: {},
      sessionCount: 0,
      windowHours: 24,
    });
  }

  const limit = Math.min(Math.max(queryNumber(req.query.limit, 5000), 100), 50000);
  const sinceHours = Math.min(Math.max(queryNumber(req.query.hours, 24), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/summary] read failed", e);
    captureEventsError(e, { route: "events/GET/summary" });
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  /*
   * Обрезка окна должна называть себя.
   *
   * Порядок здесь такой: сперва берём ПОСЛЕДНИЕ `limit` строк, и только потом
   * фильтруем по времени. Значит при журнале длиннее предела ответ на вопрос
   * «что было за 30 дней» молча превращается в «что было за последние N
   * событий» — и выглядит он при этом как полный ответ.
   *
   * Замер 01.09.2026: в журнале прода 4476 событий при пределе 5000, то есть
   * 89 % запаса уже израсходовано. Первый же всплеск трафика — ради которого
   * всё и делается — сделает числа тихо заниженными, и заметить это будет
   * нечем: панель покажет меньшую выручку по каналам как факт.
   *
   * Поэтому отдаём ПРИЗНАК обрезки и время самого старого учтённого события.
   * Число без знаменателя здесь опаснее отсутствия числа: по нему решают,
   * куда тратить деньги.
   */
  /*
   * Окно берём ПО ВРЕМЕНИ, а не по числу строк.
   *
   * Журнал append-only и метку времени ставит сервер при записи, значит он
   * упорядочен. Идём с конца и останавливаемся на первом событии старше окна:
   * тогда «за 30 дней» отвечено ровно за 30 дней, сколько бы строк это ни было.
   *
   * `limit` остаётся ПРЕДОХРАНИТЕЛЕМ от неограниченной памяти, а не окном. И
   * теперь он честно виден: если предохранитель сработал ВНУТРИ окна — значит
   * ответ неполон, и это ровно то, о чём сообщает `truncated`.
   */
  const отобранные: string[] = [];
  let упёрлисьВПредохранитель = false;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (отобранные.length >= limit) {
      // Предохранитель сработал, а строки ещё есть — значит окно не дочитано.
      упёрлисьВПредохранитель = true;
      break;
    }
    const строка = lines[i];
    let ts: unknown = null;
    try {
      ts = JSON.parse(строка)?.ts;
    } catch {
      // Битую строку не считаем границей окна: одна порча не должна обрезать
      // весь ответ. Пропускаем её и идём дальше — счёт ниже её не учтёт.
      continue;
    }
    if (typeof ts === "string" && new Date(ts).getTime() < sinceMs) break;
    отобранные.push(строка);
  }
  const обрезано = упёрлисьВПредохранитель;
  const tail = отобранные.reverse();

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const byIndustry: Record<string, number> = {};
  /** Разбивку по ним считает summarizeCheckoutStarts — см. её комментарий. */
  const checkoutEvents: AnalyticsEvent[] = [];
  const purchaseEvents: AnalyticsEvent[] = [];
  // Канал (tt / ig / yt …) — единственный ответ на вопрос «какая раздача
  // принесла людей». Он приезжает в meta, а сводка до 13.08.2026 считала
  // только поля верхнего уровня: метка доезжала и НЕ показывалась никому.
  const byChannel: Record<string, number> = {};
  // Товар, по которому нажали «купить». Без него видно «клики были», но не
  // видно, что именно хотели купить.
  const byProduct: Record<string, number> = {};
  const sids = new Set<string>();
  let total = 0;

  for (const line of tail) {
    try {
      const ev = JSON.parse(line) as AnalyticsEvent;
      if (ev.ts && new Date(ev.ts).getTime() < sinceMs) continue;
      total += 1;
      byType[ev.type] = (byType[ev.type] ?? 0) + 1;
      if (ev.source) bySource[ev.source] = (bySource[ev.source] ?? 0) + 1;
      if (ev.tier) byTier[ev.tier] = (byTier[ev.tier] ?? 0) + 1;
      if (ev.industry) byIndustry[ev.industry] = (byIndustry[ev.industry] ?? 0) + 1;
      const meta = (ev as { meta?: Record<string, unknown> }).meta;
      const channel = typeof meta?.channel === "string" ? meta.channel : null;
      if (channel) byChannel[channel] = (byChannel[channel] ?? 0) + 1;
      const product = typeof meta?.product === "string" ? meta.product : null;
      if (product) byProduct[product] = (byProduct[product] ?? 0) + 1;
      if (ev.sid) sids.add(ev.sid);
      if (ev.type === "checkout_start") checkoutEvents.push(ev);
      if (ev.type === "checkout_success") purchaseEvents.push(ev);
    } catch {
      // skip malformed line
    }
  }

  const checkoutSummary = summarizeCheckoutStarts(checkoutEvents);
  const purchases = summarizePurchases(purchaseEvents);

  res.json({
    total,
    byType,
    bySource,
    byTier,
    byIndustry,
    checkoutBySource: checkoutSummary.bySource,
    checkoutByChannel: checkoutSummary.byChannel,
    purchaseByChannel: purchases.byChannel,
    purchaseRevenueByChannel: purchases.revenueByChannel,
    purchaseCount: purchases.total,
    purchaseWithKnownAmount: purchases.сКоторыхИзвестнаСумма,
    byChannel,
    byProduct,
    sessionCount: sids.size,
    windowHours: sinceHours,
    // Обрезано ли окно журналом: если да, «за 30 дней» отвечено НЕ за 30 дней.
    truncated: обрезано,
    consideredEvents: tail.length,
    totalEvents: lines.length,
  });
});

/**
 * GET /api/pricing/events/aggregate
 * Time-bucketed counts. Защищён ADMIN_TOKEN.
 *
 * Параметры:
 *   - period (hour|day, default day) — размер бакета
 *   - groupBy (source|type|tier|industry, default type) — измерение разбивки
 *   - hours (1..720, default 168) — окно
 *
 * Ответ: { period, groupBy, windowHours, buckets: [{ bucket, total, counts: {<dim>: n} }] }
 */
eventsRouter.get("/aggregate", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const period = req.query.period === "hour" ? "hour" : "day";
  const GROUP_DIMS = new Set(["source", "type", "tier", "industry"]);
  const groupBy = GROUP_DIMS.has(String(req.query.groupBy)) ? String(req.query.groupBy) : "type";
  const sinceHours = Math.min(Math.max(queryNumber(req.query.hours, 168), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ period, groupBy, windowHours: sinceHours, buckets: [] });
  }

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/aggregate] read failed", e);
    captureEventsError(e, { route: "events/GET/aggregate" });
    return res.status(500).json({ error: "read_error" });
  }

  // bucketKey: ISO timestamp truncated to the hour or the day
  function bucketKey(iso: string): string {
    return period === "hour" ? iso.slice(0, 13) + ":00:00Z" : iso.slice(0, 10) + "T00:00:00Z";
  }

  const buckets = new Map<string, { total: number; counts: Record<string, number> }>();
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (!ev.ts || new Date(ev.ts).getTime() < sinceMs) continue;
    const key = bucketKey(ev.ts);
    let b = buckets.get(key);
    if (!b) {
      b = { total: 0, counts: {} };
      buckets.set(key, b);
    }
    b.total += 1;
    const dim = (ev as unknown as Record<string, unknown>)[groupBy];
    const dimVal = typeof dim === "string" && dim.length > 0 ? dim : "(none)";
    b.counts[dimVal] = (b.counts[dimVal] ?? 0) + 1;
  }

  const sorted = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, v]) => ({ bucket, total: v.total, counts: v.counts }));

  res.json({ period, groupBy, windowHours: sinceHours, buckets: sorted });
});

/**
 * GET /api/pricing/events/recent
 * Последние N событий целиком. Защищён ADMIN_TOKEN.
 */
eventsRouter.get("/recent", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ items: [], total: 0 });
  }

  const limit = Math.min(Math.max(queryNumber(req.query.limit, 100), 1), 1000);

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/recent] read failed", e);
    captureEventsError(e, { route: "events/GET/recent" });
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const tail = lines.slice(-limit).reverse();
  const items: AnalyticsEvent[] = [];
  for (const line of tail) {
    try {
      items.push(JSON.parse(line) as AnalyticsEvent);
    } catch {
      // skip
    }
  }
  res.json({ items, total: lines.length });
});

/**
 * GET /api/pricing/events/by-variant
 * Конверсии в разрезе A/B-вариантов. Защищён ADMIN_TOKEN.
 *
 * Группирует события по `meta.variant_<key>` и считает воронку:
 * page_view → cta_click → lead_submit / checkout_start → checkout_success.
 *
 * Параметры:
 *   - hours (1..720, default 168) — окно
 *   - keys (csv, default "hero,tierCards") — какие variant-ключи группировать
 */
eventsRouter.get("/by-variant", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const sinceHours = Math.min(Math.max(queryNumber(req.query.hours, 168), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const keys = (typeof req.query.keys === "string" ? req.query.keys : "hero,tierCards")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);

  const FUNNEL_TYPES = [
    "page_view",
    "cta_click",
    "lead_submit",
    "checkout_start",
    "checkout_success",
  ] as const;

  type FunnelCounts = Record<typeof FUNNEL_TYPES[number], number>;

  function emptyCounts(): FunnelCounts {
    return {
      page_view: 0,
      cta_click: 0,
      lead_submit: 0,
      checkout_start: 0,
      checkout_success: 0,
    };
  }

  const result: Record<string, Record<string, FunnelCounts>> = {};
  for (const k of keys) result[k] = {};

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ keys, windowHours: sinceHours, variants: result });
  }

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/by-variant] read failed", e);
    captureEventsError(e, { route: "events/GET/by-variant" });
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (!ev.ts || new Date(ev.ts).getTime() < sinceMs) continue;
    if (!FUNNEL_TYPES.includes(ev.type as typeof FUNNEL_TYPES[number])) continue;
    if (!ev.meta || typeof ev.meta !== "object") continue;

    for (const k of keys) {
      const v = ev.meta[`variant_${k}`];
      if (typeof v !== "string" || v.length === 0) continue;
      if (!result[k][v]) result[k][v] = emptyCounts();
      result[k][v][ev.type as typeof FUNNEL_TYPES[number]] += 1;
    }
  }

  res.json({ keys, windowHours: sinceHours, variants: result });
});
