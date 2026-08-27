import { Router, type Request, type Response } from "express";
// Обычный импорт, а не require: под `require` подмена драйвера в тестах не
// действует — тест «зеленеет», не выполнив ни одного запроса. Та же правка
// уже сделана в cyberchessMatchStore.ts (12.08); esModuleInterop включён,
// поэтому под CommonJS это тот же объект модуля.
import pg from "pg";
import { makeServiceCapture } from "../lib/sentry/platform";

const captureCyberChessError = makeServiceCapture("cyberchess");
import { randomUUID } from "node:crypto";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import {
  loadTournaments,
  markTournamentFinalized,
  saveTournament,
  type Tournament,
} from "../lib/ecosystemStore";
import { paginate, parsePageOpts } from "../lib/pagination";
import { verifyWebhookSig } from "../lib/webhookSig";
import { requireProdSecret } from "../lib/qsignSecret";
import {
  chessPrizes,
  ensureEcosystemLoaded,
  scheduleEcosystemPersist,
  type ChessPrize,
} from "./ecosystem";
import { internalCreditAccount } from "./qtrade";

function sendCsv(res: Response, baseName: string, rows: (string | number | null | undefined)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csvFromRows(rows));
}

// /api/cyberchess/* — three test-mode endpoints the bank UI reads to render
// ChessWinnings live instead of mocked. In production these will be proxied
// to the chess service; for now they're an in-memory ledger fed by an
// auth'd webhook (`/tournament-finalized`).
export const cyberchessRouter = Router();

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

// Read-only endpoints — auth required, scoped to caller.
cyberchessRouter.get("/results", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = chessPrizes
    .filter((x) => x.email === email)
    .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
  const { page, nextCursor } = paginate(items, parsePageOpts(req));
  res.json({ items: page, total: items.length, nextCursor });
});

cyberchessRouter.get("/results.csv", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = chessPrizes
    .filter((x) => x.email === email)
    .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
  const rows: (string | number | null | undefined)[][] = [
    ["id", "tournament_id", "place", "amount_aec", "finalized_at", "transfer_id"],
    ...items.map((x) => [x.id, x.tournamentId, x.place, x.amount, x.finalizedAt, x.transferId]),
  ];
  sendCsv(res, "cyberchess-results", rows);
});

// Demo tournaments seeded once at first read when the store is empty,
// so the UI always has something visible without forcing partners to
// pre-populate. Persistence lives in ecosystemStore (Postgres or JSON
// file) — survives restarts and webhook-driven status changes.
//
// СМЕЩЕНИЕ, А НЕ ДАТА. Раньше `startsAt` считался как `Date.now() + 24ч`
// ПРЯМО ЗДЕСЬ, то есть один раз при загрузке модуля, и уезжал в постоянное
// хранилище. `ensureDemoSeed` второй раз не срабатывает (записи уже есть),
// поэтому дата застывала навсегда. Замер на проде 27.08.2026: ручка с именем
// `/upcoming` отдавала два турнира со статусом `upcoming` и датами старта
// **4 и 6 мая** — три с половиной месяца назад. Со временем расхождение
// только росло, и починить его перезапуском было нельзя.
const DEMO_SEED: { offsetMs: number; t: Omit<Tournament, "startsAt"> }[] = [
  {
    offsetMs: 24 * 3600_000,
    t: {
      id: "tour_demo_swiss_001",
      format: "Swiss · 3+2 · 7 rounds",
      prizePool: 250,
      entries: 32,
      capacity: 64,
      status: "upcoming",
    },
  },
  {
    offsetMs: 3 * 24 * 3600_000,
    t: {
      id: "tour_demo_arena_002",
      format: "Arena · 1+0 · 60 min",
      prizePool: 100,
      entries: 14,
      capacity: 100,
      status: "upcoming",
    },
  },
];

function seedNow(): Tournament[] {
  const now = Date.now();
  return DEMO_SEED.map(({ offsetMs, t }) => ({ ...t, startsAt: new Date(now + offsetMs).toISOString() }));
}

