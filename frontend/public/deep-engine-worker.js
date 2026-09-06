// CyberChess «Глубокий анализ» — worker-мост к Stockfish 17.1 (lila-stockfish-web).
//
// Зачем мост, а не import() в главном потоке: проект на Next 16 = Turbopack,
// который может не уважать webpackIgnore и попытаться разрешить import(url) на
// сборке. Здесь модуль импортируется ВНУТРИ воркера (файл отдаётся статикой из
// /public, бандлер его не трогает), а главный поток берёт мост как
// `new Worker("/deep-engine-worker.js", { type: "module" })` — как уже грузится
// игровой движок. Заодно тяжёлый движок уходит с main-потока.
//
// Протокол (postMessage):
//   → { type:"init" }                     ← { type:"ready" } | { type:"error", error }
//   → { type:"recommend", index }         ← { type:"recommend", index, name }
//   → { type:"nnue", index, buf }         (buf: Uint8Array, передаётся transfer)
//   → { type:"uci", cmd }                 ← { type:"line", line } на каждую строку движка

let sf = null;

self.onmessage = async (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === "init") {
      const mod = await import("/sf171-79.js");
      sf = await mod.default();
      sf.listen = (line) => self.postMessage({ type: "line", line });
      sf.onError = (m) => self.postMessage({ type: "error", error: String(m) });
      self.postMessage({ type: "ready" });
    } else if (msg.type === "recommend") {
      self.postMessage({ type: "recommend", index: msg.index, name: sf.getRecommendedNnue(msg.index) });
    } else if (msg.type === "nnue") {
      sf.setNnueBuffer(msg.buf, msg.index);
    } else if (msg.type === "uci") {
      sf.uci(msg.cmd);
    }
  } catch (err) {
    self.postMessage({ type: "error", error: String(err && err.message ? err.message : err) });
  }
};
