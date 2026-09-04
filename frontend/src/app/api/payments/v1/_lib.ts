import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

export type Currency = "USD" | "EUR" | "KZT" | "AEC";

export type ApiLink = {
  id: string;
  amount: number;
  currency: Currency;
  title: string;
  description: string;
  settlement: "bank" | "aec";
  expires_in_days: number | null;
  status: "active" | "paid" | "expired";
  created: number;
  url: string;
  paid_at: number | null;
  paid_method?: string;
  paid_last4?: string;
};

export type ApiCheckout = {
  id: string;
  amount: number;
  currency: Currency;
  settlement: string;
  methods: string[];
  metadata: Record<string, string> | null;
  url: string;
  client_secret: string;
  status: "open" | "completed";
  created: number;
};

export type ApiSubscription = {
  id: string;
  customer: string;
  plan_name: string;
  amount: number;
  currency: Currency;
  interval: "weekly" | "monthly" | "quarterly" | "yearly";
  trial_days: number;
  status: "trialing" | "active" | "past_due" | "paused" | "canceled";
  current_period_start: number;
  current_period_end: number;
  created: number;
};

export type ApiWebhook = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  created: number;
};

export type ApiSettlement = {
  id: string;
  amount: number;
  currency: Currency;
  status: "pending" | "scheduled" | "paid";
  target: "bank" | "aec";
  scheduled_for: number;
  paid_at: number | null;
  reference: string;
  payments: number;
  /**
   * true — запись из НАЧАЛЬНОГО НАБОРА, а не настоящая выплата.
   *
   * Стор выплат засеивается образцами при старте (единственный из всех:
   * ссылки, споры, вебхуки и подписки начинаются пустыми). Суммы там
   * правдоподобные — 124500 со статусом paid, — и в ответе ничто не говорило,
   * что это образец. Интегратор и наша же панель показали бы «выплачено
   * $1 245.00», которых не было. Признак нужен в САМОЙ записи: ответ
   * путешествует один, и по нему нельзя спросить, откуда он взялся.
   */
  sample?: true;
  royalty: { party: string; share: number }[];
};

type Store = {
  links: Map<string, ApiLink>;
  checkouts: Map<string, ApiCheckout>;
  subscriptions: Map<string, ApiSubscription>;
  webhooks: Map<string, ApiWebhook>;
  settlements: Map<string, ApiSettlement>;
  idempotency: Map<string, { at: number; body: string }>;
};

// 31.08.2026. Платёжные ССЫЛКИ не пишутся в хранилище НИКОГДА: links/route.ts
// делает только store.links.set, вызова kv для них нет ни одного. Это не то же
// самое, что ненастроенный KV: подключение Redis возвраты, споры, аудит и
// очередь спасёт, а ссылки — нет. Флаг стоит здесь, рядом со стором, чтобы
// тот, кто переведёт ссылки в хранилище, поправил его тем же движением;
// сторож linksDurabilityFlagIsHonest не даст флагу разойтись с кодом.
export const LINKS_ARE_MEMORY_ONLY = true;

/**
 * Режим этого API: демонстрационный.
 *
 * ЗАЧЕМ ПОЛЕ, А НЕ ТОЛЬКО НАДПИСЬ НА СТРАНИЦЕ. Страницы о режиме говорят
 * честно: публичная касса пишет «Demo: any 16-digit number works», страница
 * способов оплаты упоминает демонстрационный режим 33 раза, каталог держит
 * оговорку про отсутствие банковской лицензии. А ОТВЕТЫ API об этом молчали:
 * возврат создаётся со статусом succeeded, и по ответу его не отличить от
 * настоящего возврата денег. Заглушка безопасна, только если называет себя
 * заглушкой ТАМ, где её читают, — а читают её машины, а не страницу.
 *
 * КОГДА МЕНЯТЬ. Как только в этом дереве появится обращение к настоящей кассе
 * (paybox / paypal / gumroad / lemonsqueezy), значение обязано перестать быть
 * demo. Это не на честном слове: сторож paymentsApiModeIsHonest краснеет ровно
 * на таком появлении.
 */
export const PAYMENTS_API_MODE = "demo" as const;

const globalAny = globalThis as unknown as { __aevionPayStore?: Store };

