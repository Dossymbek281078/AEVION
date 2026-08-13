import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { pickDailyPuzzle } from '../lib/cyberchessDailyPuzzle';
import { createInMemoryRateLimiter } from '../lib/rateLimit/inMemoryWindow';
import { clientIp } from '../lib/rateLimit';
// Обычный импорт, а не require: под `require` подмена драйвера в тестах не
// действует, и тест «зеленеет», не выполнив ни одного запроса (12.08).
import pg from 'pg';

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

async function ensureDailyDb(): Promise<any> {
  if (dailyDbTried) return dailyPool;
  dailyDbTried = true;
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CyberDailyState" (
        "id"      TEXT PRIMARY KEY,
        "state"   JSONB NOT NULL,
        "savedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    dailyPool = pool;
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
    const r = await pool.query(`SELECT "state","savedAt" FROM "CyberDailyState" WHERE "id"='singleton'`);
    const row = r.rows?.[0];
    if (!row) return null;
    const lb = Array.isArray(row.state?.leaderboard) ? (row.state.leaderboard as LeaderEntry[]) : null;
    if (!lb) {
      console.error('[cyberchess-daily] строка в базе не той формы — беру файл');
      return null;
    }
    const stats = Array.isArray(row.state?.stats) ? (row.state.stats as UserStats[]) : [];
    const t = row.savedAt ? new Date(row.savedAt).getTime() : 0;
    return { state: { leaderboard: lb, stats }, savedAtMs: Number.isFinite(t) ? t : 0 };
  } catch (e) {
    console.error('[cyberchess-daily] чтение записей из базы не прошло:', (e as Error).message);
    return null;
  }
}

/** Зеркалирование в базу. Не бросает: путь решения задачи не должен падать из-за базы. */
async function saveDailyToDb(stamp: number): Promise<void> {
  const pool = await ensureDailyDb();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO "CyberDailyState" ("id","state","savedAt") VALUES ('singleton',$1,to_timestamp($2/1000.0))
       ON CONFLICT ("id") DO UPDATE SET "state"=EXCLUDED."state","savedAt"=EXCLUDED."savedAt"
       -- Условие делает запись МОНОТОННОЙ: строку обновляет только более
       -- свежее состояние. Без него два сохранения, отправленные подряд и не
       -- дождавшиеся друг друга (запись в базу намеренно не блокирует ответ
       -- игроку), могут прийти в обратном порядке — и старое состояние затрёт
       -- новое. Ровно та тихая потеря, ради устранения которой всё писалось.
       WHERE "CyberDailyState"."savedAt" <= EXCLUDED."savedAt"`,
      [JSON.stringify({ leaderboard: LEADERBOARD, stats: [...userStats.values()] }), stamp],
    );
  } catch (e) {
    console.error('[cyberchess-daily] запись записей в базу не прошла:', (e as Error).message);
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(d?: string): number {
  return Math.floor(Date.parse(d || todayIso()) / 86400000);
}

function computeScore(streak: number, timeMs: number, hintsUsed: number): number {
  const timeBonus = Math.max(0, 300 - Math.floor(timeMs / 1000));
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
const dailyReady: Promise<void> = (async () => {
  const fromDb = await loadDailyFromDb();
  if (!fromDb) return; // базы нет или в ней пусто — живём на файле, как раньше
  if (fromDb.savedAtMs <= dailySavedAtMs) return; // файл свежее или ровесник
  LEADERBOARD = fromDb.state.leaderboard.filter((e) => !isSeededEntry(e));
  userStats.clear();
  for (const st of fromDb.state.stats) {
    if (st && typeof st.userId === 'string') userStats.set(st.userId, st);
  }
  dailySavedAtMs = fromDb.savedAtMs;
  console.log(
    `[cyberchess-daily] записи взяты из базы (${LEADERBOARD.length} в таблице, ${userStats.size} игроков) — она свежее файла`,
  );
})().catch((e) => {
  console.error('[cyberchess-daily] догрузка из базы не удалась, остаёмся на файле:', (e as Error).message);
});

// Ожидание готовности — до всех маршрутов модуля.
router.use(async (_req: Request, _res: Response, next: () => void) => {
  await dailyReady;
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
router.get('/puzzle', (_req: Request, res: Response) => {
  const p = pickDailyPuzzle(POOL, dayIndex());
  if (!p) return res.status(503).json({ ok: false, error: 'pool_empty' });
  return res.json({
    day: todayIso(),
    poolSize: POOL.length,
    source: 'cyberchess-daily fallback pool — the live daily puzzle is /api/cyberchess-puzzles/daily',
    puzzle: {
      id: p.id,
      fen: p.fen,
      theme: p.theme,
      rating: p.rating,
      solLength: p.sol.length,
      // Full line: the client has to validate every reply, not just the first
      // move, and this pool ships in the client bundle anyway.
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

router.post('/solve', (req: Request, res: Response) => {
  const gate = solveLimiter.check(clientIp(req));
  if (!gate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(gate.retryAfterMs / 1000))));
    return res.status(429).json({
      ok: false,
      error: 'rate_limited',
      retryAfterSec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)),
    });
  }

  const { streak, day, timeMs, hintsUsed, userId, name, country } = req.body || {};
  if (typeof streak !== 'number' || typeof day !== 'string') {
    return res.status(400).json({ ok: false, error: 'streak (number) and day (string) required' });
  }
  // Whole, non-negative, and within a range a real player could reach.
  if (!Number.isInteger(streak) || streak < 0 || streak > MAX_STREAK) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_streak',
      hint: `streak must be a whole number between 0 and ${MAX_STREAK}`,
    });
  }
  const tMs = typeof timeMs === 'number' && timeMs >= 0 ? Math.min(timeMs, MAX_TIME_MS) : 0;
  const hUsed = typeof hintsUsed === 'number' && hintsUsed >= 0 ? Math.min(Math.floor(hintsUsed), MAX_HINTS) : 0;
  const uid = typeof userId === 'string' && userId.length > 0 ? userId : 'anonymous';
  const uname = typeof name === 'string' && name.length > 0 ? name.slice(0, MAX_NAME_LEN) : `Player_${uid.slice(0, 6)}`;
  const uctry = typeof country === 'string' && country.length > 0 ? country.slice(0, MAX_COUNTRY_LEN) : '🌍';

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
router.get('/leaderboard', (req: Request, res: Response) => {
  // Пустой список на этой ручке страница подписывает словами «Пока никто не
  // решал». Если файл не прочитан, мы этого не знаем — и говорить не вправе.
  if (!leaderboardReadable) {
    return res.status(503).json({ ok: false, error: 'leaderboard_unavailable' });
  }
  const rawLimit = parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, LB_MAX) : 100;
  return res.json({
    leaderboard: LEADERBOARD.slice(0, limit),
    total: LEADERBOARD.length,
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
