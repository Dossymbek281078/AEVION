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

// Загрузка движка — через worker-мост public/deep-engine-worker.js (см. его
// шапку и NNUE-DEEP-ANALYSIS.md): под Turbopack прямой import(url) ненадёжен,
// а воркер с type:"module" отдаётся статикой и импортирует движок сам.
const WORKER_URL = "/deep-engine-worker.js";
// Сети — из NET_BASE: ЗАМЕНИТЬ на наш self-host перед продом (дистрибутив
// Stockfish без CORS для рантайм-фетча не годится). /nnue/<name>.
const NET_BASE = process.env.NEXT_PUBLIC_NNUE_BASE || "/nnue";

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
  private w: Worker | null = null;
  private ready = false;
  private cb: ((line: string) => void) | null = null;
  private recResolve: ((name: string) => void) | null = null;
  state: DeepEngineState = "idle";
  error: string | null = null;
  onState: ((s: DeepEngineState, netFrac?: number) => void) | null = null;

  private set(s: DeepEngineState, frac?: number) {
    this.state = s;
    this.onState?.(s, frac);
  }

  private uci(cmd: string) {
    this.w?.postMessage({ type: "uci", cmd });
  }

  private recommend(index: number): Promise<string> {
    return new Promise((res) => {
      this.recResolve = res;
      this.w?.postMessage({ type: "recommend", index });
    });
  }

  /** Грузит движок + обе сети (с кэшем). Идемпотентно: повторный вызов — no-op. */
  async init(): Promise<void> {
    if (this.w) return;
    try {
      this.set("loading-engine");
      const w = new Worker(WORKER_URL, { type: "module" });
      this.w = w;
      w.onmessage = (e: MessageEvent) => {
        const m = e.data || {};
        if (m.type === "line") this.cb?.(m.line);
        else if (m.type === "error") {
          this.error = m.error;
          this.set("error");
        } else if (m.type === "recommend") this.recResolve?.(m.name);
      };
      // ждём готовности моста, затем uciok
      await new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error("мост движка не поднялся за 20с")), 20000);
        const onMsg = (e: MessageEvent) => {
          if (e.data?.type === "ready") {
            clearTimeout(to);
            w.removeEventListener("message", onMsg);
            res();
          } else if (e.data?.type === "error") {
            clearTimeout(to);
            rej(new Error(e.data.error));
          }
        };
        w.addEventListener("message", onMsg);
        w.postMessage({ type: "init" });
      });
      await new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error("движок не ответил uciok за 20с")), 20000);
        this.cb = (line) => {
          if (line === "uciok") {
            clearTimeout(to);
            res();
          }
        };
        this.uci("uci");
      });
      this.set("loading-nets");
      const big = await this.recommend(0);
      const small = await this.recommend(1);
      const bigBuf = await loadNet(big, (f) => this.set("loading-nets", f));
      const smallBuf = await loadNet(small);
      // buf передаётся transfer'ом (без копии): дальше в этом потоке он не нужен
      w.postMessage({ type: "nnue", index: 0, buf: bigBuf }, [bigBuf.buffer]);
      w.postMessage({ type: "nnue", index: 1, buf: smallBuf }, [smallBuf.buffer]);
      this.uci("setoption name Threads value 1");
      this.uci("setoption name Hash value 128");
      this.uci("isready");
      this.ready = true;
      this.set("ready");
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.set("error");
      throw e;
    }
  }

  /** Оценка позиции до глубины d. onEval — на каждый info, done — по bestmove. */
  evaluate(fen: string, d: number, onEval: EvalCb, done: (best?: string) => void): void {
    if (!this.ready) {
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
    this.uci("stop");
    this.uci(`position fen ${fen}`);
    this.uci(`go depth ${d}`);
  }

  stop(): void {
    this.uci("stop");
  }
}