if (!globalAny.__aevionPayStore) {
  globalAny.__aevionPayStore = {
    links: new Map(),
    checkouts: new Map(),
    subscriptions: new Map(),
    webhooks: new Map(),
    settlements: seedSettlements(),
    idempotency: new Map(),
  };
}

export const store = globalAny.__aevionPayStore;

function seedSettlements(): Map<string, ApiSettlement> {
  const map = new Map<string, ApiSettlement>();
  const samples: ApiSettlement[] = [
    {
      sample: true as const,
      id: "st_q9w2k4",
      amount: 124500,
      currency: "USD",
      status: "paid",
      target: "bank",
      scheduled_for: Date.now() - 86400000,
      paid_at: Date.now() - 4 * 60 * 60 * 1000,
      reference: "AEV-2026-04-26-USD",
      payments: 47,
      royalty: [
        { party: "creator_pool", share: 0.7 },
        { party: "ip_holder", share: 0.15 },
        { party: "platform", share: 0.1 },
        { party: "treasury", share: 0.05 },
      ],
    },
    {
      sample: true as const,
      id: "st_b8h5n2",
      amount: 38900,
      currency: "EUR",
      status: "scheduled",
      target: "bank",
      scheduled_for: Date.now() + 18 * 60 * 60 * 1000,
      paid_at: null,
      reference: "AEV-2026-04-28-EUR",
      payments: 22,
      royalty: [
        { party: "creator_pool", share: 0.7 },
        { party: "ip_holder", share: 0.15 },
        { party: "platform", share: 0.1 },
        { party: "treasury", share: 0.05 },
      ],
    },
  ];
  for (const s of samples) map.set(s.id, s);
  return map;
}

const PREFIX_RE = /^(sk_test_|sk_live_)[a-zA-Z0-9_]{8,}$/;

export function authError(req: NextRequest):
  | { code: 401; body: { error: { type: string; message: string } } }
  | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) {
    return {
      code: 401,
      body: {
        error: {
          type: "authentication_error",
          message: "Missing Authorization Bearer token.",
        },
      },
    };
  }
  if (!PREFIX_RE.test(m[1])) {
    return {
      code: 401,
      body: {
        error: {
          type: "authentication_error",
          message: "Token must look like sk_test_… or sk_live_…",
        },
      },
    };
  }
  return null;
}

export function genId(prefix: string) {
  const stamp = Date.now().toString(36).slice(-4);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${stamp}${rand}`;
}

export function genSecret() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return (
    "whsec_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function signHmac(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function readLimit(
  raw: string | null,
  опции: { поумолчанию: number; максимум: number }
): number {
  // 31.08.2026. Здесь стояло `Number(searchParams.get("limit") ?? 25)` в трёх
  // местах. На мусоре (`?limit=zzz`) это даёт NaN, а NaN проходит сквозь
  // Math.min невредимым: `slice(0, NaN)` возвращает ПУСТОЙ список, и ответ
  // читается как «у вас ничего нет». Для журнала выплат и аудита платежей это
  // не пустяк: пустой список неотличим от честного ответа.
  //
  // Помощник один на всех, чтобы не появилась четвёртая копия: сегодня три
  // копии форматирования валюты и три сборки адреса возврата разошлись именно
  // так.
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return опции.поумолчанию;
  return Math.min(опции.максимум, Math.floor(n));
}

export function badRequest(message: string, code = 400) {
  return Response.json(
    { error: { type: "invalid_request_error", message } },
    { status: code }
  );
}

export function storageUnavailableError(message: string) {
  // 31.08.2026. У этой ситуации в модуле УЖЕ было решение: споры и аудит
  // отвечают типом "storage_unavailable" (четыре места). Утром я, починяя
  // возвраты, завёл для того же случая свой api_error — и получился третий
  // словарь для одного смысла. Здесь возвращаю прежнее решение: оно старше,
  // оно точнее (называет ЧТО именно недоступно), и менять его ради своего
  // предпочтения незачем. api_error остаётся для случаев, когда хранилище
  // исправно, а ответить мы всё равно не можем.
  return Response.json(
    { error: { type: "storage_unavailable", message } },
    { status: 503 }
  );
}

export function apiError(message: string, code = 503) {
  // 31.08.2026. Наша собственная неуверенность — НЕ ошибка клиента.
  // badRequest помечает ответ типом invalid_request_error, и с ним интегратор
  // уходит отлаживать своё тело запроса, тогда как запрос был безупречен, а не
  // смогли МЫ: хранилище не прочиталось или журнал обрезался. Хуже того, вместе
  // с «please retry» это прямое противоречие — неверный запрос не станет верным
  // от повтора. Такие ответы получают отдельный тип, чтобы человек на том конце
  // понял, чья это сторона и стоит ли повторять.
  return Response.json(
    { error: { type: "api_error", message } },
    { status: code }
  );
}

export function withCors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key"
  );
  return res;
}

export function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "aevion.app";
  return `${proto}://${host}`;
}

