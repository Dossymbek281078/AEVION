// AEVION CyberChess — server-side puzzle pool
// Mount expected at: /api/cyberchess-puzzles
//
// Serves the puzzle pool from data/cyberchess-puzzles.json with server-side
// filtering (theme / rating / phase) + pagination, instead of the frontend
// downloading the whole 2.4 MB file and filtering client-side. The pool is
// growable: run scripts/import-lichess-puzzles-dump.mjs against a Lichess CSV
// dump to expand it toward lichess-scale without touching this code.
//
// All handlers are defensive: a missing/corrupt pool file degrades to an empty
// result (the frontend falls back to its bundled copy), never a crash.

import { Router, type Request, type Response } from "express";
import * as fs from "node:fs";
import { getPool } from "../lib/dbPool";
import { ispravitPodpisMata } from "../lib/chessPuzzleLabel";

const router = Router();

interface Puzzle {
  /**
   * Идентификатор задачи у источника: id задачи Lichess ("382iH") либо "gen_…"
   * для сгенерированных. Необязательное поле, и это НЕ недоделка — у банка три
   * источника, и идентификаторы есть только у двух:
   *   Postgres "ChessPuzzle" — id это первичный ключ, он есть всегда;
   *   локальный файл дампа — есть, если дамп его нёс;
   *   запасной публичный пул aevion.app/puzzles.json — НЕТ ни у одной записи
   *     (проверено 07.10.2026: слово "id" в нём встречается 0 раз).
   * Поэтому ссылка на конкретную задачу работает, когда банк пришёл из базы, и
   * честно отказывается, когда работаем на запасном пуле. Молча отвечать
   * «задачи нет» в этом случае нельзя: задача есть, её нельзя НАЙТИ.
   */
  id?: string;
  fen: string;
  sol: string[];
  name: string;
  r: number; // rating
  theme: string;
  phase?: string;
  side?: string;
  goal?: string;
  mateIn?: number;
}

// Optional LOCAL pool file — for ops who mount a large imported dump on a
// volume. NOTE: on Railway a persistent volume is mounted at data/ (so
// tournament writes survive redeploys), which SHADOWS any seed committed under
// data/. So we do NOT ship a seed file there; instead the default source is the
// already-public puzzles.json served by the frontend (single source of truth).
const POOL_PATH = process.env.CYBERCHESS_PUZZLES_PATH || "";
const POOL_URL =
  process.env.CYBERCHESS_PUZZLES_URL ||
  "https://aevion.app/puzzles.json";

let POOL: Puzzle[] = [];
// ОТКУДА пул на самом деле. Раньше ответы отдавали адрес бандла
// (POOL_PATH или POOL_URL) ВСЕГДА, даже когда данные пришли из Postgres. На проде
// 11.08.2026 это выглядело так: poolSize 500000 (из БД) при source, указывающем
// на bundled-файл с 10 818 задачами — ответ противоречил сам себе, и понять по
// нему, что реально отдаётся игрокам, было нельзя.
//
// Описание источника ingest() получал и раньше, но тратил его только на
// console.warn при ошибке. Теперь сохраняем.
let POOL_SOURCE = "";
// НАСТОЯЩИЙ размер банка, а не размер выборки. Разница важна для продающих
// страниц: POOL.length упирается в cap (по умолчанию 500 000), и ответ
// «poolSize: 500000» при cap = 500 000 — это не измерение, а обрезка. Взять
// такое число на страницу значило бы напечатать настройку под видом факта.
// 0 = не знаем (источник не умеет считать себя), и это НЕ то же самое, что 0 задач.
let POOL_TOTAL = 0;
let POOL_CAPPED = false;
// theme (lowercased) -> index list, built once for cheap filtered lookups
const THEME_INDEX = new Map<string, number[]>();
/**
 * Указатель «id задачи → её место в пуле». Нужен ссылке на конкретную задачу
 * (/api/cyberchess-puzzles/:id): перебор по 500 000 записей на каждый заход —
 * это полсекунды процессорного времени на ровном месте.
 *
 * Пустой указатель при НЕпустом пуле — законное состояние, а не поломка: так
 * выглядит запасной публичный пул, в котором идентификаторов нет вовсе. Ручка
 * отличает это от «нет такой задачи» и отвечает по-разному.
 */
const ID_INDEX = new Map<string, number>();
let loadPromise: Promise<void> | null = null;

