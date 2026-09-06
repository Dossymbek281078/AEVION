// CyberChess — «Глубокий анализ»: Stockfish 17.1 + полный NNUE (сила уровня
// lichess). OPT-IN: игровой движок остаётся лёгким (stockfish-18-lite-single,
// мгновенный, 0 загрузки). Этот движок грузится ТОЛЬКО когда человек сам открыл
// глубокий анализ, и сети (~75 МБ) кэшируются в IndexedDB — со второго раза
// мгновенно.
//
// Выполнимость доказана end-to-end 06.09.2026 (проба в scratchpad):
// модуль sf171-79 грузится в браузере (нужен COEP require-corp — на проде есть),
// обе сети встают через setNnueBuffer, поиск идёт (bestmove e2e4, depth 14,
// ~92k nps). Здесь — обёртка того же API под интерфейс анализа CyberChess.
//
// ⚠️ Что ещё НЕ закрыто (см. NNUE-DEEP-ANALYSIS.md): (1) хостинг ~75 МБ сетей —
// дистрибутив Stockfish отдаёт 302 без CORS, нужен self-host; NET_BASE ниже
// указывает, откуда их брать. (2) Проверка загрузки ESM-модуля именно СБОРКОЙ
// Next/Turbopack (в пробе — простой статический сервер). (3) UI-кнопка и провод
// к eval-бару.

// Типы модуля (из lila-stockfish-web/stockfishWeb.d.ts).
interface StockfishWeb {
  uci(command: string): void;
  listen: (line: string) => void;
  setNnueBuffer(data: Uint8Array, index?: number): void;
  getRecommendedNnue(index?: number): string;
  onError: (msg: string) => void;
}

// Откуда брать движок и сети. Движок — из нашего /public (кладётся в сборку,
// ~0.5 МБ). Сети — из NET_BASE: ЗАМЕНИТЬ на наш self-host перед продом (сейчас
// плейсхолдер; дистрибутив Stockfish без CORS для рантайм-фетча не годится).
const ENGINE_URL = "/sf171-79.js";
const NET_BASE = process.env.NEXT_PUBLIC_NNUE_BASE || "/nnue"; // /nnue/<name> — self-host

const DB_NAME = "cyberchess-nnue";
const STORE = "nets";

type EvalCb = (cp: number, mate: number, depth: number) => void;

// ── Кэш сетей в IndexedDB (75 МБ грузятся один раз) ─────────────────────────
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key: string): Promise<Uint8Array | null> {
  try {
    const db = await idbOpen();
    return await new Promise((res) => {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      tx.onsuccess = () => res((tx.result as Uint8Array) ?? null);
      tx.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}
async function idbPut(key: string, val: Uint8Array): Promise<void> {
  try {
    const db = await idbOpen();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(val, key);
      tx.onsuccess = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* кэш необязателен — без него просто грузим каждый раз */
  }
}

/** Сеть: сперва из IndexedDB, иначе качаем и кладём в кэш. onProgress для UI (0..1). */
async function loadNet(name: string, onProgress?: (frac: number) => void): Promise<Uint8Array> {
  const cached = await idbGet(name);
  if (cached && cached.length > 0) return cached;
  const resp = await fetch(`${NET_BASE}/${name}`);
  if (!resp.ok) throw new Error(`сеть ${name} не загрузилась: HTTP ${resp.status}`);
  // потоковое чтение ради индикатора прогресса на большой (71 МБ) сети
  const total = Number(resp.headers.get("content-length")) || 0;
  if (!resp.body || !total) {
    const buf = new Uint8Array(await resp.arrayBuffer());
    await idbPut(name, buf);
    return buf;
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      got += value.length;
      onProgress?.(got / total);
    }
  }
  const out = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  await idbPut(name, out);
  return out;
}

export type DeepEngineState = "idle" | "loading-engine" | "loading-nets" | "ready" | "error";

export class DeepEngine {
  private sf: StockfishWeb | null = null;
  private cb: ((line: string) => void) | null = null;
  state: DeepEngineState = "idle";
  error: string | null = null;
  onState: ((s: DeepEngineState, netFrac?: number) => void) | null = null;

  private set(s: DeepEngineState, frac?: number) {
    this.state = s;
    this.onState?.(s, frac);
  }

  /** Грузит движок + обе сети (с кэшем). Идемпотентно: повторный вызов — no-op. */
  async init(): Promise<void> {
    if (this.sf) return;
    try {
      this.set("loading-engine");
      // ⚠️ Next 16 = Turbopack, а webpackIgnore — вебпаковская директива, её
      // Turbopack может НЕ уважать → этот import(url) под текущей сборкой не
      // проверен и может не собраться. Рекомендованный путь — worker-мост
      // (см. NNUE-DEEP-ANALYSIS.md, п.2): public/deep-engine-worker.js делает
      // import сам, главный поток берёт его как new Worker(url,{type:"module"}).
      // Здесь оставлен прямой import как доказанный в пробе; переключить на мост
      // при интеграции, проверив реальной сборкой.
      const url = ENGINE_URL;
      const mod = (await import(/* webpackIgnore: true */ /* @vite-ignore */ url)) as {
        default: (arg?: Record<string, unknown>) => Promise<StockfishWeb>;
      };
      const sf = await mod.default();
      sf.onError = (m) => {
        this.error = m;
        this.set("error");
      };
      sf.listen = (line) => this.cb?.(line);
      // ждём uciok, затем грузим рекомендованные сети
      await new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error("движок не ответил uciok за 20с")), 20000);
        this.cb = (line) => {
          if (line === "uciok") {
            clearTimeout(to);
            res();
          }
        };
        sf.uci("uci");
      });
      this.sf = sf;
      this.set("loading-nets");
      const big = sf.getRecommendedNnue(0);
      const small = sf.getRecommendedNnue(1);
      const bigBuf = await loadNet(big, (f) => this.set("loading-nets", f));
      const smallBuf = await loadNet(small);
      sf.setNnueBuffer(bigBuf, 0);
      sf.setNnueBuffer(smallBuf, 1);
      sf.uci("setoption name Threads value 1");
      sf.uci("setoption name Hash value 128");
      sf.uci("isready");
      this.set("ready");
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.set("error");
      throw e;
    }
  }

  /** Оценка позиции до глубины d. onEval — на каждый info, done — по bestmove. */
  evaluate(fen: string, d: number, onEval: EvalCb, done: (best?: string) => void): void {
    if (!this.sf) {
      done();
      return;
    }
    this.cb = (line) => {
      if (line.startsWith("info") && line.includes("score")) {
        const cpM = line.match(/score cp (-?\d+)/);
        const mM = line.match(/score mate (-?\d+)/);
        const depM = line.match(/depth (\d+)/);
        onEval(cpM ? parseInt(cpM[1]) : 0, mM ? parseInt(mM[1]) : 0, depM ? parseInt(depM[1]) : 0);
      }
      if (line.startsWith("bestmove")) done(line.split(" ")[1]);
    };
    this.sf.uci("stop");
    this.sf.uci(`position fen ${fen}`);
    this.sf.uci(`go depth ${d}`);
  }

  stop(): void {
    this.sf?.uci("stop");
  }
}
