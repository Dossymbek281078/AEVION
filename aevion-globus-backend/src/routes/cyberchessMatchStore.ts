/**
 * cyberchessMatchStore.ts — персистентность онлайн-матчей и Glicko-2 рейтингов.
 *
 * Заменяет эфемерный in-memory слой: матчи и рейтинги переживают редеплой
 * Railway (in-memory MATCHES/QUEUE Map'ы сбрасывались при каждом деплое →
 * рейтинг-прогрессии и истории не было).
 *
 * Паттерн — как в cyberchess.ts (CPI store): raw `pg.Pool` + `CREATE TABLE IF
 * NOT EXISTS` + guard на DATABASE_URL + try/catch на КАЖДОЙ операции. Всё
 * write-through и НЕ блокирующее: любая ошибка БД / отсутствие DATABASE_URL →
 * тихий no-op, live-поток матчмейкинга (in-memory) продолжает работать.
 * Prisma-модели CyberMatch/CyberRating в schema.prisma документируют форму.
 */

import {
  DEFAULT_GLICKO,
  rateMatch,
  type GlickoState,
  type GameResult,
} from "./cyberchessRating";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pg = require("pg") as typeof import("pg");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null;
let dbReady = false;
let dbInitTried = false;

/** Классификация скорости по контролю времени (как lichess: base + 40*inc). */
export function speedOf(timeControl: string): string {
  const m = /^(\d+)\+(\d+)$/.exec(timeControl);
  if (!m) return "blitz";
  const estimate = parseInt(m[1], 10) + 40 * parseInt(m[2], 10);
  if (estimate < 180) return "bullet";
  if (estimate < 480) return "blitz";
  if (estimate < 1500) return "rapid";
  return "classical";
}

export async function ensureDb(): Promise<void> {
  if (dbInitTried) return;
  dbInitTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[CyberMatchStore] No DATABASE_URL — offline mode (in-memory only)");
    return;
  }
  try {
    const p = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await p.query(`
      CREATE TABLE IF NOT EXISTS "CyberRating" (
        "userId"      TEXT NOT NULL,
        "speed"       TEXT NOT NULL,
        "displayName" TEXT,
        "rating"      DOUBLE PRECISION NOT NULL DEFAULT 1500,
        "rd"          DOUBLE PRECISION NOT NULL DEFAULT 350,
        "vol"         DOUBLE PRECISION NOT NULL DEFAULT 0.06,
        "games"       INTEGER NOT NULL DEFAULT 0,
        "wins"        INTEGER NOT NULL DEFAULT 0,
        "losses"      INTEGER NOT NULL DEFAULT 0,
        "draws"       INTEGER NOT NULL DEFAULT 0,
        "peak"        DOUBLE PRECISION NOT NULL DEFAULT 1500,
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY ("userId","speed")
      );
      CREATE INDEX IF NOT EXISTS "cyberrating_leaderboard_idx"
        ON "CyberRating" ("speed", "rating" DESC);

      CREATE TABLE IF NOT EXISTS "CyberMatch" (
        "id"                TEXT PRIMARY KEY,
        "whiteUserId"       TEXT NOT NULL,
        "whiteName"         TEXT,
        "blackUserId"       TEXT NOT NULL,
        "blackName"         TEXT,
        "timeControl"       TEXT NOT NULL,
        "speed"             TEXT NOT NULL,
        "status"            TEXT NOT NULL DEFAULT 'active',
        "result"            TEXT,
        "termination"       TEXT,
        "movesSan"          TEXT NOT NULL DEFAULT '',
        "ply"               INTEGER NOT NULL DEFAULT 0,
        "whiteRatingBefore" DOUBLE PRECISION,
        "blackRatingBefore" DOUBLE PRECISION,
        "whiteRatingAfter"  DOUBLE PRECISION,
        "blackRatingAfter"  DOUBLE PRECISION,
        "tournamentId"      TEXT,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "endedAt"           TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "cybermatch_white_idx" ON "CyberMatch" ("whiteUserId","createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "cybermatch_black_idx" ON "CyberMatch" ("blackUserId","createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "cybermatch_status_idx" ON "CyberMatch" ("status");
    `);
    pool = p;
    dbReady = true;
    console.log("[CyberMatchStore] pg connected — match/rating store ready");
  } catch (e) {
    console.warn("[CyberMatchStore] pg init failed:", e instanceof Error ? e.message : e);
  }
}

