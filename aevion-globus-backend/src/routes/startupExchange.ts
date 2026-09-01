/**
 * StartupX — the startup exchange
 * ───────────────────────────────
 * Three tiers, three deals (see lib/startupx/model.ts):
 *   idea    — equity for capital, investor funds the build
 *   mvp     — equity for capital, investor funds finishing it
 *   product — purchase of the whole thing, or of a stake
 *
 * Every listing gets a free, deterministic assessment on submit
 * (lib/startupx/assess.ts) — no LLM call, no cost, same input always yields the
 * same score, and the disclaimer travels inside the payload so no surface can
 * render the number without it.
 */

import { Router, Request, Response, NextFunction } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import crypto from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { pgIntId } from "../lib/queryNumber";
import {
  callProvider,
  pickConfiguredProvider,
  getProviders,
  type ChatMessage,
} from "../services/qcoreai/providers";
import { createInMemoryRateLimiter, clientIp } from "../lib/rateLimit/inMemoryWindow";
import { mountConceptBoard } from "../lib/conceptBoardStore";
import { getPool } from "../lib/dbPool";

const captureStartupXError = makeServiceCapture("startup-exchange");
import {
  ensureStartupExchangeTables,
  isStartupExchangeDbReady,
} from "../lib/ensureStartupExchangeTables";
import {
  TIERS,
  TIER_SPECS,
  DEAL_INTENTS,
  isTier,
  legacyStageForTier,
  looksLikeEmail,
  normalizeListing,
  tierFromLegacyStage,
  type DealIntent,
  type DealTerms,
  type ListingInput,
  type ListingMetrics,
  type Tier,
} from "../lib/startupx/model";
import { assessListing, ASSESSMENT_VERSION, DISCLAIMER, type Assessment } from "../lib/startupx/assess";
import { MARKET_SOURCES, fmt as fmtMoney } from "../lib/startupx/valuation";
import { timingSafeHexEq } from "../lib/qrightHelpers";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/authJwt";
import { listSectors } from "../lib/qventure/sectors";
import { safeResolveSector } from "../lib/startupx/sectorDetect";
import { escapeLikePattern } from "../lib/startupx/likePattern";
import { sendOfferNotice } from "../lib/startupx/notifyFounder";

// ─── Setup ────────────────────────────────────────────────────────────────────

const pool = getPool();
(async () => {
  try { await ensureStartupExchangeTables(pool); }
  catch { /* silent — in-memory fallback active */ }
})();

const generalLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "startupx:general", message: "rate_limited" });
const postLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "startupx:post", message: "rate_limited" });
// The preview assessment is free and costs no LLM call, but it is still CPU on
// an unauthenticated path.
const assessLimiter = rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "startupx:assess", message: "rate_limited" });
// Reading offers takes a 256-bit token, so guessing is hopeless — but a tight
// limit keeps a guesser from turning the endpoint into a load generator.
const offersLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "startupx:offers", message: "rate_limited" });
// Жалоба — дешёвое действие с дорогими последствиями, поэтому лимит жёсткий.
const reportLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "startupx:report", message: "rate_limited" });
// Минутный лимит защищает сервер, но не ленту: 5 публикаций в минуту — это 300
// в час, то есть один человек может затопить витрину за вечер. Суточный потолок
// на адрес бьёт по потоку, а не по скорости. Живому основателю пяти заявок в
// сутки хватит с запасом: у него их одна.
//
// Считаем ОПУБЛИКОВАННОЕ, а не попытки. Основатель, который пять раз промахнулся
// мимо обязательного поля, не должен на сутки терять право подать заявку — иначе
// защита от потока бьёт ровно по тому, ради кого биржа существует.
//
// Чего этот потолок НЕ делает: заголовок X-Forwarded-For приходит от клиента и
// подделывается, так что упорный флудер обойдёт счётчик сменой адреса. От этого
// защищает не лимит, а очередь модерации и жалобы (`/report`, `/reports`).
const PUBLISH_PER_DAY = (() => {
  const raw = Number(process.env.STARTUPX_PUBLISH_PER_DAY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5;
})();
const publishQuota = createInMemoryRateLimiter({ max: PUBLISH_PER_DAY, windowMs: 24 * 60 * 60_000 });

/**
 * Один способ узнать адрес на весь модуль: счётчик показов, дедуп жалоб и
 * суточный потолок публикаций обязаны видеть одного и того же человека.
 */
function requestIp(req: Request): string {
  const ip = clientIp(req);
  return ip !== "unknown" ? ip : req.socket?.remoteAddress || "unknown";
}

/**
 * База ожидалась и отказала посреди работы.
 *
 * Раньше любой сбой запроса проваливался в in-memory ветку, и это давало две лжи
 * сразу: чтение отвечало «заявка не найдена» (для основателя это «моя заявка
 * пропала», хотя строка цела), а запись молча уходила в оперативку и исчезала на
 * ближайшем рестарте. Замерено 27.07 на живом Postgres: при исчерпании
 * подключений `GET /ideas/:id` отдавал 404 на существующую заявку.
 *
 * Память остаётся законным режимом только там, где базы и не предполагалось
 * (`DATABASE_URL` не задан) — превью-деплои и локальная разработка.
 */
function dbOutage(res: Response, e: unknown, where: string): Response {
  captureStartupXError(e);
  console.error(`[StartupX] ${where} — база недоступна`, e);
  res.setHeader("Retry-After", "30");
  return fail(res, "database_unavailable", 503);
}


/**
 * Ворота суточного потолка. Стоят ПЕРЕД минутным лимитом намеренно: когда
 * исчерпаны оба, человеку надо сказать «сегодня всё», а не «подождите минуту» —
 * минута ему не поможет. Здесь только проверка; списывается квота в обработчике,
 * и только если заявка действительно опубликована. Цена этого разделения — на
 * последнем оставшемся слоте два одновременных запроса могут пройти оба: лишняя
 * заявка в сутки дешевле, чем сутки блокировки за опечатку в форме.
 */
function publishGate(req: Request, res: Response, next: NextFunction) {
  const quota = publishQuota.peek(requestIp(req));
  res.setHeader("X-Publish-Quota-Limit", String(PUBLISH_PER_DAY));
  res.setHeader("X-Publish-Quota-Remaining", String(quota.remaining));
  if (quota.allowed) return next();
  const retryAfterSec = Math.max(1, Math.ceil(quota.retryAfterMs / 1000));
  res.setHeader("Retry-After", String(retryAfterSec));
  fail(res, "daily_publish_limit", 429, { retryAfterSec, limitPerDay: PUBLISH_PER_DAY });
}

export const startupExchangeRouter = Router();
startupExchangeRouter.use(generalLimiter);

/**
 * Пока база не поднялась — пробуем на каждом запросе (не чаще раза в 10 секунд,
 * пауза внутри `ensureStartupExchangeTables`). Одной попытки при старте
 * недостаточно: замерено на живом Postgres 18 — первое подключение отвалилось
 * по таймауту, и модуль остался в памяти при полностью рабочей базе.
 * Когда `DATABASE_URL` не задан, база не предполагается и дёргать нечего.
 */
startupExchangeRouter.use((_req: Request, _res: Response, next: NextFunction) => {
  if (!process.env.DATABASE_URL || isStartupExchangeDbReady()) return next();
  // Не ждём результата: текущий запрос честно отработает на памяти, а
  // следующий уже увидит поднявшуюся базу. Ждать здесь — значит добавить
  // таймаут подключения ко времени ответа.
  void ensureStartupExchangeTables(pool).catch(() => { /* уже залогировано внутри */ });
  next();
});

const MAX_EMAIL = 200;
const MAX_MESSAGE = 2000;
const MEM_MAX_LISTINGS = 50;
const MEM_MAX_INTERESTS = 200;

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface ListingRow {
  /** Оценка моделью: колонка добавляется лениво, поэтому необязательная. */
  ai_score?: unknown;
  ai_scored_at?: string | Date | null;
  id: number;
  title: string;
  description: string;
  stage: string;
  tier: string | null;
  sector: string | null;
  geography: string | null;
  demo_url: string | null;
  repo_url: string | null;
  deal: DealTerms | null;
  metrics: ListingMetrics | null;
  assessment: Assessment | null;
  assessment_score: number | null;
  assessment_version: number | null;
  founder_email: string | null;
  contact_method: string | null;
  qright_object_id: string | null;
  content_hash: string | null;
  manage_token_hash: string | null;
  views: number;
  removed_reason: string | null;
  removed_at: string | null;
  visibility: string;
  created_at: string;
}

interface InterestRow {
  id: number;
  idea_id: number;
  investor_email: string;
  message: string | null;
  intent: string | null;
  ticket_usd: number | null;
  equity_pct: number | null;
  created_at: string;
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

const memListings = new Map<number, ListingRow>();
const memInterests = new Map<number, InterestRow>();
const memReports = new Map<string, { idea_id: number; reason: string; note: string | null; at: string }>();
let memListingSeq = 1;
let memInterestSeq = 1;

function memInsertListing(row: Omit<ListingRow, "id" | "created_at">): ListingRow {
  const id = memListingSeq++;
  const full: ListingRow = { ...row, id, created_at: new Date().toISOString() };
  memListings.set(id, full);
  if (memListings.size > MEM_MAX_LISTINGS) {
    const oldest = Math.min(...memListings.keys());
    memListings.delete(oldest);
  }
  return full;
}

function memInsertInterest(row: Omit<InterestRow, "id" | "created_at">): InterestRow {
  const id = memInterestSeq++;
  const full: InterestRow = { ...row, id, created_at: new Date().toISOString() };
  memInterests.set(id, full);
  if (memInterests.size > MEM_MAX_INTERESTS) {
    const oldest = Math.min(...memInterests.keys());
    memInterests.delete(oldest);
  }
  return full;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Same hashing convention as QRight (see qright.ts:946): a deterministic
 * authorship stamp the founder gets for free at submit time. Duplicated here
 * rather than imported to avoid a circular boot-time dependency.
 */
function computeContentHash(input: { title: string; description: string; tier: Tier }): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ title: input.title, description: input.description, stage: input.tier }))
    .digest("hex");
}

