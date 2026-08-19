// AEVION CyberChess — Tournaments router (extended MVP)
// Mount expected at: /api/cyberchess/tournaments (or /api/cyberchess-tournaments)
//
// Adds: Swiss + Round-robin formats, file-based persistence, duplicate
// registration check, result reporting, standings, next-round pairings.
//
// Persistence: data/cyberchess-tournaments.json (sync, lazy-loaded). If
// the directory is missing and can't be created, falls back to in-memory
// with graceful no-op writes.
//
// Real-player extension: tournaments may set `realPlayers: true` to opt
// into turn-by-turn pairing driven by the matchmaking module. The
// POST /:id/queue-match endpoint produces pairings for the next round
// based on previous round results. When `realPlayers: true`, each
// pairing is immediately materialised in the matchmaking layer via
// createPreMatchedMatch(), giving both players a live matchId + SSE
// notification + redirect URL.

import { Router, type Request, type Response } from "express";
import { clientIp } from "../lib/rateLimit";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getPool } from "../lib/dbPool";
import {
  createPreMatchedMatch,
  onMatchSettled,
  ALLOWED_TIME_CONTROLS,
  type TimeControl as MmTimeControl,
} from "./cyberchessMatchmaking";
import { makeServiceCapture } from "../lib/sentry/platform";
import { verifyWebhookSig } from "../lib/webhookSig";
import { requireProdSecret } from "../lib/qsignSecret";

const capture = makeServiceCapture("cyberchessTournaments");

// Result reporting shares the CyberChess webhook secret — same service, same
// sender as /api/cyberchess/tournament-finalized, so no second secret to
// rotate. Resolved lazily: throwing at module load would take the whole
// server down on a misconfigured deploy.
const getResultSecret = () => requireProdSecret("CYBERCHESS_WEBHOOK_SECRET", "dev-chess-webhook");

import { getRating, speedOf } from "./cyberchessMatchStore";

const router = Router();

// ── public types ───────────────────────────────────────────────────

export type TimeControl = "blitz" | "rapid" | "classic";
export type Status = "upcoming" | "live" | "finished";
export type MatchStatus = "scheduled" | "live" | "done";
export type Format = "single_elimination" | "swiss" | "round_robin";
export type Color = "white" | "black";
export type MatchResult = "white" | "black" | "draw";

export interface Player {
  id: string;
  name: string;
  rating: number;
  score: number; // running score (1 win / 0.5 draw / 0 loss)
  buchholz: number; // computed on demand for swiss tiebreak
  whiteCount: number;
  blackCount: number;
  opponentIds: string[];
  userId?: string; // when a real registered user is mapped onto this roster slot
}

export interface BracketMatch {
  id: string;
  round: number; // 1-based
  white: string | null;
  black: string | null;
  whiteScore: number | null;
  blackScore: number | null;
  status: MatchStatus;
  winner?: Color | "draw";
  // for swiss/RR — references player ids; for single-elim — display names
  whitePlayerId?: string | null;
  blackPlayerId?: string | null;
  // real-player extension: when tournament.realPlayers === true the
  // scheduler attaches the live matchmaking match id here.
  liveMatchId?: string | null;
  // viewer URLs published when a live match is created for this pairing
  viewerUrlWhite?: string | null;
  viewerUrlBlack?: string | null;
  // userIds of the participants when known (real-player mode)
  whiteUserId?: string | null;
  blackUserId?: string | null;
}

export interface BracketRound {
  name: string;
  round: number;
  matches: BracketMatch[];
}

export interface Tournament {
  id: string;
  title: string;
  format: Format;
  timeControl: TimeControl;
  eloMin: number;
  eloMax: number;
  players: number;
  maxPlayers: number;
  prizeChessy: number;
  status: Status;
  startsAt: string;
  description?: string;
  // format-specific
  swissRounds?: number; // total rounds for swiss
  currentRound?: number; // 1-based, points to round currently in play / next
  registeredUserIds: string[]; // duplicate-check
  /**
   * userId → ticket issued at registration. Persisted with the tournament:
   * the ticket is shown to the player as proof they are in, so it has to be
   * something the server can still recognise afterwards. Optional because
   * tournaments stored before this existed have no tickets.
   */
  tickets?: Record<string, string>;
  roster: Player[]; // active player roster (for swiss/RR)
  rounds: BracketRound[]; // all generated rounds so far
  // real-player extension (default false → legacy behaviour preserved)
  realPlayers?: boolean;
  /**
   * Кто завёл турнир: `seed` — фикстура из кода, `user` — кто угодно через
   * POST /. Создание открыто и не требует входа (ограничено пятью в десять
   * минут с адреса), а приз объявляется в теле запроса — до десяти миллионов
   * Chessy. Платит призы только подписанный вебхук, то есть объявленное число
   * ничем не обеспечено; на публичной странице такой турнир при этом несёт
   * самую сильную подпись — «настоящие игроки».
   *
   * Отличать по префиксу `usr-` в идентификаторе нельзя: это совпадение имени,
   * а не признак. Отсутствует у турниров, сохранённых до появления поля.
   */
  origin?: "seed" | "user";
}

// ── persistence layer ──────────────────────────────────────────────

// Overridable so a test run can point the store at a scratch directory. The
// real file is committed to the repository and holds live registrations and
// results — a suite that rewrites it would look green while destroying data.
const DATA_DIR = process.env.CYBERCHESS_TOURNAMENTS_DIR
  ? path.resolve(process.env.CYBERCHESS_TOURNAMENTS_DIR)
  : path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "cyberchess-tournaments.json");

/**
 * Пауза записи после отказа. Ноль — пишем. См. tryWriteToDisk: раньше здесь
 * стояла защёлка «больше не пытаться», из-за которой один временный сбой
 * оставлял все последующие регистрации только в памяти.
 */
let persistPausedUntil = 0;
/** Подряд идущие отказы — чтобы жаловаться в лог не один раз и всё громче. */
let persistFailures = 0;
const PERSIST_RETRY_MS = 60_000;
let TOURNAMENTS: Tournament[] = [];

// ⚠️ ПОПРАВКА 13.08 (вечер): причина ниже описана НЕВЕРНО.
// У сервиса на Railway примонтирован постоянный том `aevion-volume` по пути
// `/app/aevion-globus-backend/data` — ровно туда, где лежит этот файл. Проверено
// командой `railway volume list`. Значит деплой файл НЕ стирает, и мотивировка
// «файловая система контейнера временная» к нам не относится.
//
// Что остаётся верным и ради чего этот код всё же нужен:
//   * вторая копия в базе, независимая от тома (том привязан к сервису: пересоздали
//     сервис — тома нет);
//   * состояние становится запрашиваемым и попадает в бэкапы Postgres;
//   * при нескольких процессах строка-на-объект корректна, а файл целиком — нет.
// Срочности, которую я приписал этой работе, не было. Полезность осталась.
// ── Postgres как основное хранилище, файл — запасное ────────────────
//
// ЗАЧЕМ. Файловая система контейнера временная: при каждом деплое Railway
// поднимает новый контейнер из образа, то есть с той версией файла, что лежит в
// репозитории. Всё, что игроки нарегистрировали и наиграли с прошлого деплоя,
// откатывалось к состоянию из git — не с ошибкой, а молча. Плюс реплик бывает
// больше одной (замер в docs/RATELIMIT_KNOWN_LIMITATIONS.md), и тогда
// регистрация, попавшая в один процесс, невидима другому.
//
// УСТРОЙСТВО. Состояние хранится целиком, одной строкой JSONB, — той же
// гранулярностью, что и файл, чтобы не заводить второй способ описывать одно и
// то же. `savedAt` решает, кто свежее: база или файл. Без DATABASE_URL всё
// работает ровно как раньше, на файле.
//
// ЧЕГО ЭТО НЕ РЕШАЕТ, честно: одновременная запись из двух реплик по-прежнему
// "кто последний, тот и прав" на уровне всего состояния. Это следующий шаг —
// построчное хранение турниров; сейчас закрыта потеря при деплое, которая
// случается каждый день, а не гонка, которая требует совпадения по секундам.
let dbPool: any = null;
let dbTried = false;
/** Что фактически произошло с базой — чтобы первый деплой ОТВЕТИЛ, а не мы предположили. */
const dbHealth = { configured: false, connected: false, adoptedFromDb: false, abandoned: false, saves: 0, rowsWritten: 0, saveErrors: 0, retries: 0, lastErrorKind: null as string | null };

/**
 * Повтор зеркалирования в базу после сбоя.
 *
 * Запись в базу не ждут (void saveToDb) — путь регистрации не должен зависеть
 * от скорости базы. Обратная сторона: единичный обрыв сети раньше означал, что
 * зеркало молча отстало, и узнать об этом можно было только по счётчику ошибок,
 * на который никто не смотрит. У файла повтор был всегда (PERSIST_RETRY_MS), у
 * базы — нет.
 *
 * Повторяем ТЕКУЩЕЕ состояние, а не упавший снимок: пока ждали, могли прийти
 * новые изменения, и запись старого снимка либо была бы отклонена сторожем
 * savedAtMs, либо (что хуже) откатила бы свежее.
 */
const DB_RETRY_MS = Number(process.env.CYBERCHESS_DB_RETRY_MS ?? 20_000);
let dbRetryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDbRetry(): void {
  if (dbRetryTimer) return; // одна попытка в полёте: иначе каждая ошибка плодит свой таймер
  dbRetryTimer = setTimeout(() => {
    dbRetryTimer = null;
    dbHealth.retries += 1;
    void saveToDb(TOURNAMENTS, savedAtMs);
  }, DB_RETRY_MS);
  // unref: таймер не должен держать процесс живым — иначе скрипты проверки и
  // тесты перестанут завершаться, а причина будет выглядеть как зависание.
  dbRetryTimer.unref?.();
}
/** Момент последнего сохранения состояния — по нему выбирается свежая копия. */
let savedAtMs = 0;

/**
 * Ошибка базы, сведённая к КАТЕГОРИИ.
 *
 * Ручка `_persistence` публичная, а сырое сообщение pg содержит инфраструктуру:
 * «connect ECONNREFUSED 10.0.0.5:5432», «password authentication failed for
 * user "aevion"», «database "x" does not exist». Я сам написал в коммите, что
 * диагностика не должна выдавать то, что считает, — и тут же оставил текст
 * ошибки наружу. Полное сообщение уходит в лог, наружу едет только слово.
 */
