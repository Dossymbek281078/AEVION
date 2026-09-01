import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { pickDailyPuzzle } from '../lib/cyberchessDailyPuzzle';
import { createInMemoryRateLimiter } from '../lib/rateLimit/inMemoryWindow';
import { clientIp } from '../lib/rateLimit';
import { getPool } from '../lib/dbPool';

const router = Router();

type Puzzle = {
  id: string;
  fen: string;
  sol: string[];
  theme: string;
  rating: number;
};

// ============================================================================
// PUZZLE POOL — 30 hand-crafted entries
// ============================================================================
//
// ⚠️ This is NOT the product's puzzle of the day. The daily puzzle every player
// sees comes from the real puzzle bank: GET /api/cyberchess-puzzles/daily,
// which picks from the imported corpus via the shared `pickDailyPuzzle`.
// The pool below only backs this router's own /puzzle and /history, kept so an
// operator can query a day→puzzle mapping without loading the whole bank.
// If you are wiring a client, call the bank — not this.
//
// Until 2026-08-10 this pool also held 335 "procedurally generated" puzzles.
// They were fiction: 10 base positions repeated 33× each, with `theme` and
// `rating` drawn from a PRNG and pinned onto positions they did not describe —
// an Italian opening served as "Mate in 2, rating 2350". Numbers shown to a
// learner have to come from the position, so they are gone.
// ============================================================================