/**
 * The founder's key to their own listing. Returned once, on publish, and never
 * again: only its SHA-256 lives in the database, so a dump of the table does
 * not hand anyone the offers a founder received.
 */
function mintManageToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: crypto.createHash("sha256").update(token).digest("hex") };
}

function manageTokenMatches(token: unknown, hash: string | null): boolean {
  if (typeof token !== "string" || !hash) return false;
  const candidate = crypto.createHash("sha256").update(token).digest("hex");
  return timingSafeHexEq(candidate, hash);
}

/**
 * Оператор площадки. Тот же приём, что в awards: JWT + список почт в env, плюс
 * роль admin. Отдельного механизма для биржи не заводим — второй способ делать
 * то же самое расходится с первым ровно тогда, когда это дороже всего.
 */
function verifyBearer(req: Request): { sub?: string; email?: string; role?: string } | null {
  const header = req.headers?.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as {
      sub?: string; email?: string; role?: string;
    };
  } catch {
    return null;
  }
}

function isStartupXAdmin(auth: { role?: string; email?: string } | null): boolean {
  if (!auth) return false;
  if (auth.role === "admin" || auth.role === "ADMIN") return true;
  const raw = (process.env.STARTUPX_ADMIN_EMAILS || process.env.AEVION_ADMIN_EMAILS || "").trim();
  if (!raw || !auth.email) return false;
  const allow = new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  return allow.has(auth.email.toLowerCase());
}

/** Public projection: founder_email never leaves the server. */
function publicView(row: ListingRow, interest_count?: number) {
  const tier = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tier,
    tierLabel: TIER_SPECS[tier].label,
    /** Kept for older consumers; always derived from `tier`, never independent. */
    stage: row.stage,
    sector: row.sector,
    geography: row.geography,
    demo_url: row.demo_url,
    repo_url: row.repo_url,
    deal: row.deal,
    metrics: row.metrics,
    assessment: row.assessment,
    assessment_score: row.assessment_score,
    assessment_version: row.assessment_version,
    contact_method: row.contact_method,
    qright_object_id: row.qright_object_id,
    content_hash: row.content_hash,
    qright_protected: Boolean(row.qright_object_id || row.content_hash),
    views: row.views ?? 0,
    removed_reason: row.removed_reason ?? null,
    visibility: row.visibility,
    created_at: row.created_at,
    ...(interest_count !== undefined ? { interest_count } : {}),
  };
}

function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

function fail(res: Response, error: string, status = 400, extra?: Record<string, unknown>): Response {
  return res.status(status).json({ success: false, error, ...(extra ?? {}) });
}

// ─── GET /api/startupx/health ────────────────────────────────────────────────
/*
 * ПУБЛИЧНОЕ ЛИЦО БИРЖИ не должно состоять из наших же проверок.
 *
 * Замер на проде 01.09.2026: `/api/startupx/ideas?limit=50` вернул 19 заявок,
 * из них 18 с заголовком «Smoke Idea smoke-1784…», а девятнадцатая называется
 * «T». То есть витрина главного продукта — целиком наши смоук-прогоны.
 *
 * Это не косметика. Инвестор, пришедший смотреть заявки, видит девятнадцать
 * пустых записей и уходит; основатель стартапа видит то же и не подаёт свою.
 * И «19» — число на витрине, а по нашему стандарту числа берутся из
 * фактического прогона, а не из наших проверок.
 *
 * ⚠️ ОДНО условие на ВСЕ места, где спрашивается публичность. Их двенадцать:
 * список, счётчик, разбивки по стадиям и секторам, «за неделю», средний балл.
 * Отфильтруй мы только список — счётчики остались бы прежними, и витрина
 * заспорила бы сама с собой. Ровно этот дефект я чинил час назад в QPersona.
 *
 * Признак сужен намеренно: `smoke` только с отделяющим хвостом. Первая
 * редакция ловила и живого человека `smokey-eyes` — признак, прячущий
 * настоящих, хуже отсутствия признака.
 */
export const PUBLIC_LISTING_SQL =
  "visibility='public' AND NOT (title ~ '^Smoke Idea' OR title ~ '^smoke([-_0-9]|$)' OR title = 'T')";

/** То же правило для пути в памяти. Расходиться им нельзя — есть тест. */
export function isSmokeListing(title: unknown): boolean {
  const t = String(title ?? "").trim();
  if (t === "T") return true;
  if (t.startsWith("Smoke Idea")) return true;
  if (t.startsWith("smoke") && /^[-_0-9]/.test(t.slice(5))) return true;
  return false;
}

startupExchangeRouter.get("/health", (req: Request, res: Response) => {
  res.json({
    ok: true,
    dbReady: isStartupExchangeDbReady(),
    service: "startupx",
    // Суточный потолок публикаций и остаток именно для этого адреса: и человеку
    // видно, сколько у него осталось, и смоук не гадает про настроенное число.
    publishPerDay: PUBLISH_PER_DAY,
    publishRemaining: publishQuota.peek(requestIp(req)).remaining,
    // Как модуль ВИДИТ адрес звонящего. Это проверка на один конкретный риск:
    // страница ходит в API через rewrite на фронте, то есть до бэкенда запрос
    // доезжает от сервера Vercel. Если адрес клиента при этом теряется, все
    // основатели окажутся одним адресом — и суточный потолок из защиты ленты
    // превратится в «пять заявок в сутки на всю биржу».
    // Проверка после деплоя: открыть /health с двух разных устройств. Разные
    // clientIp — всё в порядке; одинаковые — снять потолок (STARTUPX_PUBLISH_PER_DAY)
    // и вернуться к нему, когда адрес будет доезжать.
    clientIp: requestIp(req),
  });
});