function dbErrorKind(e: unknown): "connect" | "auth" | "timeout" | "schema" | "query" {
  const m = (e as Error)?.message?.toLowerCase() ?? "";
  if (m.includes("econnrefused") || m.includes("enotfound") || m.includes("ehostunreach")) return "connect";
  if (m.includes("password") || m.includes("authentication") || m.includes("role ")) return "auth";
  if (m.includes("timeout") || m.includes("terminated")) return "timeout";
  if (m.includes("does not exist") || m.includes("column") || m.includes("relation")) return "schema";
  return "query";
}

async function ensureTournamentDb(): Promise<any> {
  if (dbTried) return dbPool;
  dbTried = true;
  if (!process.env.DATABASE_URL) return null;
  dbHealth.configured = true;
  try {
    // Общий пул из lib/dbPool, а не свой: в нём уже настроены таймауты
    // (подключение 5 с, запрос 10 с) и keep-alive. Свой пул без них означал
    // бы, что при недоступной базе запрос висит сколько угодно — а ожидание
    // готовности стоит перед ВСЕМИ маршрутами модуля, то есть повис бы весь
    // модуль вместо того, чтобы честно работать на файле. Плюс это второй
    // способ делать то, что в репозитории уже делается одним.
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CyberTournament" (
        "id"        TEXT PRIMARY KEY,
        "data"      JSONB NOT NULL,
        -- Миллисекунды числом, а не TIMESTAMP. У колонки без часового пояса
        -- смысл зависит от того, кто её читает: драйвер разбирает такое
        -- значение в поясе КЛИЕНТА, а писал его сервер в своём. Разница в часах
        -- — и сравнение «что свежее, файл или база» молча даёт неверный ответ:
        -- старая копия побеждает новую. Число не зависит ни от чьего пояса.
        "savedAtMs" BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "cybertournament_savedat_idx" ON "CyberTournament" ("savedAtMs" DESC);
    `);
    dbPool = pool;
    dbHealth.connected = true;
    console.log("[cyberchess-tournaments] pg connected — состояние турниров переживёт деплой");
    return pool;
  } catch (e) {
    console.warn("[cyberchess-tournaments] pg init failed:", (e as Error).message);
    return null;
  }
}

/** Прочитать состояние из базы. null — нечего или не смогли (это разные вещи в логе). */
async function loadFromDb(): Promise<{ tournaments: Tournament[]; savedAtMs: number } | null> {
  const pool = await ensureTournamentDb();
  if (!pool) return null;
  try {
    const r = await pool.query(`SELECT "data","savedAtMs" FROM "CyberTournament"`);
    const rows = r.rows ?? [];
    if (rows.length === 0) return null;
    const list: Tournament[] = [];
    let newest = 0;
    for (const row of rows) {
      if (!row?.data || typeof row.data.id !== "string") continue; // строка не той формы — пропускаем её, а не весь набор
      list.push(row.data as Tournament);
      const t = Number(row.savedAtMs);
      if (Number.isFinite(t) && t > newest) newest = t;
    }
    if (list.length === 0) {
      console.error("[cyberchess-tournaments] в базе есть строки, но ни одной разобранной — беру файл");
      return null;
    }
    return { tournaments: list, savedAtMs: newest };
  } catch (e) {
    console.error("[cyberchess-tournaments] чтение состояния из базы не прошло:", (e as Error).message);
    return null;
  }
}

/** Зеркалировать состояние в базу. Не бросает: путь регистрации не должен падать из-за базы. */
async function saveToDb(list: Tournament[], stamp: number): Promise<void> {
  if (dbHealth.abandoned) return; // см. storeReadyBounded: писать поверх неизвестного нельзя
  const pool = await ensureTournamentDb();
  if (!pool) return;
  try {
    // СТРОКА НА ТУРНИР, а не одно состояние целиком.
    //
    // Целиком было структурно неверно при двух живых процессах — а это каждый
    // деплой, пока старая реплика ещё дослуживает. Обе держат ПОЛНУЮ копию в
    // памяти: реплика A записывает свой набор со своим новым турниром,
    // реплика B следом записывает свой — без него. Турнир исчезает, и это не
    // редкая гонка, а обычный ход событий.
    //
    // По строкам конфликтуют только правки ОДНОГО турнира; разные турниры
    // независимы. Условие на savedAt оставлено и здесь: оно защищает от
    // прихода сохранений не в том порядке (запись намеренно не блокирует
    // ответ игроку).
    //
    // Здесь удаления нет намеренно: строку, которой нет в памяти ЭТОГО
    // процесса, нельзя считать лишней — её мог только что завести сосед.
    // Удаление живёт отдельно, по явной команде: см. deleteFromDb и
    // DELETE /:id ниже.
    // Считаем ЗАПИСАННЫЕ СТРОКИ, а не проходы функции. Тот же дефект, что
    // найден мутацией в задаче дня 18.08.2026: saves рос один раз за вызов,
    // если тот не бросил исключение, — то есть подтверждал отсутствие
    // исключения, а не запись. На пустом списке турниров или при отклонённой
    // сторожем savedAtMs записи он рос бы ровно так же, и диагностика отвечала
    // бы «записей N» при нетронутой базе.
    let written = 0;
    for (const t of list) {
      const r = await pool.query(
        `INSERT INTO "CyberTournament" ("id","data","savedAtMs") VALUES ($1,$2,$3)
         ON CONFLICT ("id") DO UPDATE SET "data"=EXCLUDED."data","savedAtMs"=EXCLUDED."savedAtMs"
         WHERE "CyberTournament"."savedAtMs" <= EXCLUDED."savedAtMs"`,
        [t.id, JSON.stringify(t), stamp],
      );
      written += r.rowCount ?? 0;
    }
    dbHealth.rowsWritten += written;
    if (written > 0) dbHealth.saves += 1;
  } catch (e) {
    dbHealth.saveErrors += 1;
    dbHealth.lastErrorKind = dbErrorKind(e);
    console.error(
      `[cyberchess-tournaments] запись состояния в базу не прошла, повтор через ${DB_RETRY_MS / 1000} с:`,
      (e as Error).message,
    );
    scheduleDbRetry();
  }
}


/**
 * Файл есть, но прочитать его не удалось. Это НЕ «файла нет».
 *
 * Раньше оба случая возвращали null, а initStore на null писал на диск
 * ФИКСТУРЫ. То есть одна ошибка чтения — испорченный JSON, нехватка прав,
 * неожиданная форма содержимого — заменяла все регистрации и результаты
 * демо-турнирами прямо на старте процесса, без чьего-либо участия и без единого
 * сообщения. Атомарная запись через переименование, о которой сказано ниже,
 * защищает только от обрыва посреди записи, а не от остальных причин.
 */
let storeDegraded = false;

type LoadResult = { ok: true; tournaments: Tournament[] | null } | { ok: false };

function tryLoadFromDisk(): LoadResult {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: true, tournaments: null }; // файла нет — честно пусто
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.tournaments)) {
      const t = parsed.savedAt ? new Date(parsed.savedAt).getTime() : 0;
      savedAtMs = Number.isFinite(t) ? t : 0;
    }
    if (!Array.isArray(parsed?.tournaments)) {
      console.error("[cyberchess-tournaments] файл есть, но не той формы — содержимое неизвестно, запись заблокирована");
      return { ok: false };
    }
    return { ok: true, tournaments: parsed.tournaments as Tournament[] };
  } catch (e) {
    console.error("[cyberchess-tournaments] файл не прочитан — запись заблокирована, чтобы не заменить его фикстурами:", (e as Error).message);
    capture(e);
    return { ok: false };
  }
}

/**
 * Удалить турнир из базы. Отдельная функция и отдельный путь — потому что
 * «нет в памяти этого процесса» никогда не значит «лишний»: строку мог секунду
 * назад завести сосед. Удаление происходит только по явной команде человека
 * (админская ручка ниже), и только по конкретному идентификатору.
 */
async function deleteFromDb(id: string): Promise<void> {
  if (dbHealth.abandoned) return;
  const pool = await ensureTournamentDb();
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM "CyberTournament" WHERE "id"=$1`, [id]);
  } catch (e) {
    dbHealth.saveErrors += 1;
    dbHealth.lastErrorKind = dbErrorKind(e);
    console.error("[cyberchess-tournaments] удаление строки из базы не прошло:", (e as Error).message);
  }
}

/** Состояние хранилища турниров — читает, ничего не меняет. */
export function tournamentStoreDegraded(): boolean {
  return storeDegraded;
}

/**
 * Пока файл не читается, модуль не работает целиком: отдавать фикстуры вместо
 * настоящих турниров нельзя (это выдуманные данные под видом живых), а копить
 * изменения в памяти бессмысленно — сохранить их всё равно некуда. Каждый
 * запрос сначала пробует перечитать: причина обычно временная.
 */
function degradedGuard(_req: Request, res: Response, next: () => void): void {
  if (!storeDegraded) return next();
  const retry = tryLoadFromDisk();
  if (retry.ok) {
    storeDegraded = false;
    // Та же развилка, что и при первой загрузке: фикстуры только если файла
    // нет вовсе (`null`). Пустой список — сохранённое состояние.
    TOURNAMENTS = retry.tournaments ?? buildSeedFixtures();
    return next();
  }
  res.status(503).json({ ok: false, error: "tournaments_store_unavailable" });
}