async function q(text: string, params: unknown[]): Promise<any[]> {
  if (!dbReady && !dbInitTried) await ensureDb();
  if (!dbReady || !pool) return [];
  try {
    const r = await pool.query(text, params);
    return r.rows || [];
  } catch (e) {
    console.warn("[CyberMatchStore] query failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

export interface RatingRow extends GlickoState {
  userId: string;
  speed: string;
  displayName: string | null;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
}

/** Текущий рейтинг игрока в данной скорости; дефолт (1500/350) если строки нет. */
export async function getRating(userId: string, speed: string): Promise<RatingRow> {
  const rows = await q(
    `SELECT * FROM "CyberRating" WHERE "userId"=$1 AND "speed"=$2`,
    [userId, speed],
  );
  if (rows.length === 0) {
    return {
      userId,
      speed,
      displayName: null,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      peak: DEFAULT_GLICKO.rating,
      ...DEFAULT_GLICKO,
    };
  }
  const r = rows[0];
  return {
    userId,
    speed,
    displayName: r.displayName,
    rating: Number(r.rating),
    rd: Number(r.rd),
    vol: Number(r.vol),
    games: Number(r.games),
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws),
    peak: Number(r.peak),
  };
}

/** Запись созданного матча (write-through из makeMatch). Никогда не throw'ит. */
export async function recordMatchCreated(m: {
  id: string;
  whiteUserId: string;
  whiteName?: string | null;
  blackUserId: string;
  blackName?: string | null;
  timeControl: string;
  tournamentId?: string | null;
  whiteRatingBefore?: number | null;
  blackRatingBefore?: number | null;
}): Promise<void> {
  await q(
    `INSERT INTO "CyberMatch"
       ("id","whiteUserId","whiteName","blackUserId","blackName","timeControl","speed","status","tournamentId","whiteRatingBefore","blackRatingBefore")
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10)
     ON CONFLICT ("id") DO NOTHING`,
    [
      m.id,
      m.whiteUserId,
      m.whiteName ?? null,
      m.blackUserId,
      m.blackName ?? null,
      m.timeControl,
      speedOf(m.timeControl),
      m.tournamentId ?? null,
      m.whiteRatingBefore ?? null,
      m.blackRatingBefore ?? null,
    ],
  );
}

/** Дозапись хода SAN в партию (append-only). */
export async function appendMove(matchId: string, san: string, ply: number): Promise<void> {
  await q(
    `UPDATE "CyberMatch"
       SET "movesSan" = CASE WHEN "movesSan"='' THEN $2 ELSE "movesSan" || ' ' || $2 END,
           "ply" = $3
     WHERE "id"=$1`,
    [matchId, san, ply],
  );
}

async function upsertRating(next: RatingRow): Promise<void> {
  await q(
    `INSERT INTO "CyberRating"
       ("userId","speed","displayName","rating","rd","vol","games","wins","losses","draws","peak","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT ("userId","speed") DO UPDATE SET
       "displayName"=COALESCE(EXCLUDED."displayName","CyberRating"."displayName"),
       "rating"=EXCLUDED."rating","rd"=EXCLUDED."rd","vol"=EXCLUDED."vol",
       "games"=EXCLUDED."games","wins"=EXCLUDED."wins","losses"=EXCLUDED."losses",
       "draws"=EXCLUDED."draws","peak"=GREATEST("CyberRating"."peak",EXCLUDED."peak"),
       "updatedAt"=now()`,
    [
      next.userId, next.speed, next.displayName,
      next.rating, next.rd, next.vol,
      next.games, next.wins, next.losses, next.draws, next.peak,
    ],
  );
}

/**
 * Финализация матча: пишет результат, пересчитывает Glicko-2 обоих игроков,
 * апдейтит их рейтинги. Возвращает дельты рейтинга для UI (или null оффлайн).
 * result — "white" | "black" | "draw".
 */
export async function finalizeMatch(
  matchId: string,
  info: {
    whiteUserId: string;
    whiteName?: string | null;
    blackUserId: string;
    blackName?: string | null;
    timeControl: string;
    result: "white" | "black" | "draw";
    termination?: string;
  },
): Promise<{ white: { before: number; after: number }; black: { before: number; after: number } } | null> {
  if (!dbReady && !dbInitTried) await ensureDb();
  if (!dbReady) return null;

  // DB-layer idempotency: if this match row is already finalized, return the
  // stored deltas WITHOUT re-applying rating changes. Guards against double-
  // finalize corrupting Glicko-2 (the in-memory MATCHES guard is volatile and
  // is wiped on process restart while the DB row persists).
  const existing = await q(
    `SELECT "status","whiteRatingBefore","blackRatingBefore","whiteRatingAfter","blackRatingAfter"
       FROM "CyberMatch" WHERE "id"=$1`,
    [matchId],
  );
  const prior = existing?.[0];
  if (prior && prior.status === "ended") {
    const wb = Number(prior.whiteRatingBefore), wa = Number(prior.whiteRatingAfter);
    const bb = Number(prior.blackRatingBefore), ba = Number(prior.blackRatingAfter);
    if ([wb, wa, bb, ba].every(Number.isFinite)) {
      return {
        white: { before: Math.round(wb), after: Math.round(wa) },
        black: { before: Math.round(bb), after: Math.round(ba) },
      };
    }
    return null; // finalized but deltas unknown — do not double-apply
  }

  const speed = speedOf(info.timeControl);
  const wRat = await getRating(info.whiteUserId, speed);
  const bRat = await getRating(info.blackUserId, speed);

  const resultForWhite: GameResult = info.result === "white" ? 1 : info.result === "black" ? 0 : 0.5;
  const { a: wNext, b: bNext } = rateMatch(
    { rating: wRat.rating, rd: wRat.rd, vol: wRat.vol },
    { rating: bRat.rating, rd: bRat.rd, vol: bRat.vol },
    resultForWhite,
  );

  const wWin = info.result === "white", bWin = info.result === "black", draw = info.result === "draw";
  const wRow: RatingRow = {
    ...wRat, displayName: info.whiteName ?? wRat.displayName,
    rating: wNext.rating, rd: wNext.rd, vol: wNext.vol,
    games: wRat.games + 1,
    wins: wRat.wins + (wWin ? 1 : 0), losses: wRat.losses + (bWin ? 1 : 0), draws: wRat.draws + (draw ? 1 : 0),
    peak: Math.max(wRat.peak, wNext.rating),
  };
  const bRow: RatingRow = {
    ...bRat, displayName: info.blackName ?? bRat.displayName,
    rating: bNext.rating, rd: bNext.rd, vol: bNext.vol,
    games: bRat.games + 1,
    wins: bRat.wins + (bWin ? 1 : 0), losses: bRat.losses + (wWin ? 1 : 0), draws: bRat.draws + (draw ? 1 : 0),
    peak: Math.max(bRat.peak, bNext.rating),
  };

  await upsertRating(wRow);
  await upsertRating(bRow);
  await q(
    `UPDATE "CyberMatch" SET "status"='ended',"result"=$2,"termination"=$3,
       "whiteRatingBefore"=COALESCE("whiteRatingBefore",$4),"blackRatingBefore"=COALESCE("blackRatingBefore",$5),
       "whiteRatingAfter"=$6,"blackRatingAfter"=$7,"endedAt"=now()
     WHERE "id"=$1`,
    [matchId, info.result, info.termination ?? null, wRat.rating, bRat.rating, wNext.rating, bNext.rating],
  );

  return {
    white: { before: Math.round(wRat.rating), after: Math.round(wNext.rating) },
    black: { before: Math.round(bRat.rating), after: Math.round(bNext.rating) },
  };
}

export async function getLeaderboard(speed: string, limit = 50): Promise<RatingRow[]> {
  const rows = await q(
    `SELECT * FROM "CyberRating" WHERE "speed"=$1 AND "games">0 ORDER BY "rating" DESC LIMIT $2`,
    [speed, Math.min(200, Math.max(1, limit))],
  );
  return rows.map((r) => ({
    userId: r.userId, speed: r.speed, displayName: r.displayName,
    rating: Number(r.rating), rd: Number(r.rd), vol: Number(r.vol),
    games: Number(r.games), wins: Number(r.wins), losses: Number(r.losses),
    draws: Number(r.draws), peak: Number(r.peak),
  }));
}

export async function getHistory(userId: string, limit = 30): Promise<any[]> {
  return q(
    `SELECT "id","whiteUserId","whiteName","blackUserId","blackName","timeControl","speed",
            "status","result","termination","ply","movesSan","whiteRatingBefore","blackRatingBefore",
            "whiteRatingAfter","blackRatingAfter","createdAt","endedAt"
       FROM "CyberMatch"
      WHERE ("whiteUserId"=$1 OR "blackUserId"=$1) AND "status"='ended'
      ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, Math.min(100, Math.max(1, limit))],
  );
}