// ─── GET /api/startupx/tiers ─────────────────────────────────────────────────
// The UI renders tier rules, ticket norms and market sources from here, so the
// screen and the scoring can never describe two different products.
startupExchangeRouter.get("/tiers", (_req: Request, res: Response) => {
  ok(res, {
    tiers: TIERS.map((t) => TIER_SPECS[t]),
    intents: DEAL_INTENTS,
    // The sector list the assessment actually scores against — so the form can
    // never offer a sector the engine does not know.
    sectors: listSectors(),
    sources: MARKET_SOURCES,
    assessmentVersion: ASSESSMENT_VERSION,
    disclaimer: DISCLAIMER,
  });
});

// ─── GET /api/startupx/stats ─────────────────────────────────────────────────
startupExchangeRouter.get("/stats", async (_req: Request, res: Response) => {
  const emptyByTier = (): Record<string, number> => ({ idea: 0, mvp: 0, product: 0 });
  const emptyByStage = (): Record<string, number> => ({ idea: 0, prototype: 0, mvp: 0, scaling: 0 });

  try {
    if (isStartupExchangeDbReady()) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS n FROM startup_ideas WHERE ${PUBLIC_LISTING_SQL}`);
      const tierQ = await pool.query(
        `SELECT COALESCE(tier, 'idea') AS tier, COUNT(*)::int AS n FROM startup_ideas
         WHERE ${PUBLIC_LISTING_SQL} GROUP BY 1`,
      );
      const stageQ = await pool.query(
        `SELECT stage, COUNT(*)::int AS n FROM startup_ideas WHERE ${PUBLIC_LISTING_SQL} GROUP BY stage`,
      );
      const recentQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_ideas
         WHERE ${PUBLIC_LISTING_SQL} AND created_at > NOW() - INTERVAL '7 days'`,
      );
      const scoredQ = await pool.query(
        `SELECT COUNT(*)::int AS n, COALESCE(AVG(assessment_score), 0)::float AS avg
         FROM startup_ideas WHERE ${PUBLIC_LISTING_SQL} AND assessment_score IS NOT NULL`,
      );
      // Заявки, разобранные прошлыми правилами. Версия защищена тестом, но
      // без этого счётчика её подъём остаётся теорией: непонятно, сколько строк
      // нужно пересчитать через /reassess, чтобы лента снова сравнивала
      // сравнимое.
      const staleQ = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_ideas
         WHERE ${PUBLIC_LISTING_SQL} AND assessment_score IS NOT NULL
           AND COALESCE(assessment_version, 0) < $1`,
        [ASSESSMENT_VERSION],
      );

      const byTier = emptyByTier();
      for (const r of tierQ.rows as Array<{ tier: string; n: number }>) byTier[r.tier] = Number(r.n) || 0;
      const byStage = emptyByStage();
      for (const r of stageQ.rows as Array<{ stage: string; n: number }>) byStage[r.stage] = Number(r.n) || 0;

      return ok(res, {
        total: totalQ.rows[0]?.n ?? 0,
        byTier,
        byStage,
        recentCount: recentQ.rows[0]?.n ?? 0,
        assessed: scoredQ.rows[0]?.n ?? 0,
        avgScore: Math.round(Number(scoredQ.rows[0]?.avg ?? 0)),
        staleAssessments: staleQ.rows[0]?.n ?? 0,
        assessmentVersion: ASSESSMENT_VERSION,
      });
    }
  } catch (e) {
    if (isStartupExchangeDbReady()) return dbOutage(res, e, "GET /stats");
    console.error("[StartupX] /stats DB error", e);
  }

  const all = Array.from(memListings.values()).filter((r) => r.visibility === "public" && !isSmokeListing(r.title));
  const byTier = emptyByTier();
  const byStage = emptyByStage();
  for (const r of all) {
    const t = isTier(r.tier) ? r.tier : tierFromLegacyStage(r.stage);
    byTier[t] = (byTier[t] ?? 0) + 1;
    byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
  }
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600_000;
  const scored = all.filter((r) => r.assessment_score !== null);
  return ok(res, {
    total: all.length,
    byTier,
    byStage,
    recentCount: all.filter((r) => new Date(r.created_at).getTime() > sevenDaysAgo).length,
    assessed: scored.length,
    avgScore: scored.length
      ? Math.round(scored.reduce((a, r) => a + (r.assessment_score ?? 0), 0) / scored.length)
      : 0,
    staleAssessments: scored.filter((r) => (r.assessment_version ?? 0) < ASSESSMENT_VERSION).length,
    assessmentVersion: ASSESSMENT_VERSION,
  });
});

// ─── GET /api/startupx/ideas ─────────────────────────────────────────────────
startupExchangeRouter.get("/ideas", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const tier = isTier(req.query.tier) ? req.query.tier : null;
  // Sector is stored as the founder typed it (or left empty when it was
  // detected from the text), so filtering matches on the resolved sector id —
  // otherwise "SaaS" and "saas" would be two different markets.
  const sectorRaw = typeof req.query.sector === "string" ? req.query.sector.trim() : "";
  // safeResolveSector, not resolveSector: the shared table is indexed by string,
  // so a query for sector=constructor would otherwise resolve to an object that
  // is not a sector and put `undefined` into the SQL parameter.
  const sector = sectorRaw ? safeResolveSector(sectorRaw) : null;
  // Поиск по словам: инвестор ищет «логистика», «юристы», «подписка» — то есть
  // по тому, что написано в заявке, а не по нашим категориям. ILIKE по названию
  // и описанию; экранируем % и _, иначе запрос «100%» превратится в маску.
  const qRaw = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  const query = qRaw ? escapeLikePattern(qRaw) : "";
  const minScore = Number(req.query.minScore);
  const hasMinScore = Number.isFinite(minScore) && minScore > 0;
  // "score" ranks by the free assessment; anything else falls back to recency.
  const sort = req.query.sort === "score" ? "score" : "recent";

  try {
    if (isStartupExchangeDbReady()) {
      const args: unknown[] = [];
      let where = `WHERE ${PUBLIC_LISTING_SQL}`;
      if (tier) {
        args.push(tier);
        // Rows written before tiers existed carry the tier implied by `stage`;
        // the backfill sets it, and COALESCE keeps the filter correct even for a
        // row that slipped in between the ALTER and the UPDATE.
        where += ` AND COALESCE(tier, CASE WHEN stage='idea' THEN 'idea' WHEN stage='scaling' THEN 'product' ELSE 'mvp' END) = $${args.length}`;
      }
      if (sector) {
        args.push(sector.id);
        // The listing's own column may be empty or spelled differently; the
        // assessment always records the sector the score was actually computed
        // against, so that is what the filter reads.
        where += ` AND assessment->'sector'->>'id' = $${args.length}`;
      }
      if (query) {
        args.push(`%${query}%`);
        where += ` AND (title ILIKE $${args.length} ESCAPE '\\' OR description ILIKE $${args.length} ESCAPE '\\')`;
      }
      if (hasMinScore) {
        args.push(minScore);
        where += ` AND assessment_score >= $${args.length}`;
      }
      const order = sort === "score"
        ? `ORDER BY assessment_score DESC NULLS LAST, created_at DESC`
        : `ORDER BY created_at DESC`;

      const { rows } = await pool.query(
        `SELECT * FROM startup_ideas ${where} ${order} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
        [...args, limit, offset],
      );
      const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM startup_ideas ${where}`, args);
      const typedRows = rows as ListingRow[];
      return ok(res, {
        listings: typedRows.map((r) => publicView(r)),
        total: (cnt as Array<{ n: number }>)[0]?.n ?? typedRows.length,
        limit,
        offset,
      });
    }
  } catch (e) {
    if (isStartupExchangeDbReady()) return dbOutage(res, e, "GET /ideas");
    console.error("[StartupX] GET /ideas DB error", e);
  }

  let all = Array.from(memListings.values()).filter((r) => r.visibility === "public" && !isSmokeListing(r.title));
  if (tier) all = all.filter((r) => (isTier(r.tier) ? r.tier : tierFromLegacyStage(r.stage)) === tier);
  if (sector) all = all.filter((r) => r.assessment?.sector?.id === sector.id);
  if (qRaw) {
    const needle = qRaw.toLowerCase();
    all = all.filter(
      (r) => r.title.toLowerCase().includes(needle) || r.description.toLowerCase().includes(needle),
    );
  }
  if (hasMinScore) all = all.filter((r) => (r.assessment_score ?? -1) >= minScore);
  all.sort((a, b) =>
    sort === "score"
      ? (b.assessment_score ?? -1) - (a.assessment_score ?? -1) || b.created_at.localeCompare(a.created_at)
      : b.created_at.localeCompare(a.created_at),
  );
  return ok(res, {
    listings: all.slice(offset, offset + limit).map((r) => publicView(r)),
    total: all.length,
    limit,
    offset,
  });
});

/**
 * Показы страницы заявки.
 *
 * Считаем открытия, а не «уникальных посетителей»: проверить уникальность мы не
 * можем, и называть одно другим — ровно тот сорт цифры, которого биржа избегает
 * везде. Единственное, что делаем, — не даём одному и тому же адресу надувать
 * счётчик перезагрузками: одно открытие с адреса на заявку в час.
 */
const VIEW_WINDOW_MS = 60 * 60 * 1000;
const recentViews = new Map<string, number>();

function shouldCountView(listingId: number, req: Request): boolean {
  const key = `${listingId}:${requestIp(req)}`;
  const now = Date.now();
  const last = recentViews.get(key);
  if (last !== undefined && now - last < VIEW_WINDOW_MS) return false;
  recentViews.set(key, now);
  // Карта живёт в памяти процесса и не должна расти бесконечно: раз в N записей
  // выкидываем всё, что старше окна.
  if (recentViews.size > 5000) {
    for (const [k, t] of recentViews) if (now - t >= VIEW_WINDOW_MS) recentViews.delete(k);
  }
  return true;
}

// ─── GET /api/startupx/rss.xml ───────────────────────────────────────────────
//
// Подписка на биржу без аккаунта и без писем: инвестор кладёт ссылку в свою
// читалку и видит новые заявки сам. Это единственный канал доставки, который мы
// можем дать сегодня честно — почтовых рассылок у модуля нет, а обещать их,
// не имея, нельзя.
//
// Фильтры те же, что в ленте (`tier`, `sector`, `q`), поэтому подписаться можно
// на срез: «только идеи в логистике». В элемент кладём то, по чему инвестор
// принимает решение открывать или нет: уровень, условия сделки и балл разбора.
startupExchangeRouter.get("/rss.xml", async (req: Request, res: Response) => {
  const tier = isTier(req.query.tier) ? req.query.tier : null;
  const sectorRaw = typeof req.query.sector === "string" ? req.query.sector.trim() : "";
  const sector = sectorRaw ? safeResolveSector(sectorRaw) : null;
  const qRaw = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";

  let rows: ListingRow[] = [];
  try {
    if (isStartupExchangeDbReady()) {
      const args: unknown[] = [];
      let where = `WHERE ${PUBLIC_LISTING_SQL}`;
      if (tier) {
        args.push(tier);
        where += ` AND COALESCE(tier, 'idea') = $${args.length}`;
      }
      if (sector) {
        args.push(sector.id);
        where += ` AND assessment->'sector'->>'id' = $${args.length}`;
      }
      if (qRaw) {
        args.push(`%${escapeLikePattern(qRaw)}%`);
        where += ` AND (title ILIKE $${args.length} ESCAPE '\\' OR description ILIKE $${args.length} ESCAPE '\\')`;
      }
      const r = await pool.query(
        `SELECT * FROM startup_ideas ${where} ORDER BY created_at DESC LIMIT 50`,
        args,
      );
      rows = r.rows as ListingRow[];
    } else {
      rows = Array.from(memListings.values())
        .filter((l) => l.visibility === "public" && !isSmokeListing(l.title))
        .filter((l) => !tier || (isTier(l.tier) ? l.tier : tierFromLegacyStage(l.stage)) === tier)
        .filter((l) => !sector || l.assessment?.sector?.id === sector.id)
        .filter((l) => !qRaw || `${l.title} ${l.description}`.toLowerCase().includes(qRaw.toLowerCase()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 50);
    }
  } catch (e) {
    console.error("[StartupX] rss error", e);
    return res.status(500).send("rss_failed");
  }

  const esc = (v: string): string =>
    String(v ?? "").replace(/[<>&"']/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string,
    );
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app").replace(/\/+$/, "");

  const items = rows
    .map((row) => {
      const tierId = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
      const link = `${site}/startup-exchange/${row.id}`;
      const deal = row.deal;
      let terms = "условия не указаны";
      if (deal?.intent === "raise" && deal.askUsd && deal.equityOfferedPct) {
        terms = `$${fmtMoney(deal.askUsd)} за ${deal.equityOfferedPct}%`;
      } else if (deal?.intent === "sell_stake" && deal.stakePriceUsd && deal.stakeForSalePct) {
        terms = `${deal.stakeForSalePct}% за $${fmtMoney(deal.stakePriceUsd)}`;
      } else if (deal?.intent === "sell_full" && deal.askingPriceUsd) {
        terms = `продажа целиком — $${fmtMoney(deal.askingPriceUsd)}`;
      }
      const score = typeof row.assessment_score === "number" ? `${row.assessment_score}/100` : "без разбора";
      const summary =
        `${TIER_SPECS[tierId].label} · ${terms} · балл ${score}

` +
        `${(row.description || "").slice(0, 600)}`;
      return `    <item>
      <title>${esc(row.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${new Date(row.created_at).toUTCString()}</pubDate>
      <description>${esc(summary)}</description>
    </item>`;
    })
    .join("\n");

  const slice = [tier ? TIER_SPECS[tier].label : "", sector?.label ?? "", qRaw].filter(Boolean).join(" · ");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(slice ? `AEVION · биржа стартапов · ${slice}` : "AEVION · биржа стартапов")}</title>
    <link>${esc(`${site}/startup-exchange`)}</link>
    <description>${esc("Новые заявки: идея, MVP или готовый продукт — с условиями сделки и бесплатным разбором.")}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
${items}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  return res.send(xml);
});

// ─── GET /api/startupx/ideas/:id ─────────────────────────────────────────────
startupExchangeRouter.get("/ideas/:id", async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);

  try {
    if (isStartupExchangeDbReady()) {
      const { rows } = await pool.query(
        `SELECT * FROM startup_ideas WHERE id=$1 AND ${PUBLIC_LISTING_SQL}`,
        [id],
      );
      const row = (rows as ListingRow[])[0];
      if (!row) return fail(res, "not_found", 404);
      if (shouldCountView(id, req)) {
        // Счётчик не должен ронять выдачу заявки: если UPDATE не прошёл,
        // читатель всё равно получает страницу.
        pool.query(`UPDATE startup_ideas SET views = COALESCE(views, 0) + 1 WHERE id=$1`, [id])
          .catch((e: unknown) => console.error("[StartupX] view counter", e));
        row.views = (row.views ?? 0) + 1;
      }
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM startup_interests WHERE idea_id=$1`,
        [id],
      );
      return ok(res, publicView(row, (cnt as Array<{ n: number }>)[0]?.n ?? 0));
    }
  } catch (e) {
    if (isStartupExchangeDbReady()) return dbOutage(res, e, "GET /ideas/:id");
    console.error("[StartupX] GET /ideas/:id DB error", e);
  }

  const row = memListings.get(id);
  if (!row || row.visibility !== "public") return fail(res, "not_found", 404);
  if (shouldCountView(id, req)) row.views = (row.views ?? 0) + 1;
  const interest_count = Array.from(memInterests.values()).filter((i) => i.idea_id === id).length;
  return ok(res, publicView(row, interest_count));
});