/**
 * Отдаёт турниры, попутно освежая дату протухшим ОБРАЗЦАМ.
 *
 * Флага «уже сделано» здесь намеренно НЕТ. Он был, и это был второй дефект того
 * же класса: образец освежается на сутки вперёд, значит через трое суток он
 * протухает снова — а одноразовый флаг больше не пускает починку, и на
 * долгоживущем процессе ручка опять начинает врать. Проверка стоит дёшево:
 * хранилище читается для ответа всё равно, а запись случается не чаще раза в
 * сутки на образец.
 */
async function loadWithFreshDemos(): Promise<Tournament[]> {
  const existing = await loadTournaments();
  if (existing.length === 0) {
    const seeded = seedNow();
    for (const t of seeded) await saveTournament(t);
    return seeded;
  }
  // Протухшему ОБРАЗЦУ дату обновляем: он для того и заведён, чтобы показывать,
  // как раздел выглядит. Настоящему турниру дату НЕ трогаем ни при каких
  // условиях — это была бы подделка расписания, а не починка витрины.
  // ЕДИНСТВЕННЫЙ сторож здесь — поиск по этой карте: она построена из
  // `DEMO_SEED`, поэтому настоящий турнир в ней не найдётся никогда. Отдельная
  // проверка «это образец?» в условии ниже СТОЯЛА и была снята: мутационная
  // проверка показала, что её удаление ничего не меняет, то есть она была
  // декоративной. Две защиты от одного, из которых работает одна, хуже одной:
  // читатель верит обеим.
  const fresh = new Map(seedNow().map((t) => [t.id, t]));
  const now = Date.now();
  const out: Tournament[] = [];
  for (const t of existing) {
    const at = Date.parse(t.startsAt);
    const stale = !Number.isFinite(at) || at <= now;
    const replacement = t.status === "upcoming" && stale ? fresh.get(t.id) : undefined;
    if (!replacement) {
      out.push(t);
      continue;
    }
    const updated = { ...t, startsAt: replacement.startsAt };
    await saveTournament(updated);
    out.push(updated);
  }
  return out;
}

/**
 * Прошедшее не показывается как предстоящее.
 *
 * Ручка называется `/upcoming`, и это обещание: событие, чьё время старта уже
 * прошло, «предстоящим» быть не может. Статус в хранилище узкий
 * (`upcoming | finalized`), поэтому переименовать состояние нельзя — такой
 * элемент просто не попадает в ответ.
 *
 * Неразбираемая дата — это «не знаю», а не «предстоит»: такой элемент тоже не
 * выдаём, но МОЛЧА этого не делаем (иначе элемент исчезает бесследно).
 */
export function keepOnlyStillUpcoming(items: Tournament[], now = Date.now()): Tournament[] {
  return items.filter((t) => {
    if (t.status !== "upcoming") return true;
    const at = Date.parse(t.startsAt);
    if (!Number.isFinite(at)) {
      console.warn("[CyberChess] турнир с неразбираемой датой старта скрыт из /upcoming:", t.id, t.startsAt);
      return false;
    }
    return at > now;
  });
}

cyberchessRouter.get("/upcoming", async (_req, res) => {
  try {
    const items = keepOnlyStillUpcoming(await loadWithFreshDemos());
    res.json({ items });
  } catch (err: any) {
    captureCyberChessError(err, { route: "upcoming" });
    res.status(500).json({ error: "tournaments load failed" });
  }
});

// Webhook called by the tournament service when a tournament finalizes.
// Validates a shared secret, then appends a ChessPrize per podium spot.
// Idempotent on (tournamentId, place, email).
// Lazy resolution: throwing at module load would crash the server on a
// misconfigured prod deploy.
const getWebhookSecret = () => requireProdSecret("CYBERCHESS_WEBHOOK_SECRET", "dev-chess-webhook");