export function checkIdempotency(req: NextRequest, body: string):
  | { hit: true; cachedBody: string }
  | { hit: false; cleanup: (responseBody?: string) => void } {
  const key = req.headers.get("idempotency-key");
  if (!key) {
    return { hit: false, cleanup: () => undefined };
  }
  const prior = store.idempotency.get(key);
  if (prior) return { hit: true, cachedBody: prior.body };
  return {
    hit: false,
    cleanup: (responseBody?: string) => {
      // 31.08.2026. Кэшируется ОТВЕТ, а не то, что передали при проверке.
      // Возвраты передавали сюда тело ЗАПРОСА, и на повтор продавец получал
      // 200 со своим же {"link_id":...} вместо объекта возврата. Он проверял
      // refund.status, видел undefined, считал попытку неудавшейся и повторял
      // с НОВЫМ ключом — а новый ключ идёт мимо защиты от повтора. При
      // частичном возврате остаток это позволяет: вернули 50 из 100, повтор
      // вернёт ещё 50. Чекаут делал правильно, возвраты нет — расхождение
      // внутри одного модуля.
      store.idempotency.set(key, { at: Date.now(), body: responseBody ?? body });
      if (store.idempotency.size > 5000) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        for (const [k, v] of store.idempotency.entries()) {
          if (v.at < cutoff) store.idempotency.delete(k);
        }
      }
    },
  };
}

export async function readJson<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

type RateBucket = { count: number; resetAt: number };
const rateBuckets = (() => {
  const g = globalThis as unknown as { __aevionPayRate?: Map<string, RateBucket> };
  if (!g.__aevionPayRate) g.__aevionPayRate = new Map();
  return g.__aevionPayRate;
})();

const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_RATE_WINDOW_MS = 60 * 1000;

export function enforceRate(
  req: NextRequest,
  limit = DEFAULT_RATE_LIMIT,
  windowMs = DEFAULT_RATE_WINDOW_MS
):
  | { ok: true; headers: Record<string, string> }
  | { ok: false; response: Response } {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  // No bearer token? Auth check will reject anyway, skip rate accounting.
  if (!m) return { ok: true, headers: {} };
  const key = m[1];
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);

  // Periodic GC
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets.entries()) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }

  const remaining = Math.max(0, limit - bucket.count);
  const resetSec = Math.ceil((bucket.resetAt - now) / 1000);
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": String(resetSec),
  };
  if (bucket.count > limit) {
    return {
      ok: false,
      response: withCors(
        Response.json(
          {
            error: {
              type: "rate_limit_error",
              message: `Rate limit exceeded: ${limit} requests per ${Math.round(
                windowMs / 1000
              )}s. Try again in ${resetSec}s.`,
            },
          },
          {
            status: 429,
            headers: { ...headers, "retry-after": String(resetSec) },
          }
        )
      ),
    };
  }
  return { ok: true, headers };
}

export function attachRateHeaders(res: Response, headers: Record<string, string>) {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export function gateRequest(
  req: NextRequest,
  opts?: { limit?: number; windowMs?: number }
):
  | { ok: false; response: Response }
  | { ok: true; rateHeaders: Record<string, string> } {
  const auth = authError(req);
  if (auth) {
    return {
      ok: false,
      response: withCors(Response.json(auth.body, { status: auth.code })),
    };
  }
  const rl = enforceRate(req, opts?.limit, opts?.windowMs);
  if (!rl.ok) return { ok: false, response: rl.response };
  return { ok: true, rateHeaders: rl.headers };
}