// ─── POST /api/startupx/assess ───────────────────────────────────────────────
// Free analysis of a draft, before anything is published. This is the front door
// of the exchange: describe it, see what an investor will see, then decide
// whether to list. Nothing is stored.
startupExchangeRouter.post("/assess", assessLimiter, (req: Request, res: Response) => {
  const { listing, issues } = normalizeListing(req.body, { requireDeal: false });
  if (!listing) return fail(res, "validation_failed", 400, { issues });
  try {
    return ok(res, { assessment: assessListing(listing), stored: false });
  } catch (e) {
    captureStartupXError(e);
    console.error("[StartupX] POST /assess failed", e);
    return fail(res, "assessment_failed", 500);
  }
});

// ─── POST /api/startupx/ideas ────────────────────────────────────────────────
startupExchangeRouter.post("/ideas", publishGate, postLimiter, async (req: Request, res: Response) => {
  const ip = requestIp(req);
  const { listing, issues } = normalizeListing(req.body);
  if (!listing) return fail(res, "validation_failed", 400, { issues });

  let assessment: Assessment;
  try {
    assessment = assessListing(listing);
  } catch (e) {
    captureStartupXError(e);
    console.error("[StartupX] assessment failed on submit", e);
    return fail(res, "assessment_failed", 500);
  }

  const contentHash = computeContentHash({
    title: listing.title,
    description: listing.description,
    tier: listing.tier,
  });
  const stage = legacyStageForTier(listing.tier);
  // qright_object_id is reserved for a direct QRight registry link; the hash is
  // produced here and is what makes `qright_protected` true.
  const qrightObjectId: string | null = null;
  const manage = mintManageToken();

  // Путей записи два — Postgres и память, — а учёт квоты должен быть один:
  // списываем ровно там, где заявка действительно появилась в ленте.
  /** Есть ли запись в реестре QRight. Сегодня — никогда. */
  const qrightRegistered = qrightObjectId !== null;
  /** Что фактически сделано с идеей. */
  const protection = "content-hash" as const;

  const created = (row: ListingRow, storage: "db" | "memory" = "db") => {
    const left = publishQuota.check(ip);
    res.setHeader("X-Publish-Quota-Remaining", String(left.remaining));
    return ok(res, {
      id: row.id,
      qrightProtected: true,
      // ЧЕСТНОСТЬ ЗАЯВЛЕНИЯ — перенесено из ветки запуска, не терять.
      // Хеш считается и хранится у нас; записи в реестре QRight НЕ
      // происходит (qright_object_id всегда null). Историческое поле
      // qrightProtected означает «хеш посчитан», а витрина рисовала по нему
      // «зарегистрировано». Два поля ниже дают сказать правду.
      /** Есть ли запись в реестре QRight. Сегодня — никогда. */
      qrightRegistered,
      protection,
      contentHash: row.content_hash,
      // Shown to the founder once. Losing it means losing access to the
      // offers on this listing — the UI has to say so at the moment it is
      // handed over, not in a help page.
      manageToken: manage.token,
      listing: publicView(row),
      assessment,
      // Какой путь записи сработал: запасной не переживёт перезапуск.
      storage,
    }, 201);
  };

  try {
    if (isStartupExchangeDbReady()) {
      const { rows } = await pool.query(
        `INSERT INTO startup_ideas
         (title, description, stage, tier, sector, geography, demo_url, repo_url,
          deal, metrics, assessment, assessment_score, assessment_version,
          founder_email, contact_method, qright_object_id, content_hash, manage_token_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          listing.title, listing.description, stage, listing.tier,
          listing.sector ?? null, listing.geography ?? null,
          listing.demoUrl ?? null, listing.repoUrl ?? null,
          JSON.stringify(listing.deal), JSON.stringify(listing.metrics ?? {}),
          JSON.stringify(assessment), assessment.score, assessment.version,
          listing.founderEmail ?? null, listing.contactMethod ?? null,
          qrightObjectId, contentHash, manage.hash,
        ],
      );
      return created((rows as ListingRow[])[0]);
    }
  } catch (e) {
    if (isStartupExchangeDbReady()) return dbOutage(res, e, "POST /ideas");
    captureStartupXError(e);
    console.error("[StartupX] POST /ideas DB error", e);
  }

  const row = memInsertListing({
    title: listing.title,
    description: listing.description,
    stage,
    tier: listing.tier,
    sector: listing.sector ?? null,
    geography: listing.geography ?? null,
    demo_url: listing.demoUrl ?? null,
    repo_url: listing.repoUrl ?? null,
    deal: listing.deal,
    metrics: listing.metrics ?? null,
    assessment,
    assessment_score: assessment.score,
    assessment_version: assessment.version,
    founder_email: listing.founderEmail ?? null,
    contact_method: listing.contactMethod ?? null,
    qright_object_id: qrightObjectId,
    content_hash: contentHash,
    manage_token_hash: manage.hash,
    views: 0,
    removed_reason: null,
    removed_at: null,
    visibility: "public",
  });
  return created(row, "memory");
});

// ─── POST /api/startupx/ideas/:id/reassess ───────────────────────────────────
// Re-runs the free assessment against the current rules. A stored score belongs
// to the rules that produced it: when ASSESSMENT_VERSION moves, old listings are
// stale rather than wrong, and the feed must not silently rank the two together.
startupExchangeRouter.post("/ideas/:id/reassess", assessLimiter, async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1 AND ${PUBLIC_LISTING_SQL}`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] reassess fetch error", e);
    }
  } else {
    row = memListings.get(id);
    if (row?.visibility !== "public") row = undefined;
  }
  if (!row) return fail(res, "not_found", 404);

  const tier = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
  const rebuilt: ListingInput = {
    title: row.title,
    description: row.description,
    tier,
    sector: row.sector ?? undefined,
    geography: row.geography ?? undefined,
    demoUrl: row.demo_url ?? undefined,
    repoUrl: row.repo_url ?? undefined,
    // Pre-tier rows have no deal terms at all. They get assessed as a raise with
    // unstated numbers, which is exactly what they are — the deal factor then
    // reports "условия не позволяют посчитать оценку" instead of inventing one.
    deal: row.deal ?? { intent: "raise" },
    metrics: row.metrics ?? undefined,
  };

  let assessment: Assessment;
  try {
    assessment = assessListing(rebuilt);
  } catch (e) {
    captureStartupXError(e);
    return fail(res, "assessment_failed", 500);
  }

  if (isStartupExchangeDbReady()) {
    try {
      await pool.query(
        `UPDATE startup_ideas SET assessment=$1, assessment_score=$2, assessment_version=$3 WHERE id=$4`,
        [JSON.stringify(assessment), assessment.score, assessment.version, id],
      );
    } catch (e) {
      console.error("[StartupX] reassess save error", e);
    }
  } else {
    const existing = memListings.get(id);
    if (existing) {
      existing.assessment = assessment;
      existing.assessment_score = assessment.score;
      existing.assessment_version = assessment.version;
    }
  }
  return ok(res, { id, assessment });
});