function tryWriteToDisk(): void {
  // Пауза после отказа, а не отключение навсегда.
  //
  // Раньше первая же неудачная запись ставила PERSIST_OK в false «graceful
  // no-op for subsequent writes» — и с этой секунды регистрации и результаты
  // жили только в памяти процесса. Отличить это состояние снаружи нельзя:
  // ручки отвечают 200, игрок видит себя в списке участников, а после
  // перезапуска не находит ни себя, ни турнира. Причина отказа обычно
  // временная (полный диск, права, гонка на переименовании), но защёлка
  // не давала попробовать снова НИ РАЗУ до перезапуска.
  if (persistPausedUntil > Date.now()) return;
  if (storeDegraded) return; // содержимое файла неизвестно — не затираем его
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Atomic write: serialize to a temp file then rename over the target, so a
    // crash/redeploy mid-write can never leave a truncated JSON that silently
    // falls back to seed fixtures (losing every registration/result).
    const tmp = `${DATA_FILE}.tmp`;
    savedAtMs = Date.now();
    fs.writeFileSync(
      tmp,
      // savedAt едет в самом файле: по нему решается, что свежее — он или база.
      JSON.stringify({ savedAt: new Date(savedAtMs).toISOString(), tournaments: TOURNAMENTS }, null, 2),
      "utf-8",
    );
    fs.renameSync(tmp, DATA_FILE);
    // Зеркало в базе: файловая система контейнера временная, база переживает
    // деплой. Не ждём — путь регистрации не должен зависеть от скорости базы.
    void saveToDb(TOURNAMENTS, savedAtMs);
    // Запись удалась — прошлые отказы больше ничего не значат.
    persistFailures = 0;
    persistPausedUntil = 0;
  } catch (e) {
    persistFailures += 1;
    persistPausedUntil = Date.now() + PERSIST_RETRY_MS;
    // Жалуемся КАЖДЫЙ раз, а не единожды при переходе в отказ: пока запись не
    // проходит, турнирные данные живут только в памяти этого процесса, и
    // молчание после первой строки читалось бы как «всё наладилось».
    console.error(
      `[cyberchess-tournaments] запись не прошла (${persistFailures} подряд), следующая попытка через ${PERSIST_RETRY_MS / 1000} с — регистрации и результаты сейчас только в памяти процесса:`,
      (e as Error).message,
    );
  }
}

/** Состояние записи на диск — для диагностики; читает, ничего не меняет. */
export function tournamentPersistenceState(): {
  healthy: boolean;
  consecutiveFailures: number;
  pausedForMs: number;
  db: typeof dbHealth;
} {
  const pausedForMs = Math.max(0, persistPausedUntil - Date.now());
  return {
    healthy: persistFailures === 0,
    consecutiveFailures: persistFailures,
    pausedForMs,
    // Состояние базы отдаётся наружу намеренно: запросы к Postgres здесь ни
    // разу не выполнялись на настоящем сервере — локально его нет. Значит
    // ответить, работает ли перенос, должен первый же деплой, а не наша вера в
    // правильность SQL. Числа, не данные: имён и содержимого тут нет.
    db: { ...dbHealth },
  };
}

/**
 * Показанные сейчас турниры — это заглушка (фикстуры на пустом томе), а не
 * сохранённое состояние. Пока признак стоит, писать их никуда нельзя: они
 * затрут настоящие данные в базе.
 */
let seedsArePlaceholder = false;

function initStore(): void {
  const result = tryLoadFromDisk();
  if (!result.ok) {
    // Содержимое файла неизвестно. Ни писать поверх, ни выдавать фикстуры за
    // настоящие турниры нельзя — модуль отвечает отказом, пока файл не
    // прочитается (см. degradedGuard).
    storeDegraded = true;
    TOURNAMENTS = [];
    return;
  }
  const loaded = result.tournaments;
  // `null` — файла нет, состояния никогда не было: тогда и только тогда
  // фикстуры. Пустой массив — это СОСТОЯНИЕ: человек удалил последний турнир.
  // Пока здесь стояло `length > 0`, оба случая означали «подставить двенадцать
  // демо-турниров», то есть уборка отменяла сама себя при следующем запуске —
  // молча, без единой ошибки в логе.
  if (loaded) {
    TOURNAMENTS = loaded;
    // backfill new fields on legacy persisted data
    for (const t of TOURNAMENTS) {
      if (typeof t.realPlayers === "undefined") t.realPlayers = false;
      // Происхождение дозаполняется ЗДЕСЬ, а не в каждом читателе. Список
      // считал запасное значение сам, а ручка одного турнира отдаёт объект как
      // есть — и страница этого турнира осталась бы без подписи именно у тех
      // записей, ради которых запасное правило и писалось. Один раз при
      // загрузке — и все читатели видят одно и то же.
      if (typeof t.origin === "undefined") t.origin = t.id.startsWith("usr-") ? "user" : "seed";
    }
    return;
  }
  // Файла нет вовсе — так выглядит СВЕЖИЙ КОНТЕЙНЕР: том пуст, а база жива.
  // Фикстуры здесь не состояние, а заглушка на те секунды, пока не ответила
  // база. Поэтому:
  //   • savedAtMs остаётся 0 — иначе заглушка объявляет себя свежее базы;
  //   • на диск и в базу ничего не пишем, пока база не ответила.
  //
  // Раньше здесь стоял tryWriteToDisk(), и он ставил savedAtMs = Date.now().
  // Живой прогон 18.08.2026 показал последствие: на пустом томе модуль не
  // поднимал состояние из базы (adoptedFromDb: false), показывал двенадцать
  // фикстур и ЗАПИСЫВАЛ их в базу поверх настоящих турниров — у фикстур штамп
  // всегда новее. То есть ровно та потеря, ради предотвращения которой всё
  // хранилище и делалось.
  TOURNAMENTS = buildSeedFixtures();
  seedsArePlaceholder = true;
  savedAtMs = 0;
}

// ── seed fixtures (2 per format) ───────────────────────────────────