function ingest(arr: unknown, source: string): void {
  if (!Array.isArray(arr)) {
    console.warn(`[cyberchess-puzzles] ${source}: unexpected shape — serving empty`);
    return;
  }
  POOL = (arr as Puzzle[])
    .filter((p) => p && typeof p.fen === "string" && Array.isArray(p.sol) && p.sol.length > 0)
    // Подпись задачи приводим к её РЕШЕНИЮ здесь, в единственной воронке всех
    // трёх источников (файл, база, URL). Делать это в ветке базы было бы
    // починкой одной двери из трёх: пул грузится из файла и по URL тоже, и
    // ровно файловая ветка работает в прогонах.
    //
    // Зачем вообще: у Lichess набор тем кончается на mateIn5, любой мат длиннее
    // помечен тем же словом, и наш сев скопировал число и в поле, и в название.
    // Замер 05.10.2026: 6 из 43 задач темы «Мат в 5+» матуют не в 5.
    .map((p) => {
      const podpis = ispravitPodpisMata({ name: p.name, sol: p.sol, goal: p.goal, mateIn: p.mateIn });
      if (!podpis.ispravleno) return p;
      return { ...p, name: podpis.name, ...(podpis.mateIn != null ? { mateIn: podpis.mateIn } : {}) };
    });
  POOL_SOURCE = source;
  // По умолчанию источник равен тому, что загрузили: для файла и URL весь банк
  // и есть выборка. DB-ветка ниже перезапишет это настоящим COUNT(*).
  POOL_TOTAL = POOL.length;
  POOL_CAPPED = false;
  THEME_INDEX.clear();
  ID_INDEX.clear();
  for (let i = 0; i < POOL.length; i++) {
    const key = String(POOL[i].theme || "").toLowerCase();
    const bucket = THEME_INDEX.get(key);
    if (bucket) bucket.push(i);
    else THEME_INDEX.set(key, [i]);
    // Map, а НЕ обычный объект: ключ приходит из адреса, а поиск по объекту
    // ключом из запроса — наш известный класс (ищется aevion-proto-watch).
    // "__proto__" и "constructor" в Map это обычные ключи и ничего не ломают.
    const id = POOL[i].id;
    if (typeof id === "string" && id.length > 0 && !ID_INDEX.has(id)) ID_INDEX.set(id, i);
  }
  console.log(`[cyberchess-puzzles] loaded ${POOL.length} puzzles, ${THEME_INDEX.size} themes (${source})`);
}