// ─── POST /api/startupx/ideas/:id/interest ──────────────────────────────────
startupExchangeRouter.post("/ideas/:id/interest", postLimiter, async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);

  const investorEmail = clampStr(req.body?.investorEmail, MAX_EMAIL);
  const message = clampStr(req.body?.message, MAX_MESSAGE);
  if (!investorEmail) return fail(res, "investorEmail_required");
  // Отклик без рабочего адреса — тупик: основатель видит условия и не может
  // ответить. Проверка нарочно нестрогая, её задача — отсечь «напишите мне»
  // в поле почты, а не спорить с RFC.
  if (!looksLikeEmail(investorEmail)) {
    return fail(res, "investorEmail_invalid", 400, {
      issues: [{ field: "investorEmail", message: "Похоже, это не email — основатель не сможет ответить" }],
    });
  }

  const rawIntent = req.body?.intent;
  const intent: DealIntent | null =
    typeof rawIntent === "string" && (DEAL_INTENTS as readonly string[]).includes(rawIntent)
      ? (rawIntent as DealIntent)
      : null;
  const ticketRaw = Number(req.body?.ticketUsd);
  const ticketUsd = Number.isFinite(ticketRaw) && ticketRaw > 0 ? Math.min(ticketRaw, 1_000_000_000) : null;
  const equityRaw = Number(req.body?.equityPct);
  const equityPct = Number.isFinite(equityRaw) && equityRaw > 0 && equityRaw <= 100 ? equityRaw : null;

  // Путей записи два — письмо основателю должно уходить с обоих, иначе на
  // in-memory окружении отклик снова тихо ложится в таблицу и никто не узнает.
  const notifyOffer = (founderEmail: string | null, listingId: number, listingTitle: string) => {
    if (!founderEmail) return;
    sendOfferNotice({ founderEmail, listingId, listingTitle, ticketUsd, equityPct, intent });
  };

  try {
    if (isStartupExchangeDbReady()) {
      const { rows: exists } = await pool.query(
        `SELECT id, title, founder_email FROM startup_ideas WHERE id=$1 AND ${PUBLIC_LISTING_SQL}`,
        [id],
      );
      const target = (exists as Array<{ id: number; title: string; founder_email: string | null }>)[0];
      if (!target) return fail(res, "idea_not_found", 404);

      const { rows } = await pool.query(
        `INSERT INTO startup_interests (idea_id, investor_email, message, intent, ticket_usd, equity_pct)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, investorEmail, message, intent, ticketUsd, equityPct],
      );
      const row = (rows as InterestRow[])[0];
      notifyOffer(target.founder_email, id, target.title);
      return ok(res, { id: row.id, ideaId: row.idea_id, intent: row.intent, createdAt: row.created_at }, 201);
    }
  } catch (e) {
    if (isStartupExchangeDbReady()) return dbOutage(res, e, "POST /ideas/:id/interest");
    captureStartupXError(e);
    console.error("[StartupX] POST /ideas/:id/interest DB error", e);
  }

  const listing = memListings.get(id);
  if (!listing || listing.visibility !== "public") return fail(res, "idea_not_found", 404);
  const row = memInsertInterest({
    idea_id: id,
    investor_email: investorEmail,
    message,
    intent,
    ticket_usd: ticketUsd,
    equity_pct: equityPct,
  });
  notifyOffer(listing.founder_email, id, listing.title);
  return ok(res, { id: row.id, ideaId: row.idea_id, intent: row.intent, createdAt: row.created_at }, 201);
});

// ─── GET /api/startupx/ideas/:id/offers?token= ───────────────────────────────
// The founder's side of the exchange. Investors send terms; without this the
// rows sat in a table nobody could read and the whole flow dead-ended at
// "заявка отправлена".
startupExchangeRouter.get("/ideas/:id/offers", offersLimiter, async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] offers fetch error", e);
      return fail(res, "offers_unavailable", 500);
    }
  } else {
    row = memListings.get(id);
  }
  if (!row) return fail(res, "not_found", 404);

  if (!manageTokenMatches(req.query.token, row.manage_token_hash)) {
    // Deliberately the same answer for a wrong token and for a listing published
    // before manage tokens existed: neither can be opened, and saying which is
    // which only helps someone guessing.
    return fail(res, "invalid_token", 401);
  }

  let offers: InterestRow[] = [];
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM startup_interests WHERE idea_id=$1 ORDER BY created_at DESC LIMIT 200`,
        [id],
      );
      offers = rows as InterestRow[];
    } catch (e) {
      console.error("[StartupX] offers list error", e);
      return fail(res, "offers_unavailable", 500);
    }
  } else {
    offers = Array.from(memInterests.values())
      .filter((i) => i.idea_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return ok(res, {
    listing: publicView(row, offers.length),
    offers: offers.map((o) => ({
      id: o.id,
      investorEmail: o.investor_email,
      message: o.message,
      intent: o.intent,
      ticketUsd: o.ticket_usd === null ? null : Number(o.ticket_usd),
      equityPct: o.equity_pct === null ? null : Number(o.equity_pct),
      createdAt: o.created_at,
    })),
  });
});