const HAND_CRAFTED: Puzzle[] = [
  { id: 'p001', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'c4f7'], theme: 'Fork', rating: 1200 },
  { id: 'p002', fen: 'r3k2r/ppp2ppp/2n1bn2/2bqp3/2B1P3/2NP1N2/PPPQ1PPP/R1B1K2R w KQkq - 0 1', sol: ['c3d5', 'f6d5', 'e4d5'], theme: 'Pin', rating: 1450 },
  { id: 'p003', fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { id: 'p004', fen: '2kr3r/ppp2ppp/2n1b3/3qp3/3PnB2/2N1PN2/PPP2PPP/R2QKB1R w KQ - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Double attack', rating: 1500 },
  { id: 'p005', fen: 'r2qkb1r/ppp2ppp/2n1bn2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['c3d5', 'c6d4', 'd5f6'], theme: 'Discovered attack', rating: 1700 },
  { id: 'p006', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'd3d4'], theme: 'Tactic', rating: 1300 },
  { id: 'p007', fen: 'r4rk1/pppq1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { id: 'p008', fen: 'r2q1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1550 },
  { id: 'p009', fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 1', sol: ['c4d5', 'e6d5', 'c3d5'], theme: 'Opening trap', rating: 1100 },
  { id: 'p010', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'f3e5'], theme: 'Fried liver', rating: 1400 },
  { id: 'p011', fen: 'r2qk2r/ppp1bppp/2n2n2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'e2c4'], theme: 'Pin', rating: 1650 },
  { id: 'p012', fen: '2r2rk1/pp1q1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Mate in 3', rating: 1900 },
  { id: 'p013', fen: 'r1b1k2r/pppp1ppp/2n2q2/2b1n3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['f3e5', 'f6e5', 'c1f4'], theme: 'Skewer', rating: 1500 },
  { id: 'p014', fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'c3d5'], theme: 'Italian trap', rating: 1350 },
  { id: 'p015', fen: '3r1rk1/ppq2ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Combination', rating: 1750 },
  { id: 'p016', fen: 'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', sol: ['e4d5', 'd8d5', 'b1c3'], theme: 'Center', rating: 1000 },
  { id: 'p017', fen: 'r4rk1/pp1q1ppp/2nbbn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1850 },
  { id: 'p018', fen: 'r1b2rk1/ppp1qppp/2nb1n2/3p4/3P4/2NBPN2/PPPQ1PPP/R1B2RK1 w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Deflection', rating: 1700 },
  { id: 'p019', fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Remove defender', rating: 1450 },
  { id: 'p020', fen: 'rnbqkbnr/pp3ppp/4p3/2pp4/3P4/2N1P3/PPP2PPP/R1BQKBNR w KQkq - 0 1', sol: ['c3b5', 'd5d4', 'b5d6'], theme: 'Knight outpost', rating: 1250 },
  { id: 'p021', fen: 'r1bq1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { id: 'p022', fen: '2rq1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Mate in 2', rating: 1950 },
  { id: 'p023', fen: 'r1bqk2r/ppp1bppp/2n2n2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'c3d5'], theme: 'Combination', rating: 1550 },
  { id: 'p024', fen: 'rnb1k2r/ppp1qppp/3p1n2/4p3/1bP1P3/2N2N2/PPQP1PPP/R1B1KB1R w KQkq - 0 1', sol: ['a2a3', 'b4c3', 'd2c3'], theme: 'Decoy', rating: 1400 },
  { id: 'p025', fen: 'r1bq1rk1/pp2bppp/2np1n2/4p3/2B1P3/2NP1N2/PPPB1PPP/R2Q1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1650 },
  { id: 'p026', fen: 'r2qk2r/ppp1bppp/2n1bn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Zugzwang', rating: 1700 },
  { id: 'p027', fen: '3r1rk1/pp1q1ppp/2nbbn2/3p4/3P4/1QNBPN2/PPP2PPP/2KR3R w - - 0 1', sol: ['b3b7', 'c6a5', 'b7a7'], theme: 'Queen raid', rating: 1850 },
  { id: 'p028', fen: 'r1bqkb1r/pp3ppp/2np1n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1', sol: ['d4e5', 'd6e5', 'd1d8'], theme: 'Queen trade', rating: 1500 },
  { id: 'p029', fen: 'r2q1rk1/ppp2ppp/2nb1n2/3p4/3P4/2NBPN2/PPP1QPPP/R1B2RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { id: 'p030', fen: 'rnbqk2r/pp2bppp/4pn2/2pp4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4c5', 'b8d7', 'b2b4'], theme: 'Pawn grab', rating: 1300 },
];

const POOL: Puzzle[] = HAND_CRAFTED;

// ============================================================================
// PERSISTENT LEADERBOARD (file-backed, top-1000)
// ============================================================================

type LeaderEntry = {
  name: string;
  streak: number;
  country: string;
  score: number;
  userId: string;
  updatedAt: string;
};

// Overridable so a test run can point the store at a scratch directory. The
// leaderboard file is committed to the repository, so a suite that wrote to
// the real one would dirty tracked data while reporting green — which is
// exactly what the paywall suite did to data/subscriptions.jsonl.
const DATA_DIR = process.env.CYBERCHESS_DAILY_DIR
  ? path.resolve(process.env.CYBERCHESS_DAILY_DIR)
  : path.resolve(process.cwd(), 'data');
const LB_FILE = path.join(DATA_DIR, 'cyberchess-daily-leaderboard.json');
const LB_MAX = 1000;

/**
 * Момент последнего сохранения — по нему выбирается свежая копия: файл или
 * база. Объявлено ЗДЕСЬ, выше loadLeaderboard, не для красоты: эта функция
 * вызывается при загрузке модуля, и при объявлении ниже она падала на
 * «Cannot access before initialization». Падение ловил try/catch, файл
 * считался нечитаемым, и таблица лидеров отвечала 503 — на самом
 * посещаемом экране. Поймано тестом, не типами.
 */
let dailySavedAtMs = 0;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

/* Until 2026-08-10 an empty leaderboard was filled with 100 invented players —
 * "Magnus", "Hikaru", "Carlsen" with streaks counting down from 365 — and
 * written to disk under userId `seed_000`…`seed_099`. Nobody had solved
 * anything; the table was decoration. A leaderboard that shows strangers ahead
 * of a real player who just took first place is worse than an empty one, so the
 * seeding is gone and legacy seed rows are dropped on load. An empty board is
 * the honest state of a board nobody has climbed yet. */
export function isSeededEntry(e: { userId?: string }): boolean {
  return typeof e.userId === 'string' && e.userId.startsWith('seed_');
}

/**
 * Файл есть, но прочитать его не удалось. Это НЕ пустая таблица.
 *
 * Раньше оба случая давали `[]`, и последствие было куда хуже показа: пустой
 * список становился состоянием в памяти, а первое же сохранение записывало эту
 * пустоту ПОВЕРХ файла. То есть одна временная ошибка чтения — недописанный
 * JSON, гонка на подмене, нехватка прав — стирала таблицу целиком и навсегда,
 * без единого сообщения.
 */
let leaderboardReadable = true;

function loadLeaderboard(): LeaderEntry[] {
  try {
    ensureDataDir();
    if (fs.existsSync(LB_FILE)) {
      const raw = fs.readFileSync(LB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Две формы файла: голый массив (как писали раньше) и объект с меткой
      // времени. Метка нужна, чтобы сравнивать файл с копией в базе; старую
      // форму продолжаем читать, иначе первая же выкатка потеряла бы таблицу.
      const list = Array.isArray(parsed)
        ? (parsed as LeaderEntry[])
        : Array.isArray(parsed?.leaderboard)
          ? (parsed.leaderboard as LeaderEntry[])
          : null;
      if (list) {
        leaderboardReadable = true;
        if (!Array.isArray(parsed) && parsed.savedAt) {
          const t = new Date(parsed.savedAt).getTime();
          if (Number.isFinite(t)) dailySavedAtMs = t;
        }
        return list.filter((e) => !isSeededEntry(e));
      }
      // Файл есть, но внутри не список — содержимое неизвестно, значит не пусто.
      leaderboardReadable = false;
      console.error('[cyberchess-daily] таблица лидеров не разобрана — запись заблокирована, чтобы не стереть её пустотой');
      return [];
    }
    // Файла нет — честная пустая таблица: её никто ещё не заполнял.
    leaderboardReadable = true;
  } catch (e) {
    leaderboardReadable = false;
    console.error(
      '[cyberchess-daily] таблицу лидеров не прочитать — запись заблокирована, чтобы не стереть её пустотой:',
      (e as Error).message,
    );
  }
  return [];
}

function saveLeaderboard(entries: LeaderEntry[]): void {
  if (!leaderboardReadable) {
    // Пробуем ещё раз: причина обычно временная, и как только файл читается,
    // работа возобновляется сама. Прочитанное берём за основу и накатываем на
    // него то, что накопилось в памяти, — иначе сохранение снова затрёт диск.
    const recovered = loadLeaderboard();
    if (!leaderboardReadable) {
      console.error('[cyberchess-daily] сохранение пропущено: файл по-прежнему не читается, в памяти', entries.length, 'строк');
      return;
    }
    LEADERBOARD = recovered;
    for (const e of entries) upsertLeaderboard(e.userId, e.name, e.country, e.streak, e.score);
    return; // upsertLeaderboard уже сохранил
  }
  try {
    ensureDataDir();
    dailySavedAtMs = Date.now();
    fs.writeFileSync(
      LB_FILE,
      JSON.stringify({ savedAt: new Date(dailySavedAtMs).toISOString(), leaderboard: entries }, null, 2),
      'utf-8',
    );
    // Зеркало в базе — вместе с личной статистикой: она жила только в памяти и
    // обнулялась на каждом рестарте, из-за чего человек видел «решено: 0»,
    // стоя в таблице со своей серией.
    void saveDailyToDb(dailySavedAtMs);
  } catch (e) {
    console.error('[cyberchess-daily] запись таблицы лидеров не прошла:', (e as Error).message);
  }
}

/** Состояние хранилища таблицы — для диагностики и для ответа ручки. */
export function dailyLeaderboardReadable(): boolean {
  return leaderboardReadable;
}

// In-memory mirror (fallback when fs unavailable)
let LEADERBOARD: LeaderEntry[] = loadLeaderboard();

// Per-user stats (in-memory; could persist similarly later)
type UserStats = {
  userId: string;
  bestStreak: number;
  totalSolved: number;
  totalTimeMs: number;
  history: Array<{ day: string; timeMs: number; hintsUsed: number; streak: number; score: number }>;
};
const userStats = new Map<string, UserStats>();

// Per-day record (one solve per user per day, deduped)
type SolveRecord = { day: string; streak: number; userId: string; timeMs: number; hintsUsed: number; score: number };
const solveStore = new Map<string, SolveRecord>(); // key: `${userId}:${day}`

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
// ── Postgres: записи задачи дня переживают деплой ───────────────────
//
// ЗАЧЕМ. Таблица лидеров лежит в файле, который ЗАКОММИЧЕН в репозиторий, а
// файловая система контейнера временная. Значит при каждом деплое таблица
// откатывается к версии из git — всё, что игроки заработали с прошлой выкатки,
// исчезает молча. Личная статистика (сколько решено, история по дням) и того
// хуже: она жила только в памяти процесса и обнулялась при любом рестарте,
// из-за чего человек видел «решено: 0», стоя в таблице со своей серией.
//
// УСТРОЙСТВО такое же, как у турниров (cyberchessTournaments.ts): одна строка
// JSONB со всем состоянием, `savedAt` решает, кто свежее — база или файл. Без
// DATABASE_URL всё работает как раньше, на файле и в памяти.
let dailyPool: any = null;
let dailyDbTried = false;
/** Что фактически произошло с базой — чтобы первый деплой ОТВЕТИЛ, а не мы предположили. */
const dailyDbHealth = { configured: false, connected: false, adoptedFromDb: false, abandoned: false, saves: 0, rowsWritten: 0, saveErrors: 0, retries: 0, lastErrorKind: null as string | null };

/**
 * Повтор зеркалирования в базу после сбоя — как в турнирах и по той же
 * причине: запись не ждут, поэтому единичный обрыв сети означал бы, что
 * зеркало молча отстало. Повторяем ТЕКУЩЕЕ состояние, а не упавший снимок.
 */
const DAILY_DB_RETRY_MS = Number(process.env.CYBERCHESS_DB_RETRY_MS ?? 20_000);
let dailyDbRetryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDailyDbRetry(): void {
  if (dailyDbRetryTimer) return; // одна попытка в полёте
  dailyDbRetryTimer = setTimeout(() => {
    dailyDbRetryTimer = null;
    dailyDbHealth.retries += 1;
    void saveDailyToDb(Date.now());
  }, DAILY_DB_RETRY_MS);
  dailyDbRetryTimer.unref?.(); // таймер не должен держать процесс живым
}

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

async function ensureDailyDb(): Promise<any> {
  if (dailyDbTried) return dailyPool;
  dailyDbTried = true;
  if (!process.env.DATABASE_URL) return null;
  dailyDbHealth.configured = true;
  try {
    // Общий пул из lib/dbPool, а не свой: в нём уже настроены таймауты
    // (подключение 5 с, запрос 10 с) и keep-alive. Свой пул без них означал
    // бы, что при недоступной базе запрос висит сколько угодно — а ожидание
    // готовности стоит перед ВСЕМИ маршрутами модуля, то есть повис бы весь
    // модуль вместо того, чтобы честно работать на файле. Плюс это второй
    // способ делать то, что в репозитории уже делается одним.
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CyberDailyEntry" (
        "userId"    TEXT PRIMARY KEY,
        "entry"     JSONB,
        "stats"     JSONB,
        -- Миллисекунды числом, а не TIMESTAMP: у колонки без часового пояса
        -- смысл зависит от читателя (драйвер разберёт её в поясе клиента), и
        -- сравнение «что свежее» молча ошибётся на часы. Тот же разбор — в
        -- cyberchessTournaments.ts.
        "savedAtMs" BIGINT NOT NULL
      );
    `);
    dailyPool = pool;
    dailyDbHealth.connected = true;
    console.log('[cyberchess-daily] pg connected — записи задачи дня переживут деплой');
    return pool;
  } catch (e) {
    console.warn('[cyberchess-daily] pg init failed:', (e as Error).message);
    return null;
  }
}

type DailyState = { leaderboard: LeaderEntry[]; stats: UserStats[] };

async function loadDailyFromDb(): Promise<{ state: DailyState; savedAtMs: number } | null> {
  const pool = await ensureDailyDb();
  if (!pool) return null;
  try {
    const r = await pool.query(`SELECT "userId","entry","stats","savedAtMs" FROM "CyberDailyEntry"`);
    const rows = r.rows ?? [];
    if (rows.length === 0) return null;
    const lb: LeaderEntry[] = [];
    const stats: UserStats[] = [];
    let newest = 0;
    for (const row of rows) {
      if (row?.entry && typeof row.entry.userId === 'string') lb.push(row.entry as LeaderEntry);
      if (row?.stats && typeof row.stats.userId === 'string') stats.push(row.stats as UserStats);
      const t = Number(row?.savedAtMs);
      if (Number.isFinite(t) && t > newest) newest = t;
    }
    if (lb.length === 0 && stats.length === 0) {
      console.error('[cyberchess-daily] в базе есть строки, но ни одной разобранной — беру файл');
      return null;
    }
    // Порядок таблицы восстанавливается тем же правилом, что и в памяти:
    // строки в базе независимы и своего порядка не несут.
    lb.sort((a, b) => b.score - a.score);
    return { state: { leaderboard: lb.slice(0, LB_MAX), stats }, savedAtMs: newest };
  } catch (e) {
    console.error('[cyberchess-daily] чтение записей из базы не прошло:', (e as Error).message);
    return null;
  }
}

/** Зеркалирование в базу. Не бросает: путь решения задачи не должен падать из-за базы. */
async function saveDailyToDb(stamp: number): Promise<void> {
  if (dailyDbHealth.abandoned) return; // см. dailyReadyBounded
  const pool = await ensureDailyDb();
  if (!pool) return;
  try {
    // СТРОКА НА ИГРОКА, а не вся таблица целиком.
    //
    // Целиком было структурно неверно при двух живых процессах — а это каждый
    // деплой, пока старая реплика дослуживает. Обе держат полную копию:
    // реплика A пишет таблицу со своим новым решателем, реплика B следом пишет
    // свою — без него. Человек, решивший задачу, просто исчезает из таблицы.
    //
    // По строкам конфликтуют только правки ОДНОГО игрока. Условие на savedAt
    // оставлено: сохранения не блокируют ответ и могут прийти не по порядку.
    const byUser = new Map<string, { entry: LeaderEntry | null; stats: UserStats | null }>();
    for (const e of LEADERBOARD) byUser.set(e.userId, { entry: e, stats: null });
    for (const st of userStats.values()) {
      const slot = byUser.get(st.userId) ?? { entry: null, stats: null };
      slot.stats = st;
      byUser.set(st.userId, slot);
    }
    // Считаем ЗАПИСАННЫЕ СТРОКИ, а не проходы функции.
    //
    // Раньше saves увеличивался один раз за вызов, если тот не бросил
    // исключение. Поймано мутацией 18.08.2026: выключил запись в базу целиком —
    // строка в базе не появилась, а диагностика бодро отчиталась «записей 1».
    // То есть счётчик доказывал не запись, а отсутствие исключения; на пустом
    // наборе игроков или при отклонённой сторожем savedAtMs записи он рос бы
    // ровно так же. Диагностика, отвечающая на другой вопрос, хуже её
    // отсутствия — на неё уже смотрят как на доказательство.
    let written = 0;
    for (const [uid, slot] of byUser) {
      const r = await pool.query(
        `INSERT INTO "CyberDailyEntry" ("userId","entry","stats","savedAtMs")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("userId") DO UPDATE SET
           "entry"=EXCLUDED."entry","stats"=EXCLUDED."stats","savedAtMs"=EXCLUDED."savedAtMs"
         WHERE "CyberDailyEntry"."savedAtMs" <= EXCLUDED."savedAtMs"`,
        [uid, slot.entry ? JSON.stringify(slot.entry) : null, slot.stats ? JSON.stringify(slot.stats) : null, stamp],
      );
      written += r.rowCount ?? 0;
    }
    dailyDbHealth.rowsWritten += written;
    if (written > 0) dailyDbHealth.saves += 1;
  } catch (e) {
    dailyDbHealth.saveErrors += 1;
    dailyDbHealth.lastErrorKind = dbErrorKind(e);
    console.error(
      `[cyberchess-daily] запись записей в базу не прошла, повтор через ${DAILY_DB_RETRY_MS / 1000} с:`,
      (e as Error).message,
    );
    scheduleDailyDbRetry();
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(d?: string): number {
  return Math.floor(Date.parse(d || todayIso()) / 86400000);
}

/* Время решения приходит ОТ КЛИЕНТА, и до 21.08.2026 враньё было выгодным:
 * timeMs=0 давало максимальный бонус 300, то есть скрипт, взявший решение из
 * ответа /puzzle и отправивший его мгновенно, обходил честного игрока на 90
 * очков (400 против 310 за девяностосекундное решение).
 *
 * Проверять время по-настоящему нечем: сервер не знает, когда человек открыл
 * задачу. Но можно убрать ВЫГОДУ. Неправдоподобно малое время (и отсутствие
 * времени) считается «неизвестно» и не даёт бонуса вовсе — вместо того, чтобы
 * давать наибольший.
 *
 * Порог намеренно низкий: ходы надо ввести на доске, и уложиться в две секунды
 * человек не может даже на простой задаче. Быстрый честный игрок с тремя
 * секундами свой бонус получает полностью.
 */
const MIN_PLAUSIBLE_MS = 2_000;

function computeScore(streak: number, timeMs: number, hintsUsed: number): number {
  const timeBonus =
    timeMs >= MIN_PLAUSIBLE_MS ? Math.max(0, 300 - Math.floor(timeMs / 1000)) : 0;
  return streak * 100 + timeBonus - hintsUsed * 30;
}

function upsertLeaderboard(uid: string, name: string, country: string, streak: number, score: number) {
  const now = new Date().toISOString();
  const idx = LEADERBOARD.findIndex((e) => e.userId === uid);
  if (idx >= 0) {
    const existing = LEADERBOARD[idx];
    // Only update if new score is higher (preserves PR)
    if (score > existing.score) {
      LEADERBOARD[idx] = { ...existing, streak, score, updatedAt: now };
    } else {
      // streak still tracked even if score lower
      LEADERBOARD[idx] = { ...existing, streak: Math.max(existing.streak, streak), updatedAt: now };
    }
  } else {
    LEADERBOARD.push({ userId: uid, name, country, streak, score, updatedAt: now });
  }
  LEADERBOARD.sort((a, b) => b.score - a.score);
  if (LEADERBOARD.length > LB_MAX) LEADERBOARD = LEADERBOARD.slice(0, LB_MAX);
  saveLeaderboard(LEADERBOARD);
}

/**
 * Догрузка из базы — асинхронная, поэтому маршруты её ЖДУТ.
 *
 * «Отдаём файл сейчас, базу подхватим когда придёт» съедает данные: между
 * стартом и ответом базы кто-то решает задачу, его строка ложится поверх
 * файловой копии, а прилетевшее состояние её стирает. Проверено мутацией на
 * соседнем модуле турниров: без ожидания тест краснеет.
 */
/** Предел ожидания базы на старте — страховка от зависшего сокета: ожидание
 *  стоит перед всеми маршрутами модуля. См. тот же разбор у турниров. */
const DAILY_READY_MAX_MS = Number(process.env.CYBERCHESS_DB_READY_MS ?? 20_000);

const dailyReady: Promise<void> = (async () => {
  const fromDb = await loadDailyFromDb();
  // Ответ мог прийти после того, как ожидание бросили по времени. Подхватывать
  // состояние на ходу нельзя: кто-то уже мог решить задачу, и прилетевшая
  // копия его сотрёт.
  if (dailyDbHealth.abandoned) {
    console.error('[cyberchess-daily] ответ базы пришёл слишком поздно — записи не подхватываю, работаю на файле');
    return;
  }
  if (!fromDb) return; // базы нет или в ней пусто — живём на файле, как раньше
  if (fromDb.savedAtMs <= dailySavedAtMs) return; // файл свежее или ровесник
  LEADERBOARD = fromDb.state.leaderboard.filter((e) => !isSeededEntry(e));
  userStats.clear();
  for (const st of fromDb.state.stats) {
    if (st && typeof st.userId === 'string') userStats.set(st.userId, st);
  }
  dailySavedAtMs = fromDb.savedAtMs;
  dailyDbHealth.adoptedFromDb = true;
  console.log(
    `[cyberchess-daily] записи взяты из базы (${LEADERBOARD.length} в таблице, ${userStats.size} игроков) — она свежее файла`,
  );
})().catch((e) => {
  console.error('[cyberchess-daily] догрузка из базы не удалась, остаёмся на файле:', (e as Error).message);
});

// Ожидание готовности — до всех маршрутов модуля.
/** Признак «ожидание уже завершилось»: без него таймер срабатывал всегда и
 *  через 20 с выключал запись в базу даже при здоровой базе. См. турниры. */
let dailyReadySettled = false;

const dailyReadyBounded: Promise<void> = Promise.race([
  dailyReady.then(() => {
    dailyReadySettled = true;
  }),
  new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      if (dailyReadySettled) return resolve(); // успели — бросать нечего
      // База не ответила. Работаем на файле и больше НЕ ПИШЕМ в базу: наша
      // копия свежее по метке и затёрла бы то, что там лежит.
      dailyDbHealth.abandoned = true;
      console.error(`[cyberchess-daily] база не ответила за ${DAILY_READY_MAX_MS} мс — работаю на файле, запись в базу выключена`);
      resolve();
    }, DAILY_READY_MAX_MS);
    (t as unknown as { unref?: () => void }).unref?.();
  }),
]);

router.use(async (_req: Request, _res: Response, next: () => void) => {
  await dailyReadyBounded;
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /puzzle
 * Today's puzzle out of THIS router's own 30-entry pool.
 *
 * ⚠️ Not the puzzle players see — that is GET /api/cyberchess-puzzles/daily.
 * `source` says so in the payload so a caller cannot mistake one for the other.
 *
 * Selection goes through the shared `pickDailyPuzzle` rather than
 * `POOL[day % POOL.length]`: index arithmetic ties the answer to pool length, so
 * the page's 10-entry copy and this pool disagreed on 355 days out of 365 while
 * both looked like "day modulo pool".
 */
/**
 * Задача дня из НАСТОЯЩЕГО банка, детерминированно по дате.
 *
 * Замер 19.08.2026: в таблице ChessPuzzle 500 000 записей с живыми темами и
 * рейтингами, а задача дня отдавалась из тридцати зашитых. Тридцать — это цикл
 * повтора в месяц, и к публичному запуску 30.08 такой цикл человек заметит на
 * второй месяц.
 *
 * Детерминизм по дате обязателен: у всех игроков в один день должна быть ОДНА
 * задача, иначе таблица лидеров сравнивает несравнимое. Поэтому смещение
 * считается из самой даты, а не случайно и не по времени запроса.
 *
 * Хэш простой (FNV-1a) намеренно: нужна воспроизводимость, а не стойкость.
 * Криптографический хэш дал бы то же самое дороже.
 */
/**
 * Выбор задачи дня: день -> смещение в банке. Экспортирован ради сторожа —
 * от этой функции зависит, ради чего человек возвращается завтра, и она
 * не была закреплена ничем.
 */
export function dayOffsetHash(day: string, total: number): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(1, total);
}

/** Кэш на сутки: один запрос к базе в день, а не на каждого игрока. */
let bankPuzzleCache: { day: string; puzzle: Puzzle | null } | null = null;
let bankTotalCache: { at: number; total: number } | null = null;
const BANK_TOTAL_TTL_MS = 6 * 60 * 60 * 1000;


/** Ход в записи UCI: e2e4, g7g8q. Ничего другого движок не примет. */
function isUciMove(m: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m);
}

/**
 * Решение из банка. Колонка `sol` — ТЕКСТ, внутри которого JSON-массив
 * (`["c5c3","e6e4"]`), а не массив Postgres.
 *
 * Прежняя версия проверяла `Array.isArray` и, не найдя массива, резала строку
 * по запятым. Получались «ходы» вида `["c5c3"` и `"e6e4"` — со скобками и
 * кавычками. Задача дня становилась НЕРЕШАЕМОЙ: ни один ход игрока с таким
 * мусором не совпадёт, а подсказка показывала `["c5c3"`.
 *
 * Дефект прожил день незамеченным, потому что мои проверки спрашивали «пришла
 * ли задача из банка» и «разные ли задачи по дням» — и обе честно отвечали да.
 * Ни одна не спросила, можно ли эту задачу решить.
 */
function parseSolution(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const s = String(raw ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const j: unknown = JSON.parse(s);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {
      // не JSON — ниже разбор по разделителям
    }
  }
  return s.split(/[\s,]+/).filter(Boolean);
}

async function dailyFromBank(day: string): Promise<Puzzle | null> {
  if (bankPuzzleCache && bankPuzzleCache.day === day) return bankPuzzleCache.puzzle;
  try {
    const pool = getPool();
    if (!pool) return null;

    if (!bankTotalCache || Date.now() - bankTotalCache.at > BANK_TOTAL_TTL_MS) {
      const c = await pool.query('SELECT count(*)::int AS n FROM "ChessPuzzle"');
      const n = Number(c.rows?.[0]?.n ?? 0);
      // Ноль — это НЕ «банк пуст, отдадим что есть»: пустой ответ на упавшем
      // запросе выглядит так же. Пусть решает вызывающий: null = не смогли.
      if (!Number.isFinite(n) || n <= 0) return null;
      bankTotalCache = { at: Date.now(), total: n };
    }

    const offset = dayOffsetHash(day, bankTotalCache.total);
    const r = await pool.query(
      `SELECT "id","fen","sol","name","rating","theme" FROM "ChessPuzzle" ORDER BY "id" OFFSET $1 LIMIT 1`,
      [offset],
    );
    const row = r.rows?.[0];
    if (!row) return null;
    const sol = parseSolution(row.sol);
    // Нерешаемая задача ХУЖЕ резервной: человек не поймёт, что сломано, и решит,
    // что не умеет играть. Поэтому банк отвергается, а не показывается кое-как.
    if (!sol.every(isUciMove)) {
      console.error(`[cyberchess-daily] у задачи ${row.id} ходы не похожи на ходы: ${JSON.stringify(sol).slice(0, 80)}`);
      return null;
    }
    if (sol.length === 0) return null;
    const puzzle: Puzzle = {
      id: String(row.id),
      fen: String(row.fen),
      sol,
      theme: String(row.theme || row.name || "Тактика"),
      rating: Number(row.rating) || 1200,
    };
    bankPuzzleCache = { day, puzzle };
    return puzzle;
  } catch (e) {
    console.error("[cyberchess-daily] банк задач не ответил:", (e as Error).message);
    return null;
  }
}

router.get('/puzzle', async (_req: Request, res: Response) => {
  const day = todayIso();
  // Сначала настоящий банк, зашитые тридцать — только если он не ответил.
  const fromBank = await dailyFromBank(day);
  const p = fromBank ?? pickDailyPuzzle(POOL, dayIndex());
  if (!p) return res.status(503).json({ ok: false, error: 'pool_empty' });
  return res.json({
    day,
    poolSize: fromBank ? bankTotalCache?.total ?? null : POOL.length,
    // Источник называется ЧЕСТНО. Прежний текст отправлял читателя на
    // /api/cyberchess-puzzles/daily — ручку, которой не существует (проверено
    // 19.08: 404). Обещание, которого нет, хуже отсутствия обещания.
    source: fromBank
      ? 'ChessPuzzle — настоящий банк задач'
      : 'резервный пул из 30 задач: банк не ответил',
    puzzle: {
      id: p.id,
      fen: p.fen,
      theme: p.theme,
      rating: p.rating,
      solLength: p.sol.length,
      // ⚠️ ОБОСНОВАНИЕ ПРОТУХЛО, а следствие осталось. Здесь стояло: «this pool
      // ships in the client bundle anyway» — то есть отдавать решение не значит
      // раскрыть его. Это было верно для ЗАПАСНОГО пула из тридцати задач.
      //
      // Живой путь другой: `dailyFromBank` берёт задачу из настоящего банка на
      // 502 584 позиции (проверено на проде 27.08.2026 — `source` в ответе так
      // и называется), и ЭТОГО банка в клиентском бандле нет. Значит решение
      // сегодня действительно раскрывается: `curl /puzzle` отдаёт весь `sol`
      // кому угодно, а `POST /solve` сверяет ходы именно с ним.
      //
      // Подделать счёт этим уже нельзя так, как раньше: серию сервер считает
      // сам, день берёт свой, а бонус за неправдоподобно малое время убран
      // (21.08). Остаётся, что «решил» можно получить скриптом, не думая над
      // позицией, — таблица дня перестаёт быть про людей.
      //
      // Почему не убрано прямо сейчас: клиент проверяет КАЖДЫЙ ответный ход
      // локально, и без строки решения ему нужен серверный ответ на каждый ход.
      // Это переделка обмена, а не правка строки, и делать её за три дня до
      // запуска, когда задача дня работает, — риск больше пользы. Разбор и
      // варианты вынесены основателю (01-CyberChess, готовность к 30.08).
      sol: p.sol,
      solHint: p.sol[0],
    },
  });
});

/**
 * GET /history?days=7
 * Returns the last N daily puzzles (defaults to 7, max 30) from the same pool
 * and the same selection function as /puzzle.
 */
router.get('/history', (req: Request, res: Response) => {
  const rawDays = parseInt(String(req.query.days || '7'), 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 30) : 7;
  const today = dayIndex();
  const out: Array<{ day: string; id: string; theme: string; rating: number }> = [];
  for (let i = 0; i < days; i++) {
    const di = today - i;
    const date = new Date(di * 86400000).toISOString().slice(0, 10);
    const p = pickDailyPuzzle(POOL, di);
    if (!p) continue;
    out.push({ day: date, id: p.id, theme: p.theme, rating: p.rating });
  }
  return res.json({ days, history: out });
});

/**
 * POST /solve
 * Body: { streak: number, day: string, timeMs?: number, hintsUsed?: number, userId?: string, name?: string, country?: string }
 * Records the solve and updates leaderboard + user stats.
 */
// Bounds on what a client may claim. There are no accounts here, so /solve
// takes the player's word for their run — these exist so a wrong or invented
// word cannot become permanent. The leaderboard is sorted by score, an entry is
// only ever replaced by a HIGHER score, and the whole table is written to disk:
// one request claiming a streak of a billion took first place for good — no
// honest run can produce a higher score, and nothing lowers an existing one.
// (NaN and Infinity are not reachable here: JSON has neither, so they arrive as
// null and are already refused by the type check above.)
const MAX_STREAK = 3650; // ten years of consecutive daily puzzles
const MAX_TIME_MS = 24 * 60 * 60 * 1000;
const MAX_HINTS = 20;
const MAX_NAME_LEN = 40;
const MAX_COUNTRY_LEN = 8;

// The bounds below stop one absurd claim. They do not stop a thousand
// believable ones: user ids are whatever the caller invents, the board holds
// 1000 rows sorted by score, and it is written to disk — so a script posting
// the maximum allowed streak under fresh ids fills every place and the real
// players are pushed off a leaderboard that persists. Solving a daily puzzle
// happens once a day, so this ceiling is far above any honest use and only
// bites a flood. Shared addresses (an office, a household, a mobile carrier)
// have room to spare.
const solveLimiter = createInMemoryRateLimiter({ max: 30, windowMs: 60_000 });


/**
 * Решение задачи ТОГО ЖЕ дня, которое сервер выдал бы по GET /puzzle.
 * Отдельная функция, чтобы проверка решения и выдача задачи не разъехались:
 * два способа считать одно и то же — источник расхождений.
 */
async function solutionForDay(day: string): Promise<string[] | null> {
  const fromBank = await dailyFromBank(day);
  if (fromBank) return fromBank.sol.map((m) => m.toLowerCase());
  const p = pickDailyPuzzle(POOL, dayIndex(day));
  return p ? p.sol.map((m) => m.toLowerCase()) : null;
}

/**
 * Длина серии, заканчивающейся днём `day`, по списку уже решённых дней.
 * Считает подряд идущие календарные дни назад: вчера, позавчера и так далее.
 *
 * Раньше это число присылал клиент, и любой мог объявить себя первым в таблице
 * (проверено на проде: `{"streak":364}` без единого хода → счёт 36700).
 */

/** Предыдущий календарный день в том же виде «ГГГГ-ММ-ДД». */
function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function streakEndingAt(day: string, solvedDays: string[]): number {
  const set = new Set(solvedDays);
  let n = 1; // сегодняшний день засчитан вызовом
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 1;
  for (;;) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (!set.has(d.toISOString().slice(0, 10))) break;
    n += 1;
    if (n >= MAX_STREAK) break;
  }
  return n;
}

router.post('/solve', async (req: Request, res: Response) => {
  const gate = solveLimiter.check(clientIp(req));
  if (!gate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(gate.retryAfterMs / 1000))));
    return res.status(429).json({
      ok: false,
      error: 'rate_limited',
      retryAfterSec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)),
    });
  }

  const { day: claimedDay, timeMs, hintsUsed, userId, name, country, moves } = req.body || {};

  // День — СЕРВЕРНЫЙ, а не из тела запроса.
  //
  // Найдено вычиткой собственного дифа 19.08.2026, уже после починки подделки
  // серии. Дыра оставалась открытой с другой стороны: приняв `day` от клиента,
  // сервер позволял «дорешать» прошлые дни — прислать по запросу на каждую дату
  // и набить серию за один заход, не возвращаясь ни разу.
  //
  // Смысл ежедневной задачи именно в возвращении, поэтому дата обязана быть
  // нашей. Присланная не игнорируется молча: расхождение — это отказ, иначе
  // клиент с разъехавшимися часами будет думать, что решил, а мы запишем другой
  // день.
  const day = todayIso();
  if (typeof claimedDay === 'string' && claimedDay && claimedDay !== day) {
    return res.status(400).json({
      ok: false,
      error: 'wrong_day',
      hint: `задача дня решается в свой день; сегодня ${day}`,
      today: day,
    });
  }

  // ── Решение ПРОВЕРЯЕТСЯ, а не принимается на слово ───────────────────────
  //
  // Прежде ручка брала `streak` числом из тела и записывала его. Проверено на
  // проде 19.08.2026: запрос `{"streak":364}` без единого хода поставил меня
  // первым в таблице со счётом 36700. Таблица лидеров, которую может подделать
  // любой посторонний, хуже отсутствующей: она выглядит как достижения людей.
  //
  // Теперь клиент присылает ХОДЫ, а сервер сверяет их с решением того дня,
  // которое знает сам. Серия считается по нашей истории, а не по числу извне.
  if (!Array.isArray(moves) || moves.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'moves_required',
      hint: 'пришлите ходы решения (UCI), серию сервер посчитает сам',
    });
  }
  const expected = await solutionForDay(day);
  if (!expected) {
    return res.status(503).json({ ok: false, error: 'puzzle_unavailable' });
  }
  const given = moves.map((m: unknown) => String(m).trim().toLowerCase());
  const solved = given.length === expected.length && given.every((m, i) => m === expected[i]);
  if (!solved) {
    return res.status(400).json({ ok: false, error: 'wrong_solution' });
  }
  const tMs = typeof timeMs === 'number' && timeMs >= 0 ? Math.min(timeMs, MAX_TIME_MS) : 0;
  const hUsed = typeof hintsUsed === 'number' && hintsUsed >= 0 ? Math.min(Math.floor(hintsUsed), MAX_HINTS) : 0;
  const uid = typeof userId === 'string' && userId.length > 0 ? userId : 'anonymous';
  // Имя в ПУБЛИЧНОЙ таблице: пускаем только то, что человек сможет прочитать.
  //
  // Замер 19.08.2026: в рейтинге на проде лежали четыре записи, у которых имя
  // состояло из символов-замен (U+FFFD, в байтах ef bf bd) — их оставили
  // проверки, отправленные утилитой, которая портит кириллицу при отправке.
  // Снаружи это выглядело как «в лидерах ████████3 со счётом 100 200».
  // Пустая строка после чистки — не ошибка запроса: решение засчитывается,
  // просто имя подставляется наше.
  // Имя с символом-заменой не чинится вычиткой: от «Тестер3» остаётся «3».
  // Пришло испорченным — не доверяем целиком и подставляем своё.
  const nameOk = typeof name === 'string' && name.indexOf('\uFFFD') < 0;
  const rawName = nameOk ? (name as string).trim() : '';
  const uname = rawName.length > 0 ? rawName.slice(0, MAX_NAME_LEN) : `Player_${uid.slice(0, 6)}`;
  const uctry = typeof country === 'string' && country.length > 0 ? country.slice(0, MAX_COUNTRY_LEN) : '🌍';

  // Серия — производное от нашей истории, а не поле запроса. Считается ДО
  // записи сегодняшнего дня: сегодня всегда +1 к тому, что было вчера.
  const priorHistory = userStats.get(uid)?.history ?? [];
  const solvedDays = priorHistory.map((h) => h.day);
  // Подсказка не растит серию, но и не рвёт её — это правило продукта, и оно
  // написано на самом экране: «Streak не растёт, но и не сбрасывается».
  //
  // Найдено вычиткой: перенеся подсчёт на сервер, я стал считать любой решённый
  // день, и серия росла ВОПРЕКИ надписи. Экран обещал одно, сервер делал другое,
  // и заметить это было нечем — числа расходятся молча.
  //
  // День всё равно попадает в историю ниже, поэтому цепочка не рвётся: завтра
  // сегодняшний день уже будет засчитан.
  // Осторожно: streakEndingAt считает переданный день решённым ПО УСЛОВИЮ. Для
  // вчерашнего это верно только если вчера действительно решали, иначе новичок
  // с подсказкой получил бы серию 1 из воздуха.
  const вчера = previousDay(day);
  const streak = hUsed > 0
    ? (solvedDays.includes(вчера) ? streakEndingAt(вчера, solvedDays) : 0)
    : streakEndingAt(day, solvedDays);
  const score = computeScore(streak, tMs, hUsed);
  const key = `${uid}:${day}`;
  const record: SolveRecord = { day, streak, userId: uid, timeMs: tMs, hintsUsed: hUsed, score };
  solveStore.set(key, record);

  // Update user stats
  const stats: UserStats = userStats.get(uid) || {
    userId: uid,
    bestStreak: 0,
    totalSolved: 0,
    totalTimeMs: 0,
    history: [],
  };
  const isNewDay = !stats.history.some((h) => h.day === day);
  if (isNewDay) {
    stats.totalSolved += 1;
    stats.totalTimeMs += tMs;
    stats.history.push({ day, timeMs: tMs, hintsUsed: hUsed, streak, score });
    // keep last 365 entries max
    if (stats.history.length > 365) stats.history = stats.history.slice(-365);
  }
  const prevBest = stats.bestStreak;
  if (streak > prevBest) stats.bestStreak = streak;
  userStats.set(uid, stats);

  // Update leaderboard (non-anonymous only)
  if (uid !== 'anonymous') {
    upsertLeaderboard(uid, uname, uctry, streak, score);
  }

  return res.json({
    ok: true,
    newRecord: streak > prevBest,
    streak,
    bestStreak: Math.max(prevBest, streak),
    day,
    timeMs: tMs,
    hintsUsed: hUsed,
    score,
  });
});

/**
 * GET /leaderboard?limit=100
 * Returns top-N entries sorted by score desc.
 */
// GET /_persistence — диагностика хранилища: только числа и признаки, без
// данных игроков. Нужна ровно для одного: запросы к Postgres здесь не
// выполнялись на настоящем сервере (локально его нет), поэтому ответить,
// работает ли перенос, должен первый деплой, а не наша вера в правильность SQL.
router.get('/_persistence', (_req: Request, res: Response) => {
  return res.json({
    ok: true,
    leaderboard: LEADERBOARD.length,
    players: userStats.size,
    fileReadable: leaderboardReadable,
    db: { ...dailyDbHealth },
  });
});

router.get('/leaderboard', (req: Request, res: Response) => {
  // Пустой список на этой ручке страница подписывает словами «Пока никто не
  // решал». Если файл не прочитан, мы этого не знаем — и говорить не вправе.
  if (!leaderboardReadable) {
    return res.status(503).json({ ok: false, error: 'leaderboard_unavailable' });
  }
  const rawLimit = parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, LB_MAX) : 100;
  // Записи с нечитаемым именем не показываем. Приём таких имён закрыт выше, но
  // четыре штуки успели попасть в боевую таблицу 19.08 — витрина показывала
  // «████████3 — 100 200 очков». Данные не трогаем: скрыть обратимо, удалить нет.
  const readable = LEADERBOARD.filter((e) => !String(e.name || '').includes('�'));
  return res.json({
    leaderboard: readable.slice(0, limit),
    total: readable.length,
  });
});

/**
 * GET /user/:userId/stats
 * Returns aggregated stats for a single user.
 */
router.get('/user/:userId/stats', (req: Request, res: Response) => {
  const uid = String(req.params.userId);
  const stats = userStats.get(uid);
  if (!stats) {
    // Записи нет — но это НЕ то же самое, что «человек ничего не решал».
    // userStats живёт только в памяти процесса: любой перезапуск обнуляет её,
    // а таблица лидеров сохраняется на диск. Отдавая здесь нули, сервер
    // сообщал «решено: 0» тому, кто в тот же момент стоит в таблице со своей
    // серией — два числа об одном человеке на одном экране, и оба наши.
    //
    // Что знаем достоверно, то и отдаём: лучшая серия есть в сохранённой
    // таблице. Остальное помечено как неизвестное, а не как ноль.
    const known = LEADERBOARD.find((e) => e.userId === uid);
    return res.json({
      userId: uid,
      bestStreak: known ? known.streak : 0,
      totalSolved: null,
      avgTimeMs: null,
      history: [],
      statsKnown: false,
    });
  }
  const avg = stats.totalSolved > 0 ? Math.round(stats.totalTimeMs / stats.totalSolved) : 0;
  return res.json({
    userId: stats.userId,
    bestStreak: stats.bestStreak,
    totalSolved: stats.totalSolved,
    avgTimeMs: avg,
    statsKnown: true,
    history: stats.history.slice(-30), // last 30 days
  });
});

/**
 * POST /reset (admin)
 * Header: X-Admin-Key must match process.env.CYBERCHESS_ADMIN_KEY
 * Wipes leaderboard + stats. Intended for ops/testing only.
 */
router.post('/reset', (req: Request, res: Response) => {
  const provided = (req.headers['x-admin-key'] || req.body?.adminKey || '') as string;
  const expected = process.env.CYBERCHESS_ADMIN_KEY || '';
  if (!expected) {
    return res.status(503).json({ ok: false, error: 'admin reset disabled (CYBERCHESS_ADMIN_KEY not set)' });
  }
  if (!provided || provided !== expected) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  LEADERBOARD = [];
  saveLeaderboard(LEADERBOARD);
  userStats.clear();
  solveStore.clear();
  return res.json({ ok: true, reset: true, leaderboardSize: LEADERBOARD.length });
});

export default router;