// Load once, cached via a shared promise. Local file (if configured) wins;
// otherwise fetch the public pool URL. Any failure → empty pool (frontend
// falls back to its bundled copy). Never throws.
function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // 1) explicit local file (large mounted dump)
    if (POOL_PATH) {
      try {
        if (fs.existsSync(POOL_PATH)) {
          const parsed = JSON.parse(fs.readFileSync(POOL_PATH, "utf-8"));
          ingest(Array.isArray(parsed) ? parsed : parsed && parsed.puzzles, `file ${POOL_PATH}`);
          if (POOL.length > 0) return;
        }
      } catch (e) {
        console.warn("[cyberchess-puzzles] local file load failed:", e instanceof Error ? e.message : e);
      }
    }
    // 2) Postgres ChessPuzzle table — масштабируемый источник истины, как только
    //    он засеян (scripts/seed-puzzles.mjs → POST /api/puzzles/seed из CC0-дампа
    //    Lichess). Это недостающее звено: DB-пайплайн (модель+/api/puzzles+seed)
    //    уже был, но фронт зовёт ЭТОТ роут — теперь при непустой таблице игроки
    //    получают расширенный пул. Zero-regression: нет DB/таблица пуста/ошибка →
    //    проваливаемся на публичный URL (bundled 10.8k) ниже.
    if (process.env.DATABASE_URL) {
      try {
        const cap = Math.max(1, Math.min(2_000_000, Number(process.env.CYBERCHESS_PUZZLES_DB_CAP) || 500_000));
        const pool = getPool();
        const q = await pool.query(
          `SELECT "id","fen","sol","name","rating","theme","phase","side","goal","mateIn" FROM "ChessPuzzle" LIMIT $1`,
          [cap],
        );
        if (q.rows && q.rows.length > 0) {
          const mapped = q.rows.map((row: Record<string, unknown>) => {
            let sol: string[];
            const raw = String(row.sol ?? "");
            try { const a = JSON.parse(raw); sol = Array.isArray(a) ? a.map(String) : raw.split(/\s+/).filter(Boolean); }
            catch { sol = raw.split(/\s+/).filter(Boolean); }
            // Подпись НЕ правим здесь: это делает ingest() — одна воронка на
            // файл, базу и URL. Две копии одного правила разошлись бы.
            return {
              // id выбирается и переносится здесь, а не «само собой»: эта ветвь
              // собирает объект по полям, и всё, что не названо, теряется. До
              // 07.10.2026 id не был назван — и прод, работающий ИМЕННО из базы
              // (source: "db ChessPuzzle (500000)"), отдавал задачи без
              // идентификатора, то есть ссылку на конкретную задачу дать было
              // нечем. Ветви файла и URL ничего не теряли: там объект копируется
              // целиком через ...p.
              id: row.id != null ? String(row.id) : undefined,
              fen: String(row.fen ?? ""),
              sol,
              name: String(row.name ?? "Тактика"),
              r: Number(row.rating ?? 1200),
              theme: String(row.theme ?? "Тактика"),
              phase: row.phase != null ? String(row.phase) : undefined,
              side: row.side != null ? String(row.side) : undefined,
              goal: row.goal != null ? String(row.goal) : undefined,
              mateIn: row.mateIn != null ? Number(row.mateIn) : undefined,
            } as Puzzle;
          });
          ingest(mapped, `db ChessPuzzle (${q.rows.length})`);
          // Настоящий размер таблицы — отдельным запросом, ПОСЛЕ ingest():
          // ingest ставит POOL_TOTAL = POOL.length, и здесь мы его уточняем.
          // Свой try/catch: медленный или упавший COUNT(*) не должен ронять
          // уже загруженный пул — тогда просто остаёмся без точного числа.
          try {
            const c = await pool.query(`SELECT COUNT(*)::bigint AS n FROM "ChessPuzzle"`);
            // pg отдаёт bigint строкой — Number() обязателен, иначе сравнение
            // с cap пойдёт лексикографически ("500000" > "1000000" как строки).
            const n = Number(c.rows?.[0]?.n ?? 0);
            if (Number.isFinite(n) && n > 0) {
              POOL_TOTAL = n;
              POOL_CAPPED = n > POOL.length;
            }
          } catch (e) {
            console.warn("[cyberchess-puzzles] COUNT(*) failed:", e instanceof Error ? e.message : e);
          }
          if (POOL.length > 0) return;
        }
      } catch (e) {
        console.warn("[cyberchess-puzzles] DB load failed (falling back to URL):", e instanceof Error ? e.message : e);
      }
    }
    // 3) public URL (default source of truth — bundled 10.8k)
    try {
      const r = await fetch(POOL_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const parsed = await r.json();
      ingest(Array.isArray(parsed) ? parsed : parsed && (parsed as { puzzles?: unknown }).puzzles, `url ${POOL_URL}`);
    } catch (e) {
      console.warn("[cyberchess-puzzles] url load failed:", e instanceof Error ? e.message : e);
    }
  })();
  return loadPromise;
}

// warm the pool at startup (non-blocking)
void ensureLoaded();

function toInt(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : dflt;
}