// ─── PATCH /api/startupx/ideas/:id?token= ────────────────────────────────────
// Correcting the terms.
//
// The free analysis tells a founder their ask is 2.7× above what the market
// closes at. The obvious next move is to change the number — and until now the
// only way was to withdraw and republish, which minted a new listing and left
// the offers behind. We created that dead end by shipping the critique without
// the fix.
//
// Only the deal, the metrics and the links can be edited. Title, description
// and tier are frozen: the SHA-256 stamp covers exactly that text on exactly
// that date, and an authorship stamp that silently follows edits is worth
// nothing. Changing the pitch itself means publishing a new listing.
startupExchangeRouter.patch("/ideas/:id", offersLimiter, async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = req.query.token ?? body.token;

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] patch fetch error", e);
      return fail(res, "update_failed", 500);
    }
  } else {
    row = memListings.get(id);
  }
  if (!row) return fail(res, "not_found", 404);
  if (!manageTokenMatches(token, row.manage_token_hash)) return fail(res, "invalid_token", 401);

  const tier = isTier(row.tier) ? row.tier : tierFromLegacyStage(row.stage);
  // Re-validated as a whole listing, so an edited deal has to satisfy exactly
  // the same rules a new one does — an edit cannot smuggle in terms that would
  // have been refused at publish time.
  const { listing, issues } = normalizeListing({
    title: row.title,
    description: row.description,
    tier,
    sector: row.sector ?? undefined,
    geography: body.geography ?? row.geography ?? undefined,
    demoUrl: body.demoUrl ?? row.demo_url ?? undefined,
    repoUrl: body.repoUrl ?? row.repo_url ?? undefined,
    deal: body.deal ?? row.deal ?? {},
    metrics: body.metrics ?? row.metrics ?? {},
    contactMethod: body.contactMethod ?? row.contact_method ?? undefined,
  });
  if (!listing) return fail(res, "validation_failed", 400, { issues });

  let assessment: Assessment;
  try {
    assessment = assessListing(listing);
  } catch (e) {
    captureStartupXError(e);
    return fail(res, "assessment_failed", 500);
  }

  // Withdrawal was one-way: a founder who took the listing down by mistake had
  // to publish a new one, with a new id, a new stamp and none of the offers.
  // Nothing about that had to be irreversible.
  // Возврат — право основателя на СВОЁ снятие. Снятое оператором возвращать
  // нельзя, иначе кнопка «вернуть заявку» отменяла бы модерацию: снятый за
  // мусор вернул бы себя сам.
  const restore = body.restore === true && row.visibility !== "removed";
  const nextVisibility = restore ? "public" : row.visibility;

  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(
        `UPDATE startup_ideas
            SET deal=$1, metrics=$2, geography=$3, demo_url=$4, repo_url=$5,
                contact_method=$6, assessment=$7, assessment_score=$8, assessment_version=$9,
                visibility=$11
          WHERE id=$10
      RETURNING *`,
        [
          JSON.stringify(listing.deal), JSON.stringify(listing.metrics ?? {}),
          listing.geography ?? null, listing.demoUrl ?? null, listing.repoUrl ?? null,
          listing.contactMethod ?? null,
          JSON.stringify(assessment), assessment.score, assessment.version,
          id, nextVisibility,
        ],
      );
      const updated = (rows as ListingRow[])[0];
      return ok(res, { listing: publicView(updated), assessment });
    } catch (e) {
      captureStartupXError(e);
      console.error("[StartupX] patch save error", e);
      return fail(res, "update_failed", 500);
    }
  }

  const existing = memListings.get(id);
  if (!existing) return fail(res, "not_found", 404);
  existing.deal = listing.deal;
  existing.metrics = listing.metrics ?? null;
  existing.geography = listing.geography ?? null;
  existing.demo_url = listing.demoUrl ?? null;
  existing.repo_url = listing.repoUrl ?? null;
  existing.contact_method = listing.contactMethod ?? null;
  existing.assessment = assessment;
  existing.assessment_score = assessment.score;
  existing.assessment_version = assessment.version;
  existing.visibility = nextVisibility;
  return ok(res, { listing: publicView(existing), assessment });
});