cyberchessRouter.post("/tournament-finalized", async (req, res) => {
  const verdict = verifyWebhookSig({
    signature: req.headers["x-aevion-signature"],
    timestamp: req.headers["x-aevion-timestamp"],
    legacySecret: req.headers["x-cyberchess-secret"],
    body: req.body,
    secret: getWebhookSecret(),
  });
  if (!verdict.ok) {
    return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
  }
  await ensureEcosystemLoaded();

  const { tournamentId, podium } = req.body || {};
  if (typeof tournamentId !== "string" || !Array.isArray(podium)) {
    return res
      .status(400)
      .json({ error: "tournamentId (string) and podium (array) required" });
  }

  type PodiumEntry = { email?: unknown; place?: unknown; amount?: unknown };
  const entries = podium as PodiumEntry[];
  const recorded: Array<{ id: string; email: string; place: number; amount: number; transferId: string }> = [];
  const replayed: Array<{ id: string; email: string; place: number }> = [];
  // A podium spot whose credit did not go through, and one we could not read
  // at all. Both used to vanish without a trace — see the two comments below.
  const failed: Array<{ email: string; place: number | null; reason: string }> = [];
  const skipped: Array<{ place: number | null; reason: string }> = [];

  for (const e of entries) {
    // A malformed entry used to be dropped in silence while the response still
    // said 201: a winner could disappear from a podium and nothing anywhere
    // said so. Retrying cannot repair bad input, so this does not fail the
    // delivery — it just stops being invisible.
    if (typeof e.email !== "string" || typeof e.place !== "number") {
      skipped.push({
        place: typeof e.place === "number" ? e.place : null,
        reason: "email (string) and place (number) required",
      });
      continue;
    }
    const amt = Number(e.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      skipped.push({ place: e.place, reason: "amount must be a positive number" });
      continue;
    }

    const dup = chessPrizes.find(
      (x) =>
        x.tournamentId === tournamentId &&
        x.place === e.place &&
        x.email === (e.email as string).toLowerCase(),
    );
    if (dup) {
      replayed.push({ id: dup.id, email: dup.email, place: dup.place });
      continue;
    }

    // Credit the winner's QTrade account, same pattern as the QRight royalty
    // webhook (auto-provisions an account, not subject to the daily topup
    // cap since this is a verified external payout).
    // A throw here is treated exactly like ok:false. Letting it escape would
    // abandon the loop before scheduleEcosystemPersist() below, so prizes
    // already credited in this batch would be missing from the stored ledger
    // after a restart — and the retry, finding no record, would pay them twice.
    let credit: Awaited<ReturnType<typeof internalCreditAccount>>;
    try {
      credit = await internalCreditAccount({
        owner: e.email,
        amount: amt,
        memo: `Chess prize · ${tournamentId} · place ${e.place}`,
      });
    } catch (err: any) {
      credit = { ok: false, error: err?.message ? String(err.message) : "credit threw" };
      captureCyberChessError(err, { route: "tournament-finalized", tournamentId, place: String(e.place) });
    }

    if (!credit.ok) {
      // The money did not move. Recording the prize anyway and answering 201
      // told the sender "delivered", so it never retried and the winner's
      // prize quietly never existed — while /ecosystem and the bank's
      // ChessWinnings listed it as paid, transferId null. Record nothing and
      // report the failure, so the retry credits this spot exactly once (the
      // dedup above keeps the spots that did go through from paying twice).
      failed.push({ email: (e.email as string).toLowerCase(), place: e.place, reason: credit.error });
      continue;
    }

    const prize: ChessPrize = {
      id: `prize_${randomUUID()}`,
      email: (e.email as string).toLowerCase(),
      tournamentId,
      place: e.place,
      amount: amt,
      finalizedAt: new Date().toISOString(),
      transferId: credit.operationId,
      source: "cyberchess",
    };
    chessPrizes.push(prize);
    // credit.operationId, not prize.transferId: the stored field is nullable
    // for rows written before this endpoint refused to record an unpaid prize,
    // but everything reported here as recorded was paid this request.
    recorded.push({ id: prize.id, email: prize.email, place: prize.place, amount: prize.amount, transferId: credit.operationId });
  }

  // Mark the tournament finalized in persistent storage so it stops
  // appearing in /upcoming. Idempotent — safe even if the same webhook
  // arrives multiple times (the chess prize dedup above already covers
  // double-recording on retry).
  await markTournamentFinalized(tournamentId).catch((err) => {
    console.error("[cyberchess] markTournamentFinalized failed", err);
  });

  // Persist before answering on either path: the spots that were credited must
  // be in the stored ledger before the sender is told anything, otherwise a
  // restart loses the record while the QTrade credit itself survives.
  if (recorded.length > 0) scheduleEcosystemPersist();

  if (failed.length > 0) {
    // Senders act on the status, not the body. 502 so the delivery is retried;
    // the spots already paid come back as `replayed`, only the failed ones are
    // attempted again.
    return res.status(502).json({
      error: "credit_failed",
      tournamentId,
      recorded,
      replayed,
      skipped,
      failed,
      finalizedAt: new Date().toISOString(),
    });
  }

  res.status(201).json({
    tournamentId,
    recorded,
    replayed,
    skipped,
    finalizedAt: new Date().toISOString(),
  });
});