// GET / — filtered, paginated puzzle query.
// Query: theme, minRating, maxRating, phase, limit (<=200), offset,
//        shuffle=1 (random sample within the filtered set).
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureLoaded();
    // ensureLoaded() swallows a failed source fetch on purpose (warm-up must not
    // crash the process), so an empty pool here means the load failed - not that
    // there are no puzzles. Answering ok:true would show an empty trainer.
    if (POOL.length === 0) {
      res.status(503).json({
        ok: false, reason: "puzzle_pool_empty",
        total: 0, count: 0, offset: 0, poolSize: 0, puzzles: [],
      });
      return;
    }
    const theme = String(req.query.theme || "").trim().toLowerCase();
    const phase = String(req.query.phase || "").trim().toLowerCase();
    const minRating = toInt(req.query.minRating, 0);
    const maxRating = toInt(req.query.maxRating, 4000);
    // Cap high enough to serve a full initial training bank in one request
    // (the whole current pool is ~10.8k). Bounded so a grown million-scale pool
    // still returns a sane sample per request.
    const limit = Math.min(25000, Math.max(1, toInt(req.query.limit, 50)));
    const offset = Math.max(0, toInt(req.query.offset, 0));
    const shuffle = req.query.shuffle === "1" || req.query.shuffle === "true";

    // Candidate index set: use the theme index when a theme is given.
    const candidateIdx =
      theme && THEME_INDEX.has(theme)
        ? THEME_INDEX.get(theme)!
        : theme
          ? [] // theme requested but unknown → no matches
          : POOL.map((_, i) => i);

    const matched: Puzzle[] = [];
    for (const i of candidateIdx) {
      const p = POOL[i];
      if (p.r < minRating || p.r > maxRating) continue;
      if (phase && String(p.phase || "").toLowerCase() !== phase) continue;
      matched.push(p);
    }

    const total = matched.length;
    let page: Puzzle[];
    if (shuffle) {
      // Fisher-Yates partial shuffle to sample `limit` without bias.
      const idxs = matched.map((_, i) => i);
      const take = Math.min(limit, idxs.length);
      for (let i = 0; i < take; i++) {
        const j = i + Math.floor(Math.random() * (idxs.length - i));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }
      page = idxs.slice(0, take).map((i) => matched[i]);
    } else {
      page = matched.slice(offset, offset + limit);
    }

    // poolSize — обслуживаемая выборка (упирается в cap), bankTotal — настоящий
    // размер банка. Публиковать первое без второго нельзя: круглое число
    // читается как измерение банка. См. разбор в шапке файла.
    res.json({
      ok: true, total, count: page.length, offset,
      poolSize: POOL.length, bankTotal: POOL_TOTAL, capped: POOL_CAPPED,
      puzzles: page,
    });
  } catch (e) {
    console.warn("[cyberchess-puzzles] query failed:", e instanceof Error ? e.message : e);
    // ok:true with an empty list is indistinguishable from "your filter matched
    // nothing", so a failure here renders as a legitimately empty trainer.
    res.status(503).json({
      ok: false, reason: "puzzle_query_failed",
      total: 0, count: 0, offset: 0,
      poolSize: POOL.length, bankTotal: POOL_TOTAL, capped: POOL_CAPPED,
      puzzles: [],
    });
  }
});

// GET /themes — distinct themes with counts, for building filter UIs.
router.get("/themes", async (_req: Request, res: Response): Promise<void> => {
  await ensureLoaded();
  const themes = [...THEME_INDEX.entries()]
    .map(([key, idxs]) => ({ theme: POOL[idxs[0]]?.theme ?? key, count: idxs.length }))
    .sort((a, b) => b.count - a.count);
  // poolSize здесь — сколько задач ОБСЛУЖИВАЕТСЯ, и он упирается в cap.
  // Отдавать одно это число нельзя: при cap = 500 000 ответ «poolSize: 500000»
  // выглядит измерением банка, а на деле это обрезка — ровно то, о чём
  // предупреждает разбор в шапке файла. Замер 28.08.2026: /themes отвечал
  // 500000, а /cyberchess-daily/puzzle про тот же банк — 502584, и по двум
  // нашим ответам нельзя было понять, какой из них про что.
  // Соседняя ручка /meta уже отдаёт обе величины; здесь их не хватало.
  res.json({
    ok: true,
    poolSize: POOL.length,
    bankTotal: POOL_TOTAL,
    capped: POOL_CAPPED,
    themes,
  });
});

// GET /meta — pool health/size (cheap smoke).
router.get("/meta", async (_req: Request, res: Response): Promise<void> => {
  await ensureLoaded();
  // poolSize — сколько задач обслуживается сейчас (упирается в cap).
  // bankTotal — сколько их в источнике на самом деле; для страниц брать ЭТО.
  // capped — обслуживаем не весь банк, число занижено намеренно.
  res.json({
    ok: true,
    poolSize: POOL.length,
    bankTotal: POOL_TOTAL,
    capped: POOL_CAPPED,
    themes: THEME_INDEX.size,
    source: POOL_SOURCE || POOL_PATH || POOL_URL,
  });
});