// ─── DELETE /api/startupx/ideas/:id?token= ───────────────────────────────────
// Withdrawing a listing. A founder who found their investor — or thought better
// of publishing — must be able to take the listing down without writing to
// anyone, and the daily smoke uses the same door to clean up after itself
// instead of leaving another row in the public feed every night.
//
// The row is kept and marked withdrawn rather than deleted: the offers already
// received belong to the founder, and the SHA-256 authorship stamp is worth
// nothing if the record behind it can vanish.
startupExchangeRouter.delete("/ideas/:id", offersLimiter, async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);
  const token = req.query.token ?? (req.body as Record<string, unknown> | undefined)?.token;

  let row: ListingRow | undefined;
  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM startup_ideas WHERE id=$1`, [id]);
      row = (rows as ListingRow[])[0];
    } catch (e) {
      console.error("[StartupX] withdraw fetch error", e);
      return fail(res, "withdraw_failed", 500);
    }
  } else {
    row = memListings.get(id);
  }
  if (!row) return fail(res, "not_found", 404);
  if (!manageTokenMatches(token, row.manage_token_hash)) return fail(res, "invalid_token", 401);

  if (isStartupExchangeDbReady()) {
    try {
      await pool.query(`UPDATE startup_ideas SET visibility='withdrawn' WHERE id=$1`, [id]);
    } catch (e) {
      console.error("[StartupX] withdraw save error", e);
      return fail(res, "withdraw_failed", 500);
    }
  } else {
    const existing = memListings.get(id);
    if (existing) existing.visibility = "withdrawn";
  }
  return ok(res, { id, visibility: "withdrawn" });
});

// ─── POST /api/startupx/ideas/:id/report ─────────────────────────────────────
//
// Жалоба посетителя. Без неё модерация слепа: оператор снимает только то, что
// случайно увидел сам, а видит он ничтожную долю ленты. Жалоба ничего не
// скрывает автоматически — она лишь показывает оператору, куда смотреть.
const REPORT_REASONS = ["spam", "scam", "stolen", "illegal", "other"] as const;

startupExchangeRouter.post("/ideas/:id/report", reportLimiter, async (req: Request, res: Response) => {
  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);
  const reasonRaw = req.body?.reason;
  const reason = typeof reasonRaw === "string" && (REPORT_REASONS as readonly string[]).includes(reasonRaw)
    ? reasonRaw
    : null;
  if (!reason) {
    return fail(res, "reason_invalid", 400, {
      issues: [{ field: "reason", message: `Причина: ${REPORT_REASONS.join(", ")}` }],
    });
  }
  const note = clampStr(req.body?.note, 1000);
  // Хэш адреса, не сам адрес: для «одна жалоба с адреса» этого достаточно, а
  // хранить IP жалующегося незачем.
  const reporterHash = crypto.createHash("sha256").update(`startupx:${requestIp(req)}`).digest("hex").slice(0, 32);

  if (isStartupExchangeDbReady()) {
    try {
      const { rows: exists } = await pool.query(`SELECT id FROM startup_ideas WHERE id=$1`, [id]);
      if (!(exists as Array<{ id: number }>)[0]) return fail(res, "not_found", 404);
      await pool.query(
        `INSERT INTO startup_reports (idea_id, reason, note, reporter_hash)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (idea_id, reporter_hash) DO NOTHING`,
        [id, reason, note, reporterHash],
      );
    } catch (e) {
      captureStartupXError(e);
      return fail(res, "report_failed", 500);
    }
  } else {
    if (!memListings.has(id)) return fail(res, "not_found", 404);
    const key = `${id}:${reporterHash}`;
    if (!memReports.has(key)) memReports.set(key, { idea_id: id, reason, note, at: new Date().toISOString() });
  }
  // Ответ одинаковый и для новой жалобы, и для повторной: сообщать «вы уже
  // жаловались» незачем, а подтверждать приём — нужно.
  return ok(res, { received: true });
});

// ─── GET /api/startupx/reports ───────────────────────────────────────────────
// Очередь модерации: что смотреть в первую очередь. Только для оператора.
startupExchangeRouter.get("/reports", offersLimiter, async (req: Request, res: Response) => {
  if (!isStartupXAdmin(verifyBearer(req))) return fail(res, "forbidden", 403);

  if (isStartupExchangeDbReady()) {
    try {
      const { rows } = await pool.query(
        `SELECT r.idea_id, i.title, i.visibility, COUNT(*)::int AS reports,
                MAX(r.created_at) AS last_at,
                ARRAY_AGG(DISTINCT r.reason) AS reasons
           FROM startup_reports r
           JOIN startup_ideas i ON i.id = r.idea_id
          GROUP BY r.idea_id, i.title, i.visibility
          ORDER BY reports DESC, last_at DESC
          LIMIT 100`,
      );
      return ok(res, { queue: rows });
    } catch (e) {
      captureStartupXError(e);
      return fail(res, "reports_failed", 500);
    }
  }
  const byIdea = new Map<number, { idea_id: number; reasons: Set<string>; reports: number }>();
  for (const r of memReports.values()) {
    const cur = byIdea.get(r.idea_id) ?? { idea_id: r.idea_id, reasons: new Set<string>(), reports: 0 };
    cur.reports += 1;
    cur.reasons.add(r.reason);
    byIdea.set(r.idea_id, cur);
  }
  return ok(res, {
    queue: Array.from(byIdea.values())
      .map((r) => ({
        idea_id: r.idea_id,
        title: memListings.get(r.idea_id)?.title ?? "",
        visibility: memListings.get(r.idea_id)?.visibility ?? "",
        reports: r.reports,
        reasons: Array.from(r.reasons),
      }))
      .sort((a, b) => b.reports - a.reports),
  });
});

// ─── POST /api/startupx/ideas/:id/takedown ───────────────────────────────────
//
// Снятие заявки оператором площадки. До этого снять чужую заявку было нельзя
// вообще: единственная кнопка принадлежала основателю, а публиковать может кто
// угодно. Для публичной витрины это риск запуска, а не гигиена.
//
// Заявка не удаляется, а помечается снятой с ПРИЧИНОЙ, и причина видна
// основателю в его кабинете: контент, исчезающий без объяснения, — то, за что
// площадки справедливо ругают.
startupExchangeRouter.post("/ideas/:id/takedown", postLimiter, async (req: Request, res: Response) => {
  const auth = verifyBearer(req);
  if (!isStartupXAdmin(auth)) return fail(res, "forbidden", 403);

  // pgIntId, а не Number: 1e20 — целое по меркам JS, проверку
  // `Number.isInteger` оно проходит и уезжает в SQL, где Postgres отвечает
  // выходом за диапазон. Снаружи это 404 вместо 400 — «не найдено» вместо
  // «плохой запрос», и настоящая причина теряется.
  const id = pgIntId(req.params.id);
  if (id === null) return fail(res, "invalid_id", 400);
  const reason = clampStr(req.body?.reason, 500);
  if (!reason) {
    return fail(res, "reason_required", 400, {
      issues: [{ field: "reason", message: "Причина обязательна — основатель увидит именно её" }],
    });
  }

  const at = new Date().toISOString();
  if (isStartupExchangeDbReady()) {
    try {
      const { rowCount } = await pool.query(
        `UPDATE startup_ideas SET visibility='removed', removed_reason=$1, removed_at=$2 WHERE id=$3`,
        [reason, at, id],
      );
      if (!rowCount) return fail(res, "not_found", 404);
    } catch (e) {
      captureStartupXError(e);
      return fail(res, "takedown_failed", 500);
    }
  } else {
    const row = memListings.get(id);
    if (!row) return fail(res, "not_found", 404);
    row.visibility = "removed";
    row.removed_reason = reason;
    row.removed_at = at;
  }

  console.warn(`[StartupX] takedown id=${id} by=${auth?.email ?? auth?.sub ?? "admin"} reason=${reason}`);
  return ok(res, { id, visibility: "removed", reason, at });
});

// ── MVP concept board surface ───────────────────────────────────────────────

startupExchangeRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    module: "startupx",
    code: "STARTUPX",
    status: "mvp",
    description:
      "Startup exchange: idea / idea+MVP / working product, each with its own deal terms and a free deterministic assessment.",
    endpoints: {
      tiers: "/api/startupx/tiers",
      listings: "/api/startupx/ideas",
      assess: "/api/startupx/assess",
      stats: "/api/startupx/stats",
      conceptMessages: "/api/startupx/concept/messages",
      conceptStats: "/api/startupx/concept-stats",
    },
    timestamp: new Date().toISOString(),
  });
});

mountConceptBoard({ router: startupExchangeRouter, moduleId: "startupx", defaultTag: "startupx", writeLimit: postLimiter });

// ──────────────────── Оценка идеи моделью ────────────────────
// Перенесено из ветки запуска при сведении 30.08.2026: у ветки биржи
// этой ручки нет — она появилась позже. Имена типов приведены
// к здешним (ListingRow, memListings). Лимит жёсткий намеренно — вызов платный.
const aiScoreLimiter = rateLimit({ windowMs: 60_000, max: 3, keyPrefix: "startupx:aiscore", message: "rate_limited" });

interface AiScore {
  problem: number;
  market: number;
  uniqueness: number;
  stage: number;
  potential: number;
  summary: string;
}



// ─── POST /api/startupx/ideas/:id/ai-score ───────────────────────────────────
// Rate: 3/min (LLM is expensive). Gracefully degrades if AI unavailable.
// Lazy-bootstraps ai_score column on first call (ADD COLUMN IF NOT EXISTS).

let aiScoreColEnsured = false;

async function ensureAiScoreColumn(): Promise<void> {
  if (aiScoreColEnsured) return;
  try {
    await pool.query(
      `ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS ai_score JSONB`,
    );
    await pool.query(
      `ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ`,
    );
    aiScoreColEnsured = true;
  } catch {
    // Non-fatal — pool may be transiently unavailable. Do NOT latch the flag:
    // leave it false so the next call retries once Postgres recovers.
  }
}

function parseAiScore(text: string): AiScore | null {
  try {
    // Extract JSON object from the reply (model may wrap it in markdown fences).
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const num = (k: string): number => {
      const v = Number(parsed[k]);
      return Number.isFinite(v) ? Math.min(10, Math.max(0, v)) : 0;
    };
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "";
    return {
      problem: num("problem"),
      market: num("market"),
      uniqueness: num("uniqueness"),
      stage: num("stage"),
      potential: num("potential"),
      summary,
    };
  } catch {
    return null;
  }
}

startupExchangeRouter.post(
  "/ideas/:id/ai-score",
  aiScoreLimiter,
  async (req: Request, res: Response) => {
    const id = pgIntId(req.params.id);
    if (id === null) return fail(res, "invalid_id", 400);

    // ── Fetch the idea ────────────────────────────────────────────────────────
    let idea: ListingRow | undefined;

    if (isStartupExchangeDbReady()) {
      try {
        await ensureAiScoreColumn();
        const { rows } = await pool.query(
          `SELECT * FROM startup_ideas WHERE id=$1 AND ${PUBLIC_LISTING_SQL}`,
          [id],
        );
        idea = (rows as ListingRow[])[0];
      } catch (e) {
        console.error("[StartupX] POST /ideas/:id/ai-score DB fetch error", e);
      }
    } else {
      idea = memListings.get(id);
      if (idea?.visibility !== "public") idea = undefined;
    }

    if (!idea) return fail(res, "not_found", 404);

    // ── Call QCoreAI ─────────────────────────────────────────────────────────
    const providerId = pickConfiguredProvider();
    const configured = getProviders().find((p) => p.id === providerId)?.configured ?? false;

    if (!configured || providerId === "stub") {
      return res.status(200).json({
        success: true,
        data: { id, aiScore: null, error: "ai_unavailable" },
      });
    }

    const provider = getProviders().find((p) => p.id === providerId)!;
    const model = provider.defaultModel;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Ты — эксперт по стартапам и венчурным инвестициям. Оцени стартап-идею по 5 критериям.",
      },
      {
        role: "user",
        content:
          `Название: ${idea.title}\nОписание: ${idea.description}\nСтадия: ${idea.stage}\n\n` +
          `Оцени по шкале 0-10: 1) Проблема 2) Рынок 3) Уникальность 4) Стадия 5) Потенциал. ` +
          `Ответь ТОЛЬКО JSON: {"problem":N,"market":N,"uniqueness":N,"stage":N,"potential":N,"summary":"1-2 предложения"}`,
      },
    ];

    let aiScore: AiScore | null = null;
    const scoredAt = new Date().toISOString();

    try {
      const result = await callProvider(providerId, messages, model, 0.3);
      aiScore = parseAiScore(result.reply);
    } catch (e) {
      console.error("[StartupX] QCoreAI call failed", e);
      return res.status(200).json({
        success: true,
        data: { id, aiScore: null, error: "ai_unavailable" },
      });
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    // Only mark the idea "scored" when parsing actually produced a score.
    // A parse failure (aiScore === null) must NOT stamp ai_scored_at.
    if (!aiScore) {
      return res.status(200).json({
        success: true,
        data: { id, aiScore: null, error: "ai_parse_failed" },
      });
    }

    if (isStartupExchangeDbReady()) {
      try {
        await pool.query(
          `UPDATE startup_ideas SET ai_score=$1, ai_scored_at=$2 WHERE id=$3`,
          [JSON.stringify(aiScore), scoredAt, id],
        );
      } catch (e) {
        console.error("[StartupX] POST /ideas/:id/ai-score DB save error", e);
      }
    } else {
      const existing = memListings.get(id);
      if (existing) {
        existing.ai_score = aiScore;
        existing.ai_scored_at = scoredAt;
      }
    }

    return ok(res, { id, aiScore, scoredAt });
  },
);