function mkPlayer(name: string, rating: number, idx: number): Player {
  return {
    id: `pl_${idx.toString().padStart(3, "0")}_${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    name,
    rating,
    score: 0,
    buchholz: 0,
    whiteCount: 0,
    blackCount: 0,
    opponentIds: [],
  };
}

function buildSeedFixtures(): Tournament[] {
  // --- single elimination #1 (legacy) ---
  const elim1: Tournament = {
    id: "spring-blitz-01",
    title: "Spring Blitz Open",
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1800,
    eloMax: 2400,
    players: 87,
    maxPlayers: 128,
    prizeChessy: 50_000,
    status: "upcoming",
    startsAt: "2026-05-18T19:00:00Z",
    description: "Открытый блиц-турнир с накопительным призовым фондом в Chessy.",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
    origin: "seed",
  };

  const elim2: Tournament = {
    id: "weekly-rapid-22",
    title: "Weekly Rapid #22",
    format: "single_elimination",
    timeControl: "rapid",
    eloMin: 1500,
    eloMax: 2200,
    players: 64,
    maxPlayers: 64,
    prizeChessy: 25_000,
    status: "live",
    startsAt: "2026-05-15T18:30:00Z",
    description: "Еженедельный рапид-турнир. Идёт прямо сейчас.",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
    origin: "seed",
  };

  // --- swiss #1 (8-player, 5 rounds) ---
  const swissRoster1 = [
    mkPlayer("Capablanca_bot", 2410, 1),
    mkPlayer("TalLegacy", 2350, 2),
    mkPlayer("NimzoIndian", 2280, 3),
    mkPlayer("ZugzwangFan", 2220, 4),
    mkPlayer("BulletDemon", 2180, 5),
    mkPlayer("EndgameKnight", 2120, 6),
    mkPlayer("Petroff_King", 2050, 7),
    mkPlayer("Sicilian_Dragon", 1980, 8),
  ];
  const swiss1: Tournament = {
    id: "swiss-arena-may",
    title: "Swiss Arena — Май",
    format: "swiss",
    timeControl: "rapid",
    eloMin: 1900,
    eloMax: 2500,
    players: swissRoster1.length,
    maxPlayers: 16,
    prizeChessy: 40_000,
    status: "live",
    startsAt: "2026-05-16T18:00:00Z",
    description: "Швейцарка на 5 туров с buchholz-тайбрейком.",
    swissRounds: 5,
    currentRound: 1,
    registeredUserIds: [],
    roster: swissRoster1,
    rounds: [],
    realPlayers: false,
    origin: "seed",
  };
  // generate first round so /next-round and /standings have data
  swiss1.rounds = [
    {
      name: "Тур 1",
      round: 1,
      matches: pairSwissRound(swiss1.roster, 1, []).map((m, i) => ({
        ...m,
        id: `${swiss1.id}-r1-${i + 1}`,
      })),
    },
  ];

  // --- swiss #2 (10-player blitz) ---
  const swissRoster2 = [
    mkPlayer("ShadowKnight_2400", 2400, 11),
    mkPlayer("TacticalRose", 2330, 12),
    mkPlayer("QueenSac_99", 2270, 13),
    mkPlayer("GMPrep_22", 2210, 14),
    mkPlayer("PositionalGuru", 2150, 15),
    mkPlayer("BishopPair", 2090, 16),
    mkPlayer("PawnStorm_1900", 1950, 17),
    mkPlayer("Rookie_2050", 2050, 18),
    mkPlayer("OpeningTheory", 1880, 19),
    mkPlayer("Blunderpunk", 1820, 20),
  ];
  const swiss2: Tournament = {
    id: "swiss-blitz-friday",
    title: "Swiss Blitz Friday",
    format: "swiss",
    timeControl: "blitz",
    eloMin: 1600,
    eloMax: 2500,
    players: swissRoster2.length,
    maxPlayers: 32,
    prizeChessy: 18_000,
    status: "upcoming",
    startsAt: "2026-05-22T20:00:00Z",
    description: "7 туров швейцарки, блиц 3+2.",
    swissRounds: 7,
    currentRound: 0,
    registeredUserIds: [],
    roster: swissRoster2,
    rounds: [],
    realPlayers: false,
    origin: "seed",
  };

  // --- round-robin #1 (8-player) ---
  const rrRoster1 = [
    mkPlayer("Capablanca_bot", 2410, 31),
    mkPlayer("TalLegacy", 2350, 32),
    mkPlayer("NimzoIndian", 2280, 33),
    mkPlayer("ZugzwangFan", 2220, 34),
    mkPlayer("BulletDemon", 2180, 35),
    mkPlayer("EndgameKnight", 2120, 36),
    mkPlayer("Petroff_King", 2050, 37),
    mkPlayer("Sicilian_Dragon", 1980, 38),
  ];
  const rr1: Tournament = {
    id: "classic-rr-may",
    title: "Classical Round-robin — May",
    format: "round_robin",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: rrRoster1.length,
    maxPlayers: 8,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14T12:00:00Z",
    description: "Полный круг 8 игроков, классический контроль.",
    currentRound: 1,
    registeredUserIds: [],
    roster: rrRoster1,
    rounds: buildRoundRobinSchedule(rr1RosterToIds(rrRoster1), "classic-rr-may"),
    realPlayers: false,
    origin: "seed",
  };

  // --- round-robin #2 (6-player rapid) ---
  const rrRoster2 = [
    mkPlayer("TacticalRose", 2330, 41),
    mkPlayer("QueenSac_99", 2270, 42),
    mkPlayer("GMPrep_22", 2210, 43),
    mkPlayer("PositionalGuru", 2150, 44),
    mkPlayer("BishopPair", 2090, 45),
    mkPlayer("Rookie_2050", 2050, 46),
  ];
  const rr2: Tournament = {
    id: "rapid-rr-mini",
    title: "Mini Rapid Round-robin",
    format: "round_robin",
    timeControl: "rapid",
    eloMin: 1900,
    eloMax: 2400,
    players: rrRoster2.length,
    maxPlayers: 6,
    prizeChessy: 22_000,
    status: "upcoming",
    startsAt: "2026-05-19T16:00:00Z",
    description: "6 игроков, круговая система, рапид 10+5.",
    currentRound: 0,
    registeredUserIds: [],
    roster: rrRoster2,
    rounds: buildRoundRobinSchedule(rr1RosterToIds(rrRoster2), "rapid-rr-mini"),
    realPlayers: false,
    origin: "seed",
  };

  // --- extras kept from legacy mock list (single elim) ---
  const elimLegacy3: Tournament = {
    id: "classic-arena-may",
    title: "Classical Arena — May",
    format: "single_elimination",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: 32,
    maxPlayers: 32,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14T12:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
    origin: "seed",
  };
  const elimLegacy4: Tournament = {
    id: "bullet-storm-7",
    title: "Bullet Storm #7",
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1200,
    eloMax: 2600,
    players: 211,
    maxPlayers: 256,
    prizeChessy: 15_000,
    status: "upcoming",
    startsAt: "2026-05-16T21:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: false,
    origin: "seed",
  };
  const elimLegacy5: Tournament = {
    id: "veterans-cup",
    title: "Veterans Cup (40+)",
    format: "single_elimination",
    timeControl: "rapid",
    eloMin: 1600,
    eloMax: 2400,
    players: 48,
    maxPlayers: 64,
    prizeChessy: 35_000,
    status: "upcoming",
    startsAt: "2026-05-20T17:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: false,
    origin: "seed",
  };
  const elimLegacy6: Tournament = {
    id: "winter-arena-12",
    title: "Winter Arena #12",
    format: "single_elimination",
    timeControl: "classic",
    eloMin: 1900,
    eloMax: 2700,
    players: 16,
    maxPlayers: 16,
    prizeChessy: 80_000,
    status: "finished",
    startsAt: "2026-04-30T15:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
    origin: "seed",
  };
  const elimLegacy7: Tournament = {
    id: "newbies-rapid",
    title: "Newbies Rapid Friendly",
    format: "single_elimination",
    timeControl: "rapid",
    eloMin: 800,
    eloMax: 1500,
    players: 22,
    maxPlayers: 64,
    prizeChessy: 5_000,
    status: "upcoming",
    startsAt: "2026-05-17T14:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: false,
    origin: "seed",
  };

  // --- real-player demo tournament (small swiss, realPlayers=true) ---
  const realDemoRoster = [
    mkPlayer("Демо-Алиса", 1700, 91),
    mkPlayer("Демо-Боб", 1720, 92),
    mkPlayer("Демо-Карл", 1680, 93),
    mkPlayer("Демо-Дина", 1740, 94),
  ];
  const realDemo: Tournament = {
    id: "real-swiss-demo",
    title: "Real Players Swiss (демо)",
    format: "swiss",
    timeControl: "rapid",
    eloMin: 1500,
    eloMax: 2000,
    players: 0,
    maxPlayers: 8,
    prizeChessy: 1_000,
    status: "upcoming",
    startsAt: "2026-05-19T18:00:00Z",
    description: "Демо-турнир с реальными игроками. Регистрация открыта.",
    swissRounds: 3,
    currentRound: 0,
    registeredUserIds: [],
    roster: realDemoRoster,
    rounds: [],
    realPlayers: true,
  };

  return [
    elim1,
    elim2,
    swiss1,
    swiss2,
    rr1,
    rr2,
    elimLegacy3,
    elimLegacy4,
    elimLegacy5,
    elimLegacy6,
    elimLegacy7,
    realDemo,
  ];
}

function rr1RosterToIds(roster: Player[]): string[] {
  return roster.map((p) => p.id);
}

// ── legacy elim rounds (kept for backwards-compat sample data) ─────

function buildLegacyElimRounds(): BracketRound[] {
  return [
    {
      name: "1/8 финала",
      round: 1,
      matches: [
        { id: "r1-1", round: 1, white: "ShadowKnight_2400", black: "PawnStorm_1900", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r1-2", round: 1, white: "EndgameKnight", black: "Rookie_2050", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-3", round: 1, white: "TacticalRose", black: "BishopPair", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r1-4", round: 1, white: "PositionalGuru", black: "QueenSac_99", whiteScore: 1, blackScore: 2, status: "done", winner: "black" },
        { id: "r1-5", round: 1, white: "BulletDemon", black: "ZugzwangFan", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-6", round: 1, white: "Capablanca-bot", black: "NimzoIndian", whiteScore: 0, blackScore: 2, status: "done", winner: "black" },
        { id: "r1-7", round: 1, white: "TalLegacy", black: "Petroff_King", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-8", round: 1, white: "GMPrep_22", black: "Sicilian_Dragon", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
      ],
    },
    {
      name: "1/4 финала",
      round: 2,
      matches: [
        { id: "r2-1", round: 2, white: "ShadowKnight_2400", black: "EndgameKnight", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r2-2", round: 2, white: "TacticalRose", black: "QueenSac_99", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r2-3", round: 2, white: "BulletDemon", black: "NimzoIndian", whiteScore: 1, blackScore: 1, status: "live" },
        { id: "r2-4", round: 2, white: "TalLegacy", black: "GMPrep_22", whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
    {
      name: "1/2 финала",
      round: 3,
      matches: [
        { id: "r3-1", round: 3, white: "ShadowKnight_2400", black: "TacticalRose", whiteScore: null, blackScore: null, status: "scheduled" },
        { id: "r3-2", round: 3, white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
    {
      name: "Финал",
      round: 4,
      matches: [
        { id: "r4-1", round: 4, white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
  ];
}

// ── swiss pairing (buchholz-tiebreak, no rematches, color-balance) ─

/**
 * Pair the next swiss round.
 *
 * @param players  current roster with running scores
 * @param round    round number to pair (1-based)
 * @param history  prior bracket rounds (used to detect rematches/colour balance)
 * @returns        array of BracketMatch entries for the new round (id placeholder, caller assigns)
 */
export function pairSwissRound(
  players: Player[],
  round: number,
  history: BracketRound[],
): BracketMatch[] {
  if (players.length < 2) return [];

  // 1. sort by score desc, then rating desc (round 1 just uses rating)
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.rating - a.rating;
  });

  // 2. precompute prior opponent set + colour balance per player
  const playedAgainst = new Map<string, Set<string>>();
  const colourBalance = new Map<string, number>(); // white=+1, black=-1
  for (const p of players) {
    playedAgainst.set(p.id, new Set(p.opponentIds));
    colourBalance.set(p.id, (p.whiteCount ?? 0) - (p.blackCount ?? 0));
  }
  // history fallback in case roster wasn't updated
  for (const r of history) {
    for (const m of r.matches) {
      if (m.whitePlayerId && m.blackPlayerId) {
        playedAgainst.get(m.whitePlayerId)?.add(m.blackPlayerId);
        playedAgainst.get(m.blackPlayerId)?.add(m.whitePlayerId);
      }
    }
  }

  // 3. greedy pairing with backtracking
  const used = new Set<string>();
  const matches: BracketMatch[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;

    // candidate = next un-paired who hasn't played `a`; fallback: just next un-paired
    let opponent: Player | null = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (used.has(b.id)) continue;
      if (playedAgainst.get(a.id)?.has(b.id)) continue;
      opponent = b;
      break;
    }
    if (!opponent) {
      // accept rematch as last resort
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (!used.has(b.id)) {
          opponent = b;
          break;
        }
      }
    }
    if (!opponent) {
      // bye (odd count)
      matches.push({
        id: "pending",
        round,
        white: a.name,
        black: null,
        whitePlayerId: a.id,
        blackPlayerId: null,
        whiteScore: 1,
        blackScore: null,
        status: "done",
        winner: "white",
      });
      used.add(a.id);
      continue;
    }

    // colour balance: prefer giving white to the one with more blacks
    const aBalance = colourBalance.get(a.id) ?? 0;
    const bBalance = colourBalance.get(opponent.id) ?? 0;
    let whitePlayer = a;
    let blackPlayer = opponent;
    if (aBalance > bBalance) {
      whitePlayer = opponent;
      blackPlayer = a;
    }
    matches.push({
      id: "pending",
      round,
      white: whitePlayer.name,
      black: blackPlayer.name,
      whitePlayerId: whitePlayer.id,
      blackPlayerId: blackPlayer.id,
      whiteScore: null,
      blackScore: null,
      status: "scheduled",
    });
    used.add(a.id);
    used.add(opponent.id);
  }

  return matches;
}

// ── round-robin (Berger tables for 4 / 6 / 8 / 16) ────────────────

/**
 * Build a full round-robin schedule using Berger tables. Supports
 * 4, 6, 8 and 16 players. For odd counts a "bye" slot is inserted.
 */
export function buildRoundRobinSchedule(
  playerIds: string[],
  tournamentId: string,
): BracketRound[] {
  const n0 = playerIds.length;
  const ids = [...playerIds];
  let bye = false;
  if (n0 % 2 === 1) {
    ids.push("__BYE__");
    bye = true;
  }
  const n = ids.length;
  const totalRounds = n - 1;
  const rounds: BracketRound[] = [];

  // circle method (canonical Berger): fix player 0, rotate the rest
  const fixed = ids[0];
  const rotating = ids.slice(1);

  for (let r = 0; r < totalRounds; r++) {
    const half = n / 2;
    const left: string[] = [fixed, ...rotating.slice(0, half - 1)];
    const right: string[] = [...rotating.slice(half - 1).reverse()];
    const matches: BracketMatch[] = [];
    for (let i = 0; i < half; i++) {
      const a = left[i];
      const b = right[i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      // alternate colours per round for fairness
      const whiteId = (r + i) % 2 === 0 ? a : b;
      const blackId = whiteId === a ? b : a;
      matches.push({
        id: `${tournamentId}-r${r + 1}-${i + 1}`,
        round: r + 1,
        white: whiteId,
        black: blackId,
        whitePlayerId: whiteId,
        blackPlayerId: blackId,
        whiteScore: null,
        blackScore: null,
        status: "scheduled",
      });
    }
    rounds.push({
      name: `Тур ${r + 1}`,
      round: r + 1,
      matches,
    });

    // rotate (last → first of rotating)
    rotating.unshift(rotating.pop() as string);
  }

  if (bye) {
    // mark for clarity (no behaviour change)
  }
  return rounds;
}

// ── helpers: standings & result application ────────────────────────

function recomputeBuchholz(t: Tournament): void {
  // Buchholz = sum of opponents' final scores. Skipped if no roster.
  const byId = new Map(t.roster.map((p) => [p.id, p]));
  for (const p of t.roster) {
    let bh = 0;
    for (const oppId of p.opponentIds) {
      const o = byId.get(oppId);
      if (o) bh += o.score;
    }
    p.buchholz = bh;
  }
}

function sortStandings(t: Tournament): Player[] {
  recomputeBuchholz(t);
  return [...t.roster].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.rating - a.rating;
  });
}

// ── cross-tournament leaderboard ───────────────────────────────────
// Aggregates final placements across ALL tournaments into a single global
// ranking (player → tournaments / wins / podiums / points). This is the
// piece the Tournament Hub (/cyberchess/tournament) needs but didn't have:
// per-tournament standings existed, a cross-tournament view did not.

export interface CrossLeaderboardEntry {
  player: string;
  tournaments: number;
  wins: number; // 1st places
  podiums: number; // top-3 finishes
  points: number;
}

/**
 * Derive (playerName → placement) for one tournament.
 *  - swiss / round_robin: rank by standings (score → buchholz → rating)
 *  - single_elimination: derive from the bracket — final winner = 1, final
 *    loser = 2, semifinal losers = 3. Only counts when results exist.
 * Returns [] when no placements are derivable yet (no results played).
 */
function placementsForTournament(t: Tournament): { name: string; placement: number }[] {
  if ((t.format === "swiss" || t.format === "round_robin") && t.roster.length > 0) {
    // Only meaningful once at least one game has been played.
    const played = t.roster.some((p) => p.opponentIds.length > 0);
    if (!played) return [];
    return sortStandings(t).map((p, i) => ({ name: p.name, placement: i + 1 }));
  }
  if (t.format === "single_elimination" && t.rounds.length > 0) {
    const out: { name: string; placement: number }[] = [];
    const finalRound = t.rounds[t.rounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    if (finalMatch && finalMatch.status === "done" && finalMatch.winner && finalMatch.winner !== "draw") {
      const champ = finalMatch.winner === "white" ? finalMatch.white : finalMatch.black;
      const runner = finalMatch.winner === "white" ? finalMatch.black : finalMatch.white;
      if (champ) out.push({ name: champ, placement: 1 });
      if (runner) out.push({ name: runner, placement: 2 });
    }
    if (t.rounds.length >= 2) {
      const sf = t.rounds[t.rounds.length - 2];
      for (const m of sf.matches) {
        if (m.status === "done" && m.winner && m.winner !== "draw") {
          const loser = m.winner === "white" ? m.black : m.white;
          if (loser && !out.some((o) => o.name === loser)) out.push({ name: loser, placement: 3 });
        }
      }
    }
    return out;
  }
  return [];
}

export function computeCrossTournamentLeaderboard(tournaments: Tournament[]): CrossLeaderboardEntry[] {
  const map = new Map<string, CrossLeaderboardEntry>();
  for (const t of tournaments) {
    for (const { name, placement } of placementsForTournament(t)) {
      let e = map.get(name);
      if (!e) {
        e = { player: name, tournaments: 0, wins: 0, podiums: 0, points: 0 };
        map.set(name, e);
      }
      e.tournaments += 1;
      if (placement === 1) e.wins += 1;
      if (placement <= 3) e.podiums += 1;
    }
  }
  // Same formula as the frontend's computeTournamentLeaderboard so hub numbers
  // stay consistent whether served from mock or backend.
  for (const e of map.values()) {
    e.points = 10 * e.wins + 5 * (e.podiums - e.wins) + e.tournaments;
  }
  return [...map.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.podiums - a.podiums ||
      a.player.localeCompare(b.player),
  );
}

function applyResultToMatch(
  t: Tournament,
  match: BracketMatch,
  winner: MatchResult,
): void {
  match.status = "done";
  match.winner = winner;
  if (winner === "white") {
    match.whiteScore = 1;
    match.blackScore = 0;
  } else if (winner === "black") {
    match.whiteScore = 0;
    match.blackScore = 1;
  } else {
    match.whiteScore = 0.5;
    match.blackScore = 0.5;
  }

  // update roster (swiss/RR)
  if (match.whitePlayerId && match.blackPlayerId) {
    const w = t.roster.find((p) => p.id === match.whitePlayerId);
    const b = t.roster.find((p) => p.id === match.blackPlayerId);
    if (w && b) {
      if (winner === "white") {
        w.score += 1;
      } else if (winner === "black") {
        b.score += 1;
      } else {
        w.score += 0.5;
        b.score += 0.5;
      }
      w.whiteCount += 1;
      b.blackCount += 1;
      if (!w.opponentIds.includes(b.id)) w.opponentIds.push(b.id);
      if (!b.opponentIds.includes(w.id)) b.opponentIds.push(w.id);
    }
  }
}

function maybeAdvanceSwiss(t: Tournament): void {
  if (t.format !== "swiss") return;
  const totalRounds = t.swissRounds ?? 5;
  const lastRound = t.rounds[t.rounds.length - 1];
  if (!lastRound) return;
  const allDone = lastRound.matches.every((m) => m.status === "done");
  if (!allDone) return;
  if (lastRound.round >= totalRounds) {
    t.status = "finished";
    return;
  }
  // pair the next round
  const next = pairSwissRound(t.roster, lastRound.round + 1, t.rounds).map(
    (m, i) => ({
      ...m,
      id: `${t.id}-r${lastRound.round + 1}-${i + 1}`,
    }),
  );
  t.rounds.push({
    name: `Тур ${lastRound.round + 1}`,
    round: lastRound.round + 1,
    matches: next,
  });
  t.currentRound = lastRound.round + 1;
}

function maybeAdvanceRR(t: Tournament): void {
  if (t.format !== "round_robin") return;
  const last = t.rounds[t.rounds.length - 1];
  if (!last) return;
  const allDone = t.rounds.every((r) => r.matches.every((m) => m.status === "done"));
  if (allDone) {
    t.status = "finished";
  }
}

// ── tournament → matchmaking bridge ────────────────────────────────

/**
 * Map our coarse TimeControl ("blitz"/"rapid"/"classic") to one of the
 * matchmaking module's concrete clocks. Stable mapping; can be replaced
 * by a per-tournament override later.
 */
function mapTimeControl(tc: TimeControl): MmTimeControl {
  switch (tc) {
    case "blitz":
      return "180+0";
    case "rapid":
      return "300+5";
    case "classic":
      return "1800+0";
    default:
      // fallback compile-time safety
      return "300+5";
  }
}

/**
 * Resolve a Player roster entry into a real userId, if one is mapped.
 * Today we use Player.userId (set during /register on realPlayers tournaments).
 * If absent, falls back to the synthetic player.id so the matchmaking
 * layer still gets a usable token (bot/anon slot).
 */
function resolveUserId(t: Tournament, playerId: string | null | undefined): string | null {
  if (!playerId) return null;
  const p = t.roster.find((x) => x.id === playerId);
  if (!p) return null;
  return p.userId || p.id;
}

function resolveDisplayName(t: Tournament, playerId: string | null | undefined): string | null {
  if (!playerId) return null;
  const p = t.roster.find((x) => x.id === playerId);
  return p?.name ?? null;
}

function resolveRating(t: Tournament, playerId: string | null | undefined): number {
  if (!playerId) return 1500;
  const p = t.roster.find((x) => x.id === playerId);
  return p?.rating ?? 1500;
}

/**
 * For every pairing in a freshly-built round, if both sides have
 * resolvable userIds, materialise a live match in matchmaking and
 * decorate the bracket match with liveMatchId + viewer URLs.
 *
 * Errors are isolated per-pairing — one failure must not abort the
 * whole round.
 */
function publishRoundToMatchmaking(t: Tournament, matches: BracketMatch[]): void {
  if (!t.realPlayers) return;
  const mmTc = mapTimeControl(t.timeControl);
  for (const m of matches) {
    if (m.status === "done") continue; // byes
    const whiteUserId = resolveUserId(t, m.whitePlayerId);
    const blackUserId = resolveUserId(t, m.blackPlayerId);
    if (!whiteUserId || !blackUserId) {
      m.liveMatchId = m.liveMatchId ?? null;
      continue;
    }
    try {
      const result = createPreMatchedMatch({
        whiteUserId,
        blackUserId,
        whiteName: resolveDisplayName(t, m.whitePlayerId) || undefined,
        blackName: resolveDisplayName(t, m.blackPlayerId) || undefined,
        whiteRating: resolveRating(t, m.whitePlayerId),
        blackRating: resolveRating(t, m.blackPlayerId),
        timeControl: mmTc,
        tournamentId: t.id,
        round: m.round,
      });
      m.liveMatchId = result.matchId;
      m.viewerUrlWhite = result.viewerUrlWhite;
      m.viewerUrlBlack = result.viewerUrlBlack;
      m.whiteUserId = whiteUserId;
      m.blackUserId = blackUserId;
      m.status = "live";
    } catch (e) {
      console.warn(
        `[cyberchess-tournaments] publishRoundToMatchmaking failed for ${m.id}:`,
        (e as Error).message,
      );
      capture(e);
      m.liveMatchId = null;
    }
  }
}

// ── routes ─────────────────────────────────────────────────────────

initStore();

/**
 * Догрузка из базы — асинхронная, поэтому маршруты её ЖДУТ.
 *
 * Соблазн был сделать «загрузили файл синхронно, а базу подхватим когда
 * придёт». Так нельзя: между стартом и приходом ответа кто-то успевает
 * зарегистрироваться, его запись ложится поверх файловой копии, а потом
 * прилетает состояние из базы и стирает её. Дефект того же класса, что чинили
 * весь вчерашний день, только рождённый починкой.
 *
 * Поэтому ожидание стоит перед всеми маршрутами (ниже), а не «где-нибудь».
 * После первого запроса промис уже разрешён и стоит наносекунды.
 */
/**
 * Сколько ждём базу на старте. У общего пула свои таймауты (5 с подключение,
 * 10 с запрос), поэтому в норме сюда не упирается никогда. Это страховка от
 * патологии: ожидание стоит перед ВСЕМИ маршрутами, и без предела один
 * зависший сокет повесил бы модуль целиком.
 */
const READY_MAX_MS = Number(process.env.CYBERCHESS_DB_READY_MS ?? 20_000);

const storeReady: Promise<void> = (async () => {
  const fromDb = await loadFromDb();
  // Пока ждали, ожидание могли бросить по времени. Подхватывать состояние
  // ПОСЛЕ того, как маршруты начали отвечать, нельзя: между этими моментами
  // кто-то успевает записаться, и прилетевшая копия его сотрёт.
  if (dbHealth.abandoned) {
    console.error("[cyberchess-tournaments] ответ базы пришёл слишком поздно — состояние не подхватываю, работаю на файле");
    return;
  }
  if (!fromDb) {
    // База пуста или недоступна. Только теперь заглушка становится настоящим
    // состоянием — и её надо записать, иначе свежая установка потеряет
    // фикстуры при перезапуске.
    if (seedsArePlaceholder) {
      seedsArePlaceholder = false;
      tryWriteToDisk();
    }
    return;
  }
  if (fromDb.savedAtMs <= savedAtMs) return; // файл свежее или ровесник — не трогаем
  TOURNAMENTS = fromDb.tournaments;
  savedAtMs = fromDb.savedAtMs;
  seedsArePlaceholder = false; // заглушку заменили настоящими данными
  dbHealth.adoptedFromDb = true;
  for (const t of TOURNAMENTS) {
    if (typeof t.realPlayers === "undefined") t.realPlayers = false;
    if (typeof t.origin === "undefined") t.origin = t.id.startsWith("usr-") ? "user" : "seed";
  }
  console.log(`[cyberchess-tournaments] состояние взято из базы (${TOURNAMENTS.length} турниров) — она свежее файла`);
})().catch((e) => {
  console.error("[cyberchess-tournaments] догрузка из базы не удалась, остаёмся на файле:", (e as Error).message);
});

// Ожидание готовности — ДО всех маршрутов, включая degradedGuard.
/**
 * Признак «ожидание уже завершилось». Без него таймер срабатывал ВСЕГДА — и
 * через 20 секунд после старта выключал запись в базу даже при полностью
 * здоровой базе. Поймано живым прогоном: диагностика показала `abandoned: true`
 * при мгновенно ответившем модуле. Гонка выиграна — таймер надо снимать, а не
 * оставлять тикать.
 */
let readySettled = false;

const storeReadyBounded: Promise<void> = Promise.race([
  storeReady.then(() => {
    readySettled = true;
  }),
  new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      if (readySettled) return resolve(); // успели — бросать нечего
      // База не ответила за отведённое время. Дальше работаем на файле и
      // БОЛЬШЕ НЕ ПИШЕМ в базу: наша файловая копия свежее по метке, и запись
      // затёрла бы то, что там лежит, — а лежать может всё, что наиграли.
      dbHealth.abandoned = true;
      console.error(`[cyberchess-tournaments] база не ответила за ${READY_MAX_MS} мс — работаю на файле, запись в базу выключена`);
      resolve();
    }, READY_MAX_MS);
    (t as unknown as { unref?: () => void }).unref?.(); // таймер не держит процесс
  }),
]);

router.use(async (_req: Request, _res: Response, next: () => void) => {
  await storeReadyBounded;
  next();
});

// Пока файл турниров не прочитан, ни один маршрут не работает: отдавать
// фикстуры под видом настоящих турниров и копить изменения, которые некуда
// сохранить, — хуже честного отказа. Страж сам пробует перечитать файл.
router.use(degradedGuard);

/* Партия турнира кончилась — закрываем пару в сетке.
 *
 * До 10.08.2026 этого звена не было. Пары публиковались в матчмейкинг
 * (`publishRoundToMatchmaking` → `createPreMatchedMatch`), партии игрались,
 * сервер сам определял исход и пересчитывал рейтинг — а сетка об этом не узнавала.
 * Закрыть пару умеет только `applyResultToMatch`, а единственный путь к ней,
 * `POST /:id/result`, не звал НИКТО: ни клиент (ни одного обращения во всём
 * фронтенде), ни сервер. Настоящий турнир навсегда застревал на первом круге;
 * выглядел он при этом здоровым, потому что показательный турнир зашит уже
 * сыгранным.
 *
 * Цвета не переставляем: белые в паре становятся белыми в матче — так их передаёт
 * `publishRoundToMatchmaking` в `createPreMatchedMatch`, — поэтому исход матчмейкинга
 * ложится на пару один в один. Связь ищем по `liveMatchId`, который проставила
 * публикация круга.
 */
onMatchSettled(({ matchId, tournamentId, result }) => {
  if (!tournamentId) return;
  const t = TOURNAMENTS.find((x) => x.id === tournamentId);
  if (!t) return;
  let match: BracketMatch | undefined;
  for (const r of t.rounds) {
    match = r.matches.find((m) => m.liveMatchId === matchId);
    if (match) break;
  }
  // Пары нет или её уже закрыли вручную через /result — второй раз не считаем.
  if (!match || match.status === "done") return;
  applyResultToMatch(t, match, result);
  maybeAdvanceSwiss(t);
  maybeAdvanceRR(t);
  tryWriteToDisk();
});

// DELETE /:id (админ) — убрать турнир.
//
// Ключ тот же, что у остальных админских ручек шахмат: заголовок `X-Admin-Key`
// против `CYBERCHESS_ADMIN_KEY`. Сравнение постоянного времени — как в
// матчмейкинге; по HTTP тайминг-атака непрактична, но одинаковый приём в
// одинаковых местах дешевле, чем помнить, где он слабее.
//
// Зачем ручка вообще. Создание турнира открыто (без входа, пять штук за десять
// минут с адреса), а способа убрать не было ни одного: чтобы вычистить мусор,
// приходилось идти руками в базу и в файл на томе. Теперь есть путь, и он
// закрывает три вещи сразу — уборку чужого мусора, проверку записи в базу с
// уборкой за собой и недостающую половину хранилища.
//
// Удаляется ровно один турнир по идентификатору: из памяти, из файла и из
// базы. Никаких «удалить всё, что похоже на тестовое» — под такой шаблон
// однажды попадёт живое событие.
// GET /_persistence — диагностика хранилища: только числа и признаки, никаких
// данных игроков. Существует ради одного вопроса, на который иначе пришлось бы
// отвечать верой: работает ли перенос состояния в базу на реальном сервере.
// После деплоя достаточно одного GET.
router.get("/_persistence", (_req: Request, res: Response): void => {
  res.json({ ok: true, tournaments: TOURNAMENTS.length, persistence: tournamentPersistenceState() });
});

// GET /list
router.get("/list", (req: Request, res: Response): void => {
  const format = String(req.query.format || "").toLowerCase();
  let list = TOURNAMENTS;
  if (format && format !== "all") {
    list = list.filter((t) => t.format === format);
  }
  // strip heavy nested fields for list view
  const slim = list.map((t) => ({
    id: t.id,
    title: t.title,
    format: t.format,
    timeControl: t.timeControl,
    eloMin: t.eloMin,
    eloMax: t.eloMax,
    players: t.players,
    maxPlayers: t.maxPlayers,
    prizeChessy: t.prizeChessy,
    status: t.status,
    startsAt: t.startsAt,
    description: t.description,
    swissRounds: t.swissRounds,
    currentRound: t.currentRound,
    realPlayers: !!t.realPlayers,
    // Происхождение едет в списке: страница рисует приз именно отсюда, и без
    // этого поля не может сказать, объявил его создатель или это наша фикстура.
    origin: t.origin ?? (t.id.startsWith("usr-") ? "user" : "seed"),
  }));
  res.json({ ok: true, count: slim.length, tournaments: slim });
});

// GET /leaderboard — cross-tournament global ranking.
// MUST be declared before GET /:id, otherwise "leaderboard" is captured as an id.
router.get("/leaderboard", (_req: Request, res: Response): void => {
  const leaderboard = computeCrossTournamentLeaderboard(TOURNAMENTS);
  res.json({
    ok: true,
    count: leaderboard.length,
    leaderboard,
    formula: "points = 10·wins + 5·(podiums − wins) + tournaments",
  });
});

// GET /:id
router.get("/:id", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  res.json({ ok: true, tournament: t });
});

// POST /:id/register
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const expected = process.env.CYBERCHESS_ADMIN_KEY || "";
  if (!expected) {
    res.status(503).json({ ok: false, error: "admin_delete_disabled", hint: "CYBERCHESS_ADMIN_KEY не задан" });
    return;
  }
  const provided = String(req.headers["x-admin-key"] || "");
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!provided || !timingSafeEqual(a, b)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const id = String(req.params.id ?? "");
  const idx = TOURNAMENTS.findIndex((t) => t.id === id);
  if (idx < 0) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id });
    return;
  }

  const [removed] = TOURNAMENTS.splice(idx, 1);
  tryWriteToDisk();
  await deleteFromDb(id);

  console.log(`[cyberchess-tournaments] удалён турнир ${id} («${removed.title}») по админской команде`);
  res.json({
    ok: true,
    deleted: { id: removed.id, title: removed.title, origin: removed.origin ?? null },
    remaining: TOURNAMENTS.length,
  });
});

router.post("/:id/register", async (req: Request, res: Response): Promise<void> => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  if (t.status !== "upcoming") {
    res.status(409).json({ ok: false, error: "registration_closed", status: t.status });
    return;
  }
  if (t.players >= t.maxPlayers) {
    res.status(409).json({ ok: false, error: "tournament_full" });
    return;
  }
  // Идентификатор не пришёл — выдаём свой, но ГОВОРИМ об этом.
  //
  // Замер 19.08.2026: страница списка турниров читала ключ, который пишется
  // только при входе, и у посетителя без аккаунта отправляла пустое поле. Тогда
  // каждый повторный клик получал НОВЫЙ anon_… — то есть защита ниже
  // («уже зарегистрирован») обходилась по построению: один человек мог набить
  // турнир призраками, и билет было не восстановить.
  //
  // Клиент починен, но контракт обязан быть явным: без признака вызывающий не
  // знает, что идентификатор надо сохранить, и повторит ту же ошибку.
  const providedUserId = typeof req.body?.userId === "string" && req.body.userId.trim();
  const userIdGenerated = !providedUserId;
  const userId: string = providedUserId || `anon_${randomUUID().slice(0, 8)}`;
  if (userIdGenerated) {
    console.warn(
      `[cyberchess-tournaments] регистрация без идентификатора в ${t.id} — выдан ${userId}. Клиент обязан сохранить его, иначе повторная регистрация создаст нового игрока.`,
    );
  }
  const displayName: string =
    (typeof req.body?.displayName === "string" && req.body.displayName.trim()) ||
    `Player_${userId.slice(-4)}`;
  if (t.registeredUserIds.includes(userId)) {
    // The ticket comes back with the refusal. Without it a player who cleared
    // the browser had no way to recover it: registering again is refused, and
    // the ticket lived only in that one tab.
    res.status(409).json({
      ok: false,
      error: "already_registered",
      userId,
      ticketId: t.tickets?.[userId] ?? null,
    });
    return;
  }
  // ── Объявленное ограничение по рейтингу обеспечивается ───────────────────
  //
  // На карточке турнира написано «ELO 1800–2400», и человек читает это как
  // ограничение. До 19.08.2026 оно не проверялось НИГДЕ: зарегистрироваться мог
  // кто угодно с любым рейтингом. Обещание, которого продукт не держит, — это
  // первый пункт ворот запуска, а не косметика.
  //
  // Проверяем только то, что ЗНАЕМ сами. Три исхода, как и везде:
  //   партии есть, рейтинг вне рамок → отказ с понятным текстом
  //   партий нет (0)                 → пускаем: рейтинга ещё не существует,
  //                                    иначе к 30.08 турниры были бы пусты
  //   базу спросить не удалось       → пускаем, но это ЗАПИСЫВАЕТСЯ в ответе,
  //                                    чтобы «пустили» не выглядело «проверили»
  let eloChecked: "по рейтингу" | "рейтинга нет" | "спросить не удалось" = "рейтинга нет";
  try {
    const known = await getRating(userId, speedOf(String(t.timeControl)));
    if (known === null) {
      eloChecked = "спросить не удалось";
    } else if (Number(known.games) > 0) {
      const r = Math.round(Number(known.rating));
      if (Number.isFinite(r) && (r < t.eloMin || r > t.eloMax)) {
        res.status(403).json({
          ok: false,
          error: "rating_out_of_range",
          hint: `турнир для игроков ${t.eloMin}–${t.eloMax}, ваш рейтинг ${r}`,
          rating: r,
          eloMin: t.eloMin,
          eloMax: t.eloMax,
        });
        return;
      }
      eloChecked = "по рейтингу";
    }
  } catch {
    eloChecked = "спросить не удалось";
  }

  t.registeredUserIds.push(userId);
  t.players += 1;

  // For real-player tournaments, attach the userId onto a roster slot so
  // that publishRoundToMatchmaking() can later resolve real userIds.
  if (t.realPlayers) {
    const freeSlot = t.roster.find((p) => !p.userId);
    if (freeSlot) {
      freeSlot.userId = userId;
      freeSlot.name = displayName;
    } else {
      // grow roster on demand if no fixture slot available
      const newPlayer: Player = {
        id: `pl_dyn_${t.registeredUserIds.length.toString().padStart(3, "0")}_${userId.slice(-6)}`,
        name: displayName,
        rating: 1500,
        score: 0,
        buchholz: 0,
        whiteCount: 0,
        blackCount: 0,
        opponentIds: [],
        userId,
      };
      t.roster.push(newPlayer);
    }
  }

  // The ticket is issued BEFORE the write, so what the player is shown is what
  // was stored. It used to be minted after it, purely for the response, and
  // was then thrown away: the page printed "ticket tkt_…" as proof of entry
  // while the server had never heard of that string and could not confirm it
  // for the player, for support, or at the door of the tournament.
  const ticketId = `tkt_${randomUUID()}`;
  if (!t.tickets) t.tickets = {};
  t.tickets[userId] = ticketId;

  tryWriteToDisk();
  res.json({
    ok: true,
    ticketId,
    tournamentId: t.id,
    title: t.title,
    userId,
    // Как именно прошло ограничение по рейтингу. «Пустили» и «проверили» —
    // разные вещи, и различать их должен ответ, а не догадка читающего.
    eloChecked,
    // Признак для клиента: идентификатор наш, его НАДО сохранить. Без этого
    // следующая регистрация того же человека заведёт нового игрока.
    userIdGenerated,
    realPlayers: !!t.realPlayers,
    queueStreamUrl: t.realPlayers
      ? `/api/cyberchess/matchmaking/queue/stream?userId=${encodeURIComponent(userId)}`
      : null,
    registeredAt: new Date().toISOString(),
  });
});

// GET /:id/bracket
router.get("/:id/bracket", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  res.json({
    ok: true,
    tournamentId: t.id,
    format: t.format,
    size: t.format === "single_elimination" ? 16 : t.roster.length,
    rounds: t.rounds,
  });
});

// GET /:id/standings
router.get("/:id/standings", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  const sorted = sortStandings(t);
  res.json({
    ok: true,
    tournamentId: t.id,
    format: t.format,
    standings: sorted.map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      name: p.name,
      rating: p.rating,
      score: p.score,
      buchholz: p.buchholz,
      whiteCount: p.whiteCount,
      blackCount: p.blackCount,
      gamesPlayed: p.opponentIds.length,
    })),
  });
});

// GET /:id/next-round
router.get("/:id/next-round", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  // Find first round with any scheduled match
  const next = t.rounds.find((r) => r.matches.some((m) => m.status === "scheduled" || m.status === "live"));
  if (!next) {
    res.json({ ok: true, tournamentId: t.id, finished: true, round: null });
    return;
  }
  res.json({
    ok: true,
    tournamentId: t.id,
    finished: false,
    round: next.round,
    name: next.name,
    matches: next.matches,
  });
});

// POST /:id/result   { matchId, winner: "white"|"black"|"draw" }
// POST /:id/result — closes a bracket pair and recomputes standings.
//
// Signed, unlike the rest of this router. The other endpoints are open on
// purpose: CyberChess has no accounts, so a player registers under an id their
// own browser generates and there is nothing to authenticate against. This one
// is different in kind — it decides who won, which drives standings, placement
// and the prize podium. Left open, anyone who knows a tournament id could hand
// themselves the tournament from outside the product.
//
// Nothing in the product calls it: real games settle through
// onMatchSettled() inside the matchmaking module, an in-process call that does
// not pass through here. It exists for the tournament service to report
// results, and that sender can sign — same secret and same verification chain
// as /api/cyberchess/tournament-finalized.
/**
 * POST /:id/unregister { userId, ticketId } — выйти из турнира до его начала.
 *
 * Заведено 19.08.2026. До этого выйти было НЕЛЬЗЯ вообще: записался — значит
 * навсегда, даже если передумал за неделю до старта. Регистрация без отмены —
 * это про согласие человека, а не про удобство: он соглашался играть, а не
 * числиться в списке, из которого нет выхода.
 *
 * Право подтверждается БИЛЕТОМ, а не одним userId. Аккаунтов у нас нет, и
 * идентификатор игрока не секрет — зная его, посторонний вычёркивал бы людей из
 * турниров. Билет выдаётся при регистрации и есть только у записавшегося.
 *
 * После старта выход закрыт: сетка уже построена, и вычеркнутый участник
 * оставил бы дыру в парах.
 */
router.post("/:id/unregister", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === String(req.params.id ?? ""));
  if (!t) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (t.status !== "upcoming") {
    res.status(409).json({
      ok: false,
      error: "already_started",
      hint: "выйти можно только до начала турнира",
    });
    return;
  }
  const userId = String(req.body?.userId ?? "").trim();
  const ticketId = String(req.body?.ticketId ?? "").trim();
  if (!userId || !ticketId) {
    res.status(400).json({ ok: false, error: "userId_and_ticketId_required" });
    return;
  }
  if (!t.registeredUserIds.includes(userId)) {
    res.status(404).json({ ok: false, error: "not_registered" });
    return;
  }
  if (!t.tickets || t.tickets[userId] !== ticketId) {
    res.status(403).json({ ok: false, error: "ticket_mismatch" });
    return;
  }

  t.registeredUserIds = t.registeredUserIds.filter((u) => u !== userId);
  t.players = Math.max(0, t.players - 1);
  delete t.tickets[userId];
  // Место в сетке освобождается тоже: иначе участник исчезает из списка, но
  // продолжает занимать слот, и турнир выглядит полнее, чем есть.
  for (const slot of t.roster) {
    if (slot.userId === userId) {
      slot.userId = undefined;
      slot.name = "—";
    }
  }
  tryWriteToDisk();

  res.json({ ok: true, tournamentId: t.id, userId, players: t.players });
});

router.post("/:id/result", (req: Request, res: Response): void => {
  const verdict = verifyWebhookSig({
    signature: req.headers["x-aevion-signature"],
    timestamp: req.headers["x-aevion-timestamp"],
    legacySecret: req.headers["x-cyberchess-secret"],
    body: req.body,
    secret: getResultSecret(),
  });
  if (!verdict.ok) {
    res.status(401).json({ ok: false, error: "invalid_signature", reason: verdict.reason });
    return;
  }

  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  const matchId = String(req.body?.matchId || "");
  const winner = String(req.body?.winner || "") as MatchResult;
  if (!matchId || !["white", "black", "draw"].includes(winner)) {
    res.status(400).json({ ok: false, error: "invalid_payload" });
    return;
  }
  let match: BracketMatch | undefined;
  for (const r of t.rounds) {
    match = r.matches.find((m) => m.id === matchId);
    if (match) break;
  }
  if (!match) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId });
    return;
  }
  if (match.status === "done") {
    res.status(409).json({ ok: false, error: "match_already_done", matchId });
    return;
  }

  applyResultToMatch(t, match, winner);
  maybeAdvanceSwiss(t);
  maybeAdvanceRR(t);
  tryWriteToDisk();

  res.json({
    ok: true,
    tournamentId: t.id,
    matchId,
    winner,
    updatedStatus: t.status,
    currentRound: t.currentRound,
  });
});

// POST /:id/queue-match — turn-by-turn pairing for real-player tournaments.
//
// Behaviour:
//  - If tournament.realPlayers !== true → 409, no-op (legacy preserved).
//  - Looks at the most recently completed round's results (or the empty
//    roster for round 1) and produces pairings for the next round:
//      * swiss → pairSwissRound on roster
//      * round_robin → next scheduled round already exists in t.rounds
//      * single_elimination → winners of previous round are paired in order
//  - For each pairing where both players have resolvable userIds, a live
//    matchmaking match is created via createPreMatchedMatch(); matchId
//    and viewer URLs are attached to the bracket match.
router.post("/:id/queue-match", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  if (!t.realPlayers) {
    res
      .status(409)
      .json({ ok: false, error: "not_a_real_player_tournament", hint: "set realPlayers: true to enable" });
    return;
  }

  const lastRound = t.rounds[t.rounds.length - 1];
  const allLastDone = lastRound ? lastRound.matches.every((m) => m.status === "done") : true;

  // Swiss: pair next round from current roster scores
  if (t.format === "swiss") {
    if (lastRound && !allLastDone) {
      res.status(409).json({ ok: false, error: "previous_round_in_progress", round: lastRound.round });
      return;
    }
    const totalRounds = t.swissRounds ?? 5;
    const nextRoundNo = (lastRound?.round ?? 0) + 1;
    if (nextRoundNo > totalRounds) {
      t.status = "finished";
      tryWriteToDisk();
      res.json({ ok: true, finished: true, tournamentId: t.id });
      return;
    }
    const next = pairSwissRound(t.roster, nextRoundNo, t.rounds).map((m, i) => ({
      ...m,
      id: `${t.id}-r${nextRoundNo}-${i + 1}`,
      liveMatchId: null as string | null,
    }));
    publishRoundToMatchmaking(t, next);
    t.rounds.push({ name: `Тур ${nextRoundNo}`, round: nextRoundNo, matches: next });
    t.currentRound = nextRoundNo;
    tryWriteToDisk();
    res.json({
      ok: true,
      tournamentId: t.id,
      round: nextRoundNo,
      matches: next,
      live: next
        .filter((m) => !!m.liveMatchId)
        .map((m) => ({
          bracketMatchId: m.id,
          matchId: m.liveMatchId,
          viewerUrlWhite: m.viewerUrlWhite,
          viewerUrlBlack: m.viewerUrlBlack,
          whiteUserId: m.whiteUserId,
          blackUserId: m.blackUserId,
        })),
    });
    return;
  }

  // Round-robin: full schedule already exists — surface the next pending round
  if (t.format === "round_robin") {
    const pending = t.rounds.find((r) => r.matches.some((m) => m.status === "scheduled"));
    if (!pending) {
      t.status = "finished";
      tryWriteToDisk();
      res.json({ ok: true, finished: true, tournamentId: t.id });
      return;
    }
    // mark liveMatchId field as null placeholder for clients
    for (const m of pending.matches) {
      if (typeof m.liveMatchId === "undefined") m.liveMatchId = null;
    }
    publishRoundToMatchmaking(t, pending.matches);
    t.currentRound = pending.round;
    tryWriteToDisk();
    res.json({
      ok: true,
      tournamentId: t.id,
      round: pending.round,
      matches: pending.matches,
      live: pending.matches
        .filter((m) => !!m.liveMatchId)
        .map((m) => ({
          bracketMatchId: m.id,
          matchId: m.liveMatchId,
          viewerUrlWhite: m.viewerUrlWhite,
          viewerUrlBlack: m.viewerUrlBlack,
          whiteUserId: m.whiteUserId,
          blackUserId: m.blackUserId,
        })),
    });
    return;
  }

  // Single elimination: pair winners of last round
  if (t.format === "single_elimination") {
    if (!lastRound) {
      res.status(409).json({ ok: false, error: "no_rounds_yet" });
      return;
    }
    if (!allLastDone) {
      res.status(409).json({ ok: false, error: "previous_round_in_progress", round: lastRound.round });
      return;
    }
    const winners: string[] = [];
    for (const m of lastRound.matches) {
      if (m.winner === "white" && m.white) winners.push(m.white);
      else if (m.winner === "black" && m.black) winners.push(m.black);
    }
    if (winners.length < 2) {
      t.status = "finished";
      tryWriteToDisk();
      res.json({ ok: true, finished: true, tournamentId: t.id, champion: winners[0] ?? null });
      return;
    }
    const nextRoundNo = lastRound.round + 1;
    const matches: BracketMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      matches.push({
        id: `${t.id}-r${nextRoundNo}-${i / 2 + 1}`,
        round: nextRoundNo,
        white: winners[i],
        black: winners[i + 1] ?? null,
        whiteScore: null,
        blackScore: null,
        status: "scheduled",
        liveMatchId: null,
      });
    }
    publishRoundToMatchmaking(t, matches);
    t.rounds.push({ name: `Тур ${nextRoundNo}`, round: nextRoundNo, matches });
    t.currentRound = nextRoundNo;
    tryWriteToDisk();
    res.json({
      ok: true,
      tournamentId: t.id,
      round: nextRoundNo,
      matches,
      live: matches
        .filter((m) => !!m.liveMatchId)
        .map((m) => ({
          bracketMatchId: m.id,
          matchId: m.liveMatchId,
          viewerUrlWhite: m.viewerUrlWhite,
          viewerUrlBlack: m.viewerUrlBlack,
          whiteUserId: m.whiteUserId,
          blackUserId: m.blackUserId,
        })),
    });
    return;
  }

  res.status(400).json({ ok: false, error: "unsupported_format", format: t.format });
});

// expose the allowed matchmaking time-controls so the frontend can show
// the mapping if needed (purely informational)
router.get("/__meta/time-controls", (_req: Request, res: Response): void => {
  res.json({ ok: true, matchmaking: ALLOWED_TIME_CONTROLS });
});

// ── user-created tournaments ───────────────────────────────────────
// Lets any player spin up their own joinable event instead of only
// registering into seed fixtures. Created as realPlayers:true so
// registration wires into live matchmaking pairing (the [id] page flow).

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "tournament"
  );
}

// per-IP create throttle: 5 creations / 10 min (blocks spam-creation)
const CREATE_WINDOW_MS = 10 * 60 * 1000;
const CREATE_MAX = 5;
const createHits = new Map<string, number[]>();
function createRateOk(ip: string): boolean {
  const now = Date.now();
  const fresh = (createHits.get(ip) ?? []).filter((t) => now - t < CREATE_WINDOW_MS);
  if (fresh.length >= CREATE_MAX) {
    createHits.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  createHits.set(ip, fresh);
  return true;
}

// POST / — create a tournament
router.post("/", (req: Request, res: Response): void => {
  // clientIp, not the raw header: the leftmost X-Forwarded-For entry is written
  // by the caller, so varying it gave every request a fresh bucket and this
  // creation limit never fired.
  const ip = clientIp(req);
  if (!createRateOk(ip)) {
    res.status(429).json({ ok: false, error: "rate_limited", hint: "too many tournaments created; try later" });
    return;
  }

  const b = (req.body ?? {}) as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  if (title.length < 3 || title.length > 80) {
    res.status(400).json({ ok: false, error: "title_required", hint: "title must be 3-80 chars" });
    return;
  }
  const format: Format =
    b.format === "swiss" || b.format === "round_robin" ? b.format : "single_elimination";
  const timeControl: TimeControl =
    b.timeControl === "rapid" || b.timeControl === "classic" ? b.timeControl : "blitz";
  const eloMin = clampInt(b.eloMin, 0, 3000, 0);
  const eloMax = Math.max(eloMin, clampInt(b.eloMax, 0, 3000, 3000));
  const maxPlayers = clampInt(b.maxPlayers, 2, 128, 8);
  const prizeChessy = clampInt(b.prizeChessy, 0, 10_000_000, 0);

  let startsAt = typeof b.startsAt === "string" ? b.startsAt : "";
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // default: +1h
  }
  const description =
    typeof b.description === "string" && b.description.trim()
      ? b.description.trim().slice(0, 300)
      : undefined;

  const t: Tournament = {
    id: `usr-${slugify(title)}-${randomUUID().slice(0, 6)}`,
    title,
    format,
    timeControl,
    eloMin,
    eloMax,
    players: 0,
    maxPlayers,
    prizeChessy,
    status: "upcoming",
    startsAt,
    description,
    swissRounds:
      format === "swiss" ? Math.max(3, Math.ceil(Math.log2(Math.max(2, maxPlayers)))) : undefined,
    currentRound: 0,
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: true, // user-created events are joinable, not cosmetic seeds
    origin: "user",
  };

  // Auto-register the creator as the first participant when identified.
  const creatorId = typeof b.userId === "string" && b.userId.trim() ? b.userId.trim() : "";
  if (creatorId) {
    const creatorName =
      (typeof b.displayName === "string" && b.displayName.trim()) || `Player_${creatorId.slice(-4)}`;
    t.registeredUserIds.push(creatorId);
    t.players = 1;
    t.roster.push({
      id: `pl_dyn_000_${creatorId.slice(-6)}`,
      name: creatorName,
      rating: 1500,
      score: 0,
      buchholz: 0,
      whiteCount: 0,
      blackCount: 0,
      opponentIds: [],
      userId: creatorId,
    });
  }

  TOURNAMENTS.unshift(t);
  tryWriteToDisk();
  res.status(201).json({ ok: true, tournament: t });
});

export default router;