/**
 * GET /:id — ОДНА задача по её идентификатору.
 *
 * Зачем: без неё ссылка на конкретную задачу невозможна. Ролик, пост или разбор
 * может позвать человека «вот эта позиция», а открывалась у него случайная из
 * 500 000 — то есть обещание ссылки не исполнялось.
 *
 * 🔴 ОБЪЯВЛЕН ПОСЛЕ /themes и /meta, и порядок здесь — не стиль. В Express
 * маршруты сверяются по порядку объявления, и ":id" совпадает с ЛЮБЫМ одиночным
 * отрезком пути. Объяви его выше — и /themes стал бы задачей с идентификатором
 * "themes": обе ручки отвечали бы 404 на совершенно верный запрос, а причина
 * выглядела бы как «данные пропали».
 *
 * 🔴 ТРИ ИСХОДА, А НЕ ДВА — иначе ручка врёт о банке:
 *   400 bad_id   — на идентификатор не похоже (в адрес пришёл мусор). Неверные
 *                  данные запроса это 4xx: 5xx поднимало бы людей зря.
 *   503 ids_unavailable — пул загружен, но идентификаторов в нём НЕТ НИ У ОДНОЙ
 *                  задачи. Так выглядит работа на запасном публичном пуле
 *                  (проверено 07.10.2026: в aevion.app/puzzles.json слово "id"
 *                  встречается 0 раз). Ответить здесь 404 значило бы сказать
 *                  «такой задачи не существует», хотя она существует и просто
 *                  не ищется. Это наш класс «не знаю — ведите себя как при
 *                  отказе, но не молчите».
 *   404 not_found — идентификаторы есть, этого среди них нет. В теле называем
 *                  poolSize/bankTotal/capped: выборка упирается в cap (на проде
 *                  500 000 из 502 584), поэтому «нет в выдаче» и «нет в банке» —
 *                  разные утверждения, и читатель обязан видеть, какое из них.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  // Форма проверяется ДО любого поиска. Идентификаторы Lichess это пять знаков
  // букв и цифр ("382iH"), сгенерированные — "gen_<что-то>". Всё остальное
  // отбиваем здесь: ручка перестаёт быть входом для чужих форм ввода.
  const id = String(req.params.id || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    res.status(400).json({ ok: false, reason: "bad_id" });
    return;
  }
  try {
    await ensureLoaded();
    if (POOL.length === 0) {
      // Тот же разбор, что у выборки выше: пустой пул означает неудачу загрузки,
      // а не отсутствие задач, и ok:true показал бы пустой тренажёр.
      res.status(503).json({ ok: false, reason: "puzzle_pool_empty" });
      return;
    }
    if (ID_INDEX.size === 0) {
      res.status(503).json({
        ok: false,
        reason: "ids_unavailable",
        // 🔴 poolSize НЕ публикуется в одиночку, и это не формальность. На проде
        // выборка упирается в cap: «poolSize: 500000» при cap = 500 000 — это
        // обрезка, а читается как измерение банка. Поэтому рядом всегда
        // настоящий размер и признак обрезки; правило держит сторож
        // puzzlePoolSizeNeverAlone, и он поймал ровно эту ветку (1 место из 7).
        poolSize: POOL.length,
        bankTotal: POOL_TOTAL,
        capped: POOL_CAPPED,
        source: POOL_SOURCE || POOL_PATH || POOL_URL,
      });
      return;
    }
    const i = ID_INDEX.get(id);
    if (i === undefined) {
      res.status(404).json({
        ok: false,
        reason: "not_found",
        poolSize: POOL.length,
        bankTotal: POOL_TOTAL,
        capped: POOL_CAPPED,
      });
      return;
    }
    res.json({ ok: true, puzzle: POOL[i] });
  } catch (e) {
    console.warn("[cyberchess-puzzles] lookup failed:", e instanceof Error ? e.message : e);
    res.status(503).json({ ok: false, reason: "puzzle_lookup_failed" });
  }
});

/**
 * POST /reload (admin)
 * Header: X-Admin-Key must match process.env.CYBERCHESS_ADMIN_KEY
 *
 * ensureLoaded() caches its result for the lifetime of the process — after
 * scripts/seed-puzzles.mjs grows the ChessPuzzle table, an already-running
 * backend keeps serving the smaller pool it loaded at startup until it
 * happens to redeploy. This forces a re-load without waiting on that.
 */
router.post("/reload", async (req: Request, res: Response): Promise<void> => {
  const provided = (req.headers["x-admin-key"] || req.body?.adminKey || "") as string;
  const expected = process.env.CYBERCHESS_ADMIN_KEY || "";
  if (!expected) {
    res.status(503).json({ ok: false, error: "admin reload disabled (CYBERCHESS_ADMIN_KEY not set)" });
    return;
  }
  if (!provided || provided !== expected) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }
  loadPromise = null;
  await ensureLoaded();
  res.json({
    ok: true,
    poolSize: POOL.length,
    bankTotal: POOL_TOTAL,
    capped: POOL_CAPPED,
    themes: THEME_INDEX.size,
  });
});

export default router;
