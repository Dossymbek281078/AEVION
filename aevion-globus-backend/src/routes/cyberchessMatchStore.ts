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

// Обычный импорт, а не require: под `require` подмена драйвера в тестах не
// действует (проверено 12.08 — в подделку приходило НОЛЬ запросов, а часть
// тестов при этом «зеленела», потому что не выполнялось вообще ничего). Форма
// принята в репозитории — так же берёт пул `lib/dbPool.ts`, а esModuleInterop
// включён, поэтому под CommonJS это тот же объект модуля.
import pg from "pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null;
let dbReady = false;
let dbInitTried = false;
/** Когда в этом процессе таблицы (включая ведомость выплат) точно есть. */
let storeReadyAt = 0;
/** Первая выплата в ведомости, мс. null — ведомость пуста или спросить не вышло. */
let ledgerStartAt: number | null = null;

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

      -- Server-authoritative Chessy wallet — see awardMatchChessy() below. Only
      -- finalizeMatch() (real matchmaking games, server-verified result post
      -- move-legality hardening) writes to this today; the existing 60+
      -- addChessy() call sites in the frontend remain client-side/localStorage
      -- and are out of scope — this table exists specifically so a public
      -- leaderboard has at least one balance that can't be forged via devtools.
      CREATE TABLE IF NOT EXISTS "CyberWallet" (
        "userId"      TEXT PRIMARY KEY,
        "displayName" TEXT,
        "balance"     BIGINT NOT NULL DEFAULT 0,
        "earnedTotal" BIGINT NOT NULL DEFAULT 0,
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "cyberwallet_leaderboard_idx" ON "CyberWallet" ("balance" DESC);

      -- Одна строка на (партия, игрок) — доказательство, что за эту партию
      -- этому игроку уже заплачено. Пишется ТЕМ ЖЕ запросом, что и изменение
      -- баланса (см. awardMatchChessy), поэтому ведомость и кошелёк не могут
      -- разойтись. Нужна для двух вещей сразу:
      --   * первичный ключ делает повторную выплату невозможной на уровне БД,
      --     а не только на уровне захвата строки матча;
      --   * закрытая партия БЕЗ своих строк — это и есть след неудавшегося
      --     начисления. Раньше следа не было вовсе: q() ловит ошибку запроса,
      --     пишет warning и возвращает пустой массив, так что провал выплаты
      --     ничем не отличался от успеха.
      CREATE TABLE IF NOT EXISTS "CyberWalletAward" (
        "matchId" TEXT NOT NULL,
        "userId"  TEXT NOT NULL,
        "amount"  INTEGER NOT NULL,
        "paidAt"  TIMESTAMP NOT NULL DEFAULT now(),
        PRIMARY KEY ("matchId","userId")
      );
      CREATE INDEX IF NOT EXISTS "cyberwalletaward_match_idx" ON "CyberWalletAward" ("matchId");
    `);
    pool = p;
    dbReady = true;
    // Момент, с которого таблица ведомости заведомо существует в этом процессе
    // (CREATE TABLE IF NOT EXISTS выше). Нужен как граница доплаты — см.
    // repairBoundMs().
    storeReadyAt = Date.now();
    console.log("[CyberMatchStore] pg connected — match/rating store ready");
  } catch (e) {
    console.warn("[CyberMatchStore] pg init failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Запрос, который отличает «пусто» от «не смогли спросить»: null означает, что
 * ответа нет — база недоступна или запрос упал.
 *
 * Разница не косметическая. Через q() ниже оба случая выглядят как пустой
 * список, и на чтениях это превращается в утверждение: «у игрока 0 Chessy»,
 * «никто ещё не заработал». Такие фразы человек читает как факт, а получены они
 * из запроса, который не выполнился.
 */
async function qOrNull(text: string, params: unknown[]): Promise<any[] | null> {
  if (!dbReady && !dbInitTried) await ensureDb();
  if (!dbReady || !pool) return null;
  try {
    const r = await pool.query(text, params);
    return r.rows || [];
  } catch (e) {
    console.warn("[CyberMatchStore] query failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Учёт записи в хранилище партий.
 *
 * До 18.08.2026 его не было вовсе: отказ записи превращался в тихий no-op с
 * одной строкой в console.warn. Так пишутся партии, ходы, рейтинги и НАЧИСЛЕНИЯ
 * CHESSY — то есть денежный путь работал без единого счётчика, и «всё хорошо»
 * нельзя было отличить от «половина записей не доехала».
 */
export const matchStoreHealth = {
  writes: 0,
  writeErrors: 0,
  /** Захват партии не выполнен, потому что база не ответила (НЕ «уже закрыта»). */
  claimUnknown: 0,
  lastErrorKind: null as string | null,
};

/**
 * Пишущий/фоновый вариант: отказ не блокирует поток матчей, но БОЛЬШЕ НЕ
 * молчит. Пустой список по-прежнему возвращается ради совместимости с
 * вызывающими, а факт отказа теперь виден в счётчике.
 */
async function q(text: string, params: unknown[]): Promise<any[]> {
  const rows = await qOrNull(text, params);
  if (rows === null) {
    matchStoreHealth.writeErrors += 1;
    return [];
  }
  matchStoreHealth.writes += 1;
  return rows;
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
/**
 * Рейтинг игрока. `null` — «спросить не удалось».
 *
 * Разница здесь дороже, чем на чтениях для экрана. Отсутствие строки — законный
 * случай: новичок начинает с 1500. Но при отказе запроса функция возвращала ТЕ
 * ЖЕ 1500 — и finalizeMatch считал на них новый рейтинг и записывал результат.
 * Один сбой сети на этом SELECT молча превращал игрока с 1900 в новичка, причём
 * не на экране, а в базе.
 */
export async function getRating(userId: string, speed: string): Promise<RatingRow | null> {
  const rows = await qOrNull(
    `SELECT * FROM "CyberRating" WHERE "userId"=$1 AND "speed"=$2`,
    [userId, speed],
  );
  if (rows === null) return null;
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
    `SELECT "status","result","endedAt","whiteUserId","blackUserId","whiteName","blackName",
            "whiteRatingBefore","blackRatingBefore","whiteRatingAfter","blackRatingAfter"
       FROM "CyberMatch" WHERE "id"=$1`,
    [matchId],
  );
  const prior = existing?.[0];
  if (prior && prior.status === "ended") {
    // Рейтинг здесь не пересчитывается — он уже применён. А вот выплату
    // повторить НАДО: ведомость делает её идемпотентной, поэтому этот проход
    // либо не делает ничего (уже заплачено), либо доплачивает то, что не
    // прошло в первый раз. Плательщики и исход берутся из СТРОКИ, а не из
    // аргументов: второй отчёт присылает другой клиент, и его версия исхода
    // не должна решать, кому сколько причитается.
    //
    // Только для партий, закрытых после появления ведомости: у остальных строк
    // в ней нет не потому, что им не заплатили, а потому, что её тогда не было
    // (см. repairBoundMs).
    const endedAtMs = prior.endedAt ? new Date(prior.endedAt).getTime() : NaN;
    if (Number.isFinite(endedAtMs) && endedAtMs >= (await repairBoundMs())) {
      await settleAwards(matchId, prior);
    }

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

  // Захват строки ДО любых начислений.
  //
  // Раньше пометка `ended` ставилась ПОСЛЕДНЕЙ: сперва рейтинг, потом Chessy
  // обоим, и только затем UPDATE. Крэш для беды не нужен — обёртка q() ловит
  // ошибку запроса, пишет warning и возвращает пустой массив, так что одного
  // обычного отказа на этом UPDATE хватало: функция возвращалась как успешная,
  // игроки уже начислены, строка осталась открытой. Следующий вызов проходил
  // проверку заново и платил второй раз. А следующий вызов — это норма: конец
  // партии сообщают ОБА клиента, а внутрипроцессная защита стирается рестартом,
  // то есть ровно тогда, когда повторы и приходят.
  //
  // Условие `"status" <> 'ended'` делает захват атомарным: из двух
  // одновременных вызовов строку получает ровно один. RETURNING — потому что
  // q() отдаёт только rows и теряет rowCount.
  // qOrNull, а НЕ q: здесь пустой список и отказ базы означают разное, а q()
  // отдаёт [] в обоих случаях.
  //
  // Найдено 18.08.2026. Отказ на этом запросе читался как «строку закрыл кто-то
  // другой» — и функция молча не начисляла Chessy, отвечая игроку ok. То есть
  // сбой сети выглядел как штатный повтор, а деньги не приходили, и в системе
  // не оставалось ни счётчика, ни строки об этом.
  const claimed = await qOrNull(
    `UPDATE "CyberMatch" SET "status"='ended',"result"=$2,"termination"=$3,"endedAt"=now()
      WHERE "id"=$1 AND "status" <> 'ended' RETURNING "id"`,
    [matchId, info.result, info.termination ?? null],
  );
  if (claimed === null) {
    // Спросить не удалось — это НЕ «уже закрыта». Строка осталась незакрытой,
    // поэтому повтор (конец партии сообщают оба клиента) захватит её честно.
    // Молчать нельзя: без этой строки отказ неотличим от нормы.
    matchStoreHealth.claimUnknown += 1;
    matchStoreHealth.lastErrorKind = "query";
    console.error(
      `[CyberMatchStore] захват партии ${matchId} не выполнен — база не ответила. Начисление НЕ сделано; ждём повтора от второго клиента.`,
    );
    return null;
  }
  if (claimed.length === 0) {
    // Строку закрыл кто-то другой между нашим SELECT и этим UPDATE — либо она
    // была закрыта раньше, а SELECT не дошёл. Ничего не начисляем.
    return null;
  }

  const speed = speedOf(info.timeControl);
  const wRat = await getRating(info.whiteUserId, speed);
  const bRat = await getRating(info.blackUserId, speed);

  if (!wRat || !bRat) {
    // Прежний рейтинг неизвестен — считать не на чем. Раньше сюда приходили
    // подставные 1500, и результат этого счёта записывался поверх настоящего
    // рейтинга: сбой чтения стирал силу игрока.
    //
    // Партия остаётся закрытой (она действительно закончилась) и оплаченной —
    // выплата от рейтинга не зависит. Теряется только изменение рейтинга за эту
    // партию, и об этом сказано вслух.
    console.error(
      `[CyberMatchStore] rating skipped match=${matchId} — не удалось прочитать прежний рейтинг; изменение за эту партию не применено`,
    );
    await settleAwards(matchId, {
      whiteUserId: info.whiteUserId,
      blackUserId: info.blackUserId,
      whiteName: info.whiteName,
      blackName: info.blackName,
      result: info.result,
    });
    return null;
  }

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
  // Small, trustworthy Chessy award straight off the server-verified result —
  // info.result comes from settleMatch()'s authoritative board/clock logic
  // (see cyberchessMatchmaking.ts), not a client claim. Выплата проходит через
  // ведомость: захват строки матча защищает от повтора, а ведомость — ещё и от
  // потери, если сам запрос начисления не пройдёт.
  await settleAwards(matchId, {
    whiteUserId: info.whiteUserId,
    blackUserId: info.blackUserId,
    whiteName: info.whiteName,
    blackName: info.blackName,
    result: info.result,
  });
  // Статус и исход уже записаны захватом выше — здесь только колонки рейтинга.
  await q(
    `UPDATE "CyberMatch" SET
       "whiteRatingBefore"=COALESCE("whiteRatingBefore",$2),"blackRatingBefore"=COALESCE("blackRatingBefore",$3),
       "whiteRatingAfter"=$4,"blackRatingAfter"=$5
     WHERE "id"=$1`,
    [matchId, wRat.rating, bRat.rating, wNext.rating, bNext.rating],
  );

  return {
    white: { before: Math.round(wRat.rating), after: Math.round(wNext.rating) },
    black: { before: Math.round(bRat.rating), after: Math.round(bNext.rating) },
  };
}

/** Чем кончилась попытка выплаты. Три исхода, а не два, потому что «уже
 * заплачено» и «не смогли заплатить» — разные вещи, а раньше и то и другое
 * выглядело как успешно завершившийся await. */
export type AwardOutcome = "credited" | "already" | "failed";

/**
 * Начислить игроку Chessy за партию — ровно один раз за (партия, игрок).
 *
 * Ведомость и баланс меняются ОДНИМ запросом: внешняя вставка в
 * `CyberWalletAward` служит замком, а кошелёк пополняется только на строках,
 * которые этот замок отдал. Отсюда три свойства:
 *   * повтор ничего не платит (конфликт по первичному ключу → claim пуст →
 *     во вставку в кошелёк не приходит ни одной строки);
 *   * ведомость не может утверждать выплату, которой не было, и наоборот —
 *     обе вставки живут или падают вместе;
 *   * отказ БД отличим от «уже заплачено»: успешный запрос ВСЕГДА возвращает
 *     ровно одну строку со счётчиком, поэтому пустой ответ q() — это провал.
 *
 * Сумма передаётся двумя параметрами намеренно: `amount` в ведомости —
 * INTEGER, а balance/earnedTotal — BIGINT. Один и тот же плейсхолдер в двух
 * колонках разного типа заставляет Postgres выводить тип параметра, и на этом
 * можно налететь на «inconsistent types deduced». Проверить это здесь нечем —
 * в рабочем каталоге нет базы, — поэтому выбрана форма, где выводить нечего.
 *
 * Не бросает: путь закрытия партии не должен падать из-за кошелька. Но и не
 * молчит — исход возвращается вызывающему.
 */
export async function awardMatchChessy(
  matchId: string,
  userId: string,
  amount: number,
  displayName?: string | null,
): Promise<AwardOutcome> {
  const value = Math.floor(amount);
  if (!Number.isFinite(value) || value <= 0) return "already"; // платить нечего — долга нет
  const rows = await q(
    `WITH claim AS (
       INSERT INTO "CyberWalletAward" ("matchId","userId","amount")
       VALUES ($1,$2,$3)
       ON CONFLICT ("matchId","userId") DO NOTHING
       RETURNING "userId"
     ), paid AS (
       INSERT INTO "CyberWallet" ("userId","displayName","balance","earnedTotal","updatedAt")
       SELECT $2,$4,$5,$5,now() FROM claim
       ON CONFLICT ("userId") DO UPDATE SET
         "displayName"=COALESCE(EXCLUDED."displayName","CyberWallet"."displayName"),
         "balance"="CyberWallet"."balance"+EXCLUDED."balance",
         "earnedTotal"="CyberWallet"."earnedTotal"+EXCLUDED."earnedTotal",
         "updatedAt"=now()
       RETURNING "userId"
     )
     SELECT (SELECT count(*) FROM paid) AS credited`,
    [matchId, userId, value, displayName ?? null, value],
  );
  if (rows.length === 0) return "failed"; // q() проглотил ошибку — ответа нет
  return Number(rows[0]?.credited) > 0 ? "credited" : "already";
}

const CHESSY_WIN = 10, CHESSY_DRAW = 3, CHESSY_PLAYED = 1;

function chessyFor(result: string, side: "white" | "black"): number {
  if (result === "draw") return CHESSY_DRAW;
  return result === side ? CHESSY_WIN : CHESSY_PLAYED;
}

/**
 * С какого момента закрытую партию можно доплачивать.
 *
 * Ведомость отвечает на вопрос «заплачено ли» только про партии, закрытые после
 * её появления. У всех, что закончились раньше, строк нет — и доплата приняла бы
 * их за неоплаченные и заплатила ВТОРОЙ раз. Ровно тот дефект, ради устранения
 * которого всё и делалось, только вывернутый наизнанку.
 *
 * Граница — более ранний из двух моментов, оба безопасны:
 *   * первая запись в ведомости: всё, что после неё, ведомость уже покрывала;
 *   * старт хранилища в этом процессе: таблицы созданы, значит любая партия,
 *     закрытая после, писалась уже с ведомостью. Это же спасает случай, когда
 *     ведомость пуста именно потому, что самая первая выплата и не прошла.
 *
 * Кэшируется только НАСТОЯЩАЯ дата: она, единожды появившись, больше не
 * меняется. Пустую ведомость и неудачный запрос кэшировать нельзя — первое
 * навсегда оставило бы границу завышенной (первая выплата случится позже, а мы
 * бы об этом не узнали), второе от одного отказа запретило бы доплату совсем.
 */
async function repairBoundMs(): Promise<number> {
  if (ledgerStartAt == null) {
    const rows = await qOrNull(`SELECT min("paidAt") AS t FROM "CyberWalletAward"`, []);
    const t = rows && rows[0]?.t ? new Date(rows[0].t).getTime() : NaN;
    ledgerStartAt = Number.isFinite(t) ? t : null;
  }
  const fromLedger = ledgerStartAt == null ? Number.POSITIVE_INFINITY : ledgerStartAt;
  return Math.min(fromLedger, storeReadyAt || Date.now());
}

/**
 * Расплатиться с обоими игроками закрытой партии.
 *
 * Идемпотентна благодаря ведомости, поэтому её МОЖНО и НУЖНО звать и на пути
 * повтора — в этом и состоит починка. Конец партии сообщают оба клиента; если
 * первая попытка не смогла начислить, второй отчёт доплатит. Раньше замок на
 * строке матча закрывал и повтор тоже: неудачная выплата терялась навсегда,
 * оставляя после себя одну строку warning в логах.
 */
async function settleAwards(
  matchId: string,
  m: {
    whiteUserId?: string | null;
    blackUserId?: string | null;
    whiteName?: string | null;
    blackName?: string | null;
    result?: string | null;
  },
): Promise<void> {
  const result = m.result;
  if (result !== "white" && result !== "black" && result !== "draw") return;
  for (const side of ["white", "black"] as const) {
    const userId = side === "white" ? m.whiteUserId : m.blackUserId;
    if (!userId) continue;
    const amount = chessyFor(result, side);
    const outcome = await awardMatchChessy(matchId, userId, amount, side === "white" ? m.whiteName : m.blackName);
    if (outcome === "failed") {
      // Не «warning где-то в потоке»: строки в ведомости нет, поэтому партия
      // остаётся видимой в countUnpaidAwards() и будет доплачена следующим
      // отчётом о конце этой же партии.
      console.error(
        `[CyberMatchStore] award UNPAID match=${matchId} user=${userId} amount=${amount} — ведомость пуста, доплата ожидается следующим отчётом`,
      );
    }
  }
}

/**
 * Сколько закрытых партий не имеют полной пары строк в ведомости — то есть
 * сколько выплат зависло. `null` означает «спросить не удалось», и это НЕ то
 * же самое, что 0: отдавать ноль на упавшем запросе значит докладывать, что
 * долгов нет, когда на самом деле ничего не проверено.
 *
 * Нижняя граница по первой выплате в ведомости — чтобы счётчик не краснел на
 * партиях, закрытых ДО появления таблицы: они все без строк, и без границы
 * показатель был бы навсегда красным, а такой показатель перестают читать.
 * Пустая ведомость → граница now() → ноль, а не вся история.
 */
/**
 * Сколько кошельков не имеют ни одной рейтинговой партии.
 *
 * Кошелёк пополняется ровно в одном месте — на закрытии сетевой партии, где
 * пишется и рейтинг. Значит баланс у игрока без единой рейтинговой партии — это
 * след одного из двух: в боевые данные попала синтетика (проверочный прогон,
 * аудит), либо запись рейтинга не прошла, а выплата прошла.
 *
 * Повод для этой сверки не выдуман: 12.08.2026 на проде публичная Chessy-таблица
 * показывала двух игроков, `WalletProd1` и `WalletProd2`, при НУЛЕ игроков в
 * рейтинговой таблице. Заметить это можно было только руками, глядя на две
 * ручки сразу.
 *
 * `null` — спросить не удалось; это не ноль.
 */
/**
 * Кэш диагностических счётчиков.
 *
 * Обе сверки живут на ПУБЛИЧНОЙ ручке `/debug/stats`, и каждая — запрос к базе.
 * Без кэша посторонний получает дешёвый способ нагружать базу: один HTTP-вызов
 * оборачивается двумя полными сканами. Тридцати секунд достаточно — показатели
 * меняются от закрытия партии, а не ежесекундно.
 *
 * Кэшируется и `null`: «спросить не удалось» — тоже ответ, и повторять
 * неудачный запрос на каждый вызов тем более незачем.
 */
const COUNTER_TTL_MS = 30_000;
const counterCache = new Map<string, { at: number; value: number | null }>();

/** Сброс кэша для тестов: в одном процессе они переключают состояние базы. */
export function resetCounterCache(): void {
  counterCache.clear();
}

async function cachedCount(key: string, run: () => Promise<number | null>): Promise<number | null> {
  const hit = counterCache.get(key);
  if (hit && Date.now() - hit.at < COUNTER_TTL_MS) return hit.value;
  const value = await run();
  counterCache.set(key, { at: Date.now(), value });
  return value;
}

export async function countWalletsWithoutRatedGames(): Promise<number | null> {
  return cachedCount("walletsWithoutRatedGames", uncachedWalletsWithoutRatedGames);
}

async function uncachedWalletsWithoutRatedGames(): Promise<number | null> {
  const rows = await qOrNull(
    `SELECT count(*) AS n FROM "CyberWallet" w
      WHERE NOT EXISTS (
        SELECT 1 FROM "CyberRating" r WHERE r."userId" = w."userId" AND r."games" > 0
      )`,
    [],
  );
  if (rows === null) return null;
  const n = Number(rows[0]?.n);
  return Number.isFinite(n) ? n : null;
}

export async function countUnpaidAwards(): Promise<number | null> {
  return cachedCount("unpaidAwards", uncachedUnpaidAwards);
}

async function uncachedUnpaidAwards(): Promise<number | null> {
  const rows = await q(
    `SELECT count(*) AS n FROM "CyberMatch" m
      WHERE m."status"='ended'
        AND m."endedAt" >= COALESCE((SELECT min("paidAt") FROM "CyberWalletAward"), now())
        AND (SELECT count(*) FROM "CyberWalletAward" a WHERE a."matchId"=m."id") < 2`,
    [],
  );
  if (rows.length === 0) return null;
  const n = Number(rows[0]?.n);
  return Number.isFinite(n) ? n : null;
}

export interface WalletRow { userId: string; displayName: string | null; balance: number; earnedTotal: number }

/**
 * Баланс игрока. `null` — «спросить не удалось», и это НЕ ноль: ноль здесь
 * утверждает, что человек ничего не заработал. Отсутствие строки при живой
 * базе — честный ноль, он возвращается как строка с нулями.
 */
export async function getWallet(userId: string): Promise<WalletRow | null> {
  const rows = await qOrNull(`SELECT "userId","displayName","balance","earnedTotal" FROM "CyberWallet" WHERE "userId"=$1`, [userId]);
  if (rows === null) return null;
  const r = rows[0];
  return r
    ? { userId: r.userId, displayName: r.displayName, balance: Number(r.balance), earnedTotal: Number(r.earnedTotal) }
    : { userId, displayName: null, balance: 0, earnedTotal: 0 };
}

/**
 * Таблица балансов. `null` — «спросить не удалось». Пустой список означает
 * ровно то, что написано на экране: никто ещё не заработал.
 */
export async function getWalletLeaderboard(limit = 50): Promise<WalletRow[] | null> {
  const rows = await qOrNull(
    `SELECT "userId","displayName","balance","earnedTotal" FROM "CyberWallet" WHERE "balance">0 ORDER BY "balance" DESC LIMIT $1`,
    [Math.min(200, Math.max(1, limit))],
  );
  if (rows === null) return null;
  return rows.map((r) => ({ userId: r.userId, displayName: r.displayName, balance: Number(r.balance), earnedTotal: Number(r.earnedTotal) }));
}

/** Таблица рейтингов. `null` — спросить не удалось (пустой список значит «пусто»). */
export async function getLeaderboard(speed: string, limit = 50): Promise<RatingRow[] | null> {
  const rows = await qOrNull(
    `SELECT * FROM "CyberRating" WHERE "speed"=$1 AND "games">0 ORDER BY "rating" DESC LIMIT $2`,
    [speed, Math.min(200, Math.max(1, limit))],
  );
  if (rows === null) return null;
  return rows.map((r) => ({
    userId: r.userId, speed: r.speed, displayName: r.displayName,
    rating: Number(r.rating), rd: Number(r.rd), vol: Number(r.vol),
    games: Number(r.games), wins: Number(r.wins), losses: Number(r.losses),
    draws: Number(r.draws), peak: Number(r.peak),
  }));
}

/** История партий. `null` — спросить не удалось; пустой список значит «партий нет». */
export async function getHistory(userId: string, limit = 30): Promise<any[] | null> {
  return qOrNull(
    `SELECT "id","whiteUserId","whiteName","blackUserId","blackName","timeControl","speed",
            "status","result","termination","ply","movesSan","whiteRatingBefore","blackRatingBefore",
            "whiteRatingAfter","blackRatingAfter","createdAt","endedAt"
       FROM "CyberMatch"
      WHERE ("whiteUserId"=$1 OR "blackUserId"=$1) AND "status"='ended'
      ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, Math.min(100, Math.max(1, limit))],
  );
}