// =====================================================================
// CPI (Chess Performance Index) — per-user multi-factor rating
// 11 factors + overall composite for /cyberchess/cpi/leaderboard.
// Lazy Prisma init (mirrors routes/puzzles.ts pattern). Offline mode
// returns an empty leaderboard so the UI degrades gracefully when
// DATABASE_URL is unset locally.
// =====================================================================

const CPI_FACTORS = [
  "overall",
  "accuracy",
  "tactics",
  "endgame",
  "timing",
  "aggression",
  "timeControl",
  "opening",
  "defense",
  "consistency",
  "endgameTechnique",
  "psychology",
] as const;
type CpiFactor = (typeof CPI_FACTORS)[number];

// CPI store — raw pg (Prisma 7 requires adapter; raw pool avoids that dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cpiPool: any = null;
let cpiDbReady = false;
let cpiDbInitTried = false;

async function ensureCpiDb(): Promise<void> {
  if (cpiDbInitTried) return;
  cpiDbInitTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[CyberchessCPI] No DATABASE_URL — offline mode");
    return;
  }
  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    // Create table if not exists (idempotent — mirrors Prisma schema migration)
    // Ensure updatedAt has a default (table may have been created by prisma db push without one)
    await pool.query(`ALTER TABLE IF EXISTS "CyberchessCpiState" ALTER COLUMN "updatedAt" SET DEFAULT now()`).catch(() => {});
    // Таблица могла быть создана раньше — тогда CREATE TABLE IF NOT EXISTS ниже
    // ничего не добавит, и колонка происхождения не появится. Строки, лежащие
    // там с прошлых версий, тоже прислал клиент, поэтому значение по умолчанию
    // для них верное.
    await pool
      .query(`ALTER TABLE IF EXISTS "CyberchessCpiState" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'self_reported'`)
      .catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CyberchessCpiState" (
        "userId"            TEXT PRIMARY KEY,
        "displayName"       TEXT,
        "overall"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "accuracy"          DOUBLE PRECISION NOT NULL DEFAULT 0,
        "tactics"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "endgame"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "timing"            DOUBLE PRECISION NOT NULL DEFAULT 0,
        "aggression"        DOUBLE PRECISION NOT NULL DEFAULT 0,
        "timeControl"       DOUBLE PRECISION NOT NULL DEFAULT 0,
        "opening"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "defense"           DOUBLE PRECISION NOT NULL DEFAULT 0,
        "consistency"       DOUBLE PRECISION NOT NULL DEFAULT 0,
        "endgameTechnique"  DOUBLE PRECISION NOT NULL DEFAULT 0,
        "psychology"        DOUBLE PRECISION NOT NULL DEFAULT 0,
        "gamesPlayed"       INTEGER NOT NULL DEFAULT 0,
        -- Откуда взялись числа. Сегодня их считает браузер игрока и присылает
        -- о себе сам, поэтому единственное честное значение — 'self_reported'.
        -- Признак живёт В ДАННЫХ, а не в голове у того, кто будет подключать
        -- страницу: иначе самооценка попадёт на публичную витрину как
        -- измеренная сервером. Появится серверный расчёт — у его строк будет
        -- своё значение, и отличить одно от другого можно будет запросом.
        "source"            TEXT NOT NULL DEFAULT 'self_reported',
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "cpi_overall_idx"     ON "CyberchessCpiState" ("overall" DESC);
      CREATE INDEX IF NOT EXISTS "cpi_tactics_idx"     ON "CyberchessCpiState" ("tactics" DESC);
      CREATE INDEX IF NOT EXISTS "cpi_accuracy_idx"    ON "CyberchessCpiState" ("accuracy" DESC);
      CREATE INDEX IF NOT EXISTS "cpi_endgame_idx"     ON "CyberchessCpiState" ("endgame" DESC);
    `);
    cpiPool = pool;
    cpiDbReady = true;
    console.log("[CyberchessCPI] pg connected — CPI store ready");
  } catch (e) {
    console.warn("[CyberchessCPI] pg init failed:", e instanceof Error ? e.message : e);
  }
}

// Map Prisma camelCase factor names to quoted PG column names
const PG_COL: Record<string, string> = {
  overall: '"overall"', accuracy: '"accuracy"', tactics: '"tactics"',
  endgame: '"endgame"', timing: '"timing"', aggression: '"aggression"',
  timeControl: '"timeControl"', opening: '"opening"', defense: '"defense"',
  consistency: '"consistency"', endgameTechnique: '"endgameTechnique"',
  psychology: '"psychology"',
};

function parseFactor(raw: unknown): CpiFactor {
  if (typeof raw === "string" && (CPI_FACTORS as readonly string[]).includes(raw)) {
    return raw as CpiFactor;
  }
  return "overall";
}

function parseLimit(raw: unknown, def = 20, max = 100): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(max, Math.floor(n));
}

function clampFactorValue(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// GET /api/cyberchess/cpi/leaderboard?factor=<factor>&limit=20
// Public. factor defaults to "overall", limit max 100.
cyberchessRouter.get("/cpi/leaderboard", async (req: Request, res: Response) => {
  await ensureCpiDb();
  const factor = parseFactor(req.query.factor);
  const limit = parseLimit(req.query.limit, 20, 100);

  if (!cpiDbReady) {
    return res.json({ data: { items: [], offline: true, factor, limit } });
  }

  try {
    const col = PG_COL[factor] ?? '"overall"';
    const { rows } = await cpiPool!.query(
      `SELECT "userId","displayName",${col} AS value,"gamesPlayed","source" FROM "CyberchessCpiState" ORDER BY ${col} DESC LIMIT $1`,
      [limit],
    );
    // Происхождение едет вместе со значением. Признак, который есть в базе, но
    // не доходит до читателя, ничем не отличается от отсутствующего: страница
    // всё равно покажет самооценку игрока как измеренную величину.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = rows.map((r: any, idx: number) => ({
      userId: r.userId,
      displayName: r.displayName ?? null,
      value: r.value ?? 0,
      rank: idx + 1,
      gamesPlayed: r.gamesPlayed ?? 0,
      source: r.source ?? "self_reported",
    }));
    res.json({ data: { items, factor, limit } });
  } catch (err) {
    captureCyberChessError(err, { route: "cpi/leaderboard" });
    console.error("[CyberchessCPI] leaderboard:", err);
    res.status(500).json({ error: "cpi_leaderboard_failed" });
  }
});

// POST /api/cyberchess/cpi/upsert
// Body: { factors: {...11 floats...}, gamesPlayed, displayName? }
//
// БЕЗОПАСНОСТЬ: чья это строка — решает JWT (req.auth.sub через requireAuth), а
// НЕ тело запроса. Та же дисциплина, что у /state ниже в этом файле.
//
// Как было до 12.08.2026: ручка помечена «Trust-based MVP (no auth)» и брала
// `userId` прямо из тела. То есть кто угодно, без единого заголовка, мог
// поднять себя на вершину рейтинга силы и испортить строку любому игроку по
// его номеру. Мера силы игрока — это то, что видно публично и на что смотрят
// при подборе соперника и в турнирах; писать её должен только сервер от имени
// того, кто вошёл.
//
// Закрыто ДО подключения страницы к настоящим данным, а не после: сегодня у
// ручки нет ни одного вызывающего (страница CPI-лидерборда рисует макет), и
// именно поэтому цена правки сейчас нулевая. Когда появится первый вызывающий,
// он будет писать уже по правилам, а не переучиваться.
cyberchessRouter.post("/cpi/upsert", requireAuth, async (req: Request, res: Response) => {
  const authUserId = String((req as { auth?: { sub?: string } }).auth?.sub || "");
  if (!authUserId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { userId: bodyUserId, factors, gamesPlayed, displayName } = (req.body ?? {}) as {
    userId?: unknown;
    factors?: Record<string, unknown>;
    gamesPlayed?: unknown;
    displayName?: unknown;
  };

  // Явный отказ, а не молчаливая подстановка своего номера: клиент, который
  // прислал чужой userId, должен узнать, что его запись не состоялась. Тихо
  // записать «на себя» и ответить 200 значит соврать о том, что произошло.
  if (typeof bodyUserId === "string" && bodyUserId.length > 0 && bodyUserId !== authUserId) {
    return res.status(403).json({ error: "userId_mismatch" });
  }
  const userId = authUserId;

  await ensureCpiDb();
  if (!cpiDbReady) {
    return res.status(503).json({ error: "cpi_db_not_ready" });
  }

  if (!factors || typeof factors !== "object") {
    return res.status(400).json({ error: "factors (object) required" });
  }

  const games = Number(gamesPlayed);
  const gp = Number.isFinite(games) && games >= 0 ? Math.floor(games) : 0;

  const data: Record<string, number | string | null> = {
    overall: clampFactorValue(factors.overall),
    accuracy: clampFactorValue(factors.accuracy),
    tactics: clampFactorValue(factors.tactics),
    endgame: clampFactorValue(factors.endgame),
    timing: clampFactorValue(factors.timing),
    aggression: clampFactorValue(factors.aggression),
    timeControl: clampFactorValue(factors.timeControl),
    opening: clampFactorValue(factors.opening),
    defense: clampFactorValue(factors.defense),
    consistency: clampFactorValue(factors.consistency),
    endgameTechnique: clampFactorValue(factors.endgameTechnique),
    psychology: clampFactorValue(factors.psychology),
    gamesPlayed: gp,
    // Единственный сегодняшний писатель — браузер игрока. Значение ставит
    // сервер, а не тело запроса: иначе клиент объявит свои числа проверенными.
    source: "self_reported",
  };
  if (typeof displayName === "string" && displayName.length > 0) {
    data.displayName = displayName.slice(0, 120);
  }

  try {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const setClauses = cols.map((c, i) => `"${c}" = $${i + 2}`).join(", ");
    const insertCols = ['"userId"', ...cols.map(c => `"${c}"`)].join(", ");
    const insertVals = ["$1", ...cols.map((_, i) => `$${i + 2}`)].join(", ");
    const { rows } = await cpiPool!.query(
      `INSERT INTO "CyberchessCpiState" (${insertCols}) VALUES (${insertVals})
       ON CONFLICT ("userId") DO UPDATE SET ${setClauses}, "updatedAt" = now()
       RETURNING *`,
      [userId, ...vals],
    );
    res.status(200).json({ data: rows[0] ?? null });
  } catch (err) {
    captureCyberChessError(err, { route: "cpi/upsert" });
    console.error("[CyberchessCPI] upsert:", err);
    res.status(500).json({ error: "cpi_upsert_failed" });
  }
});

// GET /api/cyberchess/cpi/me?userId=...
// Returns current state of a single user, or null if not present.
cyberchessRouter.get("/cpi/me", async (req: Request, res: Response) => {
  await ensureCpiDb();
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) {
    return res.status(400).json({ error: "userId query param required" });
  }
  if (!cpiDbReady) {
    return res.json({ data: null, offline: true });
  }
  try {
    const { rows } = await cpiPool!.query(
      `SELECT * FROM "CyberchessCpiState" WHERE "userId" = $1 LIMIT 1`,
      [userId],
    );
    res.json({ data: rows[0] ?? null });
  } catch (err) {
    captureCyberChessError(err, { route: "cpi/me" });
    console.error("[CyberchessCPI] me:", err);
    res.status(500).json({ error: "cpi_me_failed" });
  }
});

// ─── CyberChess cloud state — аккаунт-синхра между устройствами ──────────
// Снапшот игрового состояния (рейтинг/история/Chessy/прогресс) как JSON.
// БЕЗОПАСНОСТЬ: userId берётся из JWT (req.auth.sub через requireAuth), НЕ из
// тела/квери → нельзя подменить чужой аккаунт. Zero-regression: без DATABASE_URL
// эндпоинты отвечают offline/503, фронт продолжает жить на localStorage.
let statePool: any = null;
let stateDbTried = false;
async function ensureStateDb(): Promise<any> {
  if (stateDbTried) return statePool;
  stateDbTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[CyberchessState] No DATABASE_URL — offline mode");
    return null;
  }
  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CyberchessUserState" (
        "userId"    TEXT PRIMARY KEY,
        "state"     JSONB NOT NULL DEFAULT '{}'::jsonb,
        "clientTs"  BIGINT NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    statePool = pool;
    console.log("[CyberchessState] pg ready — cloud state store active");
    return pool;
  } catch (e) {
    console.warn("[CyberchessState] pg init failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

const STATE_MAX_BYTES = 262_144; // 256 KB защита от абьюза

// GET /api/cyberchess/state — снапшот текущего пользователя (из JWT).
cyberchessRouter.get("/state", requireAuth, async (req: Request, res: Response) => {
  const userId = String((req as { auth?: { sub?: string } }).auth?.sub || "");
  if (!userId) { res.status(401).json({ error: "unauthorized" }); return; }
  const pool = await ensureStateDb();
  if (!pool) { res.json({ ok: true, state: null, clientTs: 0, offline: true }); return; }
  try {
    const r = await pool.query(
      `SELECT "state","clientTs","updatedAt" FROM "CyberchessUserState" WHERE "userId"=$1`,
      [userId],
    );
    if (!r.rows[0]) { res.json({ ok: true, state: null, clientTs: 0 }); return; }
    res.json({
      ok: true,
      state: r.rows[0].state ?? null,
      clientTs: Number(r.rows[0].clientTs) || 0,
      updatedAt: r.rows[0].updatedAt,
    });
  } catch (err) {
    captureCyberChessError(err, { route: "state/get" });
    res.status(500).json({ error: "state_get_failed" });
  }
});

// PUT /api/cyberchess/state — upsert снапшота (last-writer по clientTs на клиенте).
// Body: { state: object, clientTs?: number }
cyberchessRouter.put("/state", requireAuth, async (req: Request, res: Response) => {
  const userId = String((req as { auth?: { sub?: string } }).auth?.sub || "");
  if (!userId) { res.status(401).json({ error: "unauthorized" }); return; }
  const body = (req.body ?? {}) as { state?: unknown; clientTs?: unknown };
  if (body.state == null || typeof body.state !== "object") {
    res.status(400).json({ error: "state (object) required" }); return;
  }
  let serialized: string;
  try { serialized = JSON.stringify(body.state); }
  catch { res.status(400).json({ error: "state not serializable" }); return; }
  if (serialized.length > STATE_MAX_BYTES) {
    res.status(413).json({ error: "state too large (max 256KB)" }); return;
  }
  const clientTs = Number(body.clientTs);
  const ts = Number.isFinite(clientTs) && clientTs > 0 ? Math.floor(clientTs) : 0;
  const pool = await ensureStateDb();
  if (!pool) { res.status(503).json({ error: "state store offline" }); return; }
  try {
    await pool.query(
      `INSERT INTO "CyberchessUserState" ("userId","state","clientTs","updatedAt")
       VALUES ($1,$2::jsonb,$3,now())
       ON CONFLICT ("userId") DO UPDATE SET "state"=$2::jsonb, "clientTs"=$3, "updatedAt"=now()`,
      [userId, serialized, ts],
    );
    res.json({ ok: true });
  } catch (err) {
    captureCyberChessError(err, { route: "state/put" });
    res.status(500).json({ error: "state_put_failed" });
  }
});
