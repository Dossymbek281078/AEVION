// Prebuild: докачивает NNUE-сети «Глубокого анализа» в public/nnue, чтобы Vercel
// раздавал их своим CDN (NET_BASE=/nnue). Сети большие (~75 МБ) и в git не
// лежат (gitignore) — кладутся сюда на сборке. Идемпотентно: если файл уже есть
// и нужного размера, не качает (использует build-cache Vercel, если он кэширует
// public). Портируемо (node fetch) — работает и в Linux-сборке Vercel.
//
// НЕ роняет сборку сайта, если сеть не скачалась: «Глубокий анализ» — opt-in,
// его отсутствие не должно валить весь фронт. При неудаче печатает
// предупреждение; кнопка глубокого анализа тогда покажет ошибку загрузки сети,
// а игра/остальной сайт работают. Отключить докачку: NNUE_SKIP_FETCH=1.
import fs from "node:fs";
import path from "node:path";

const DEST = path.join(process.cwd(), "public", "nnue");
const BASE = process.env.NNUE_FETCH_BASE || "https://tests.stockfishchess.org/api/nn";
const NETS = [
  { name: "nn-1c0000000000.nnue", size: 74874478 }, // большая, ~71 МБ
  { name: "nn-37f18f62d772.nnue", size: 3519630 },  // малая, ~3.4 МБ
];

async function main() {
  if (process.env.NNUE_SKIP_FETCH === "1") {
    console.log("[nnue] пропуск докачки (NNUE_SKIP_FETCH=1)");
    return;
  }
  fs.mkdirSync(DEST, { recursive: true });
  for (const { name, size } of NETS) {
    const out = path.join(DEST, name);
    try {
      if (fs.existsSync(out) && fs.statSync(out).size === size) {
        console.log(`[nnue] уже на месте: ${name}`);
        continue;
      }
      console.log(`[nnue] качаю ${name} …`);
      const resp = await fetch(`${BASE}/${name}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length !== size) throw new Error(`размер ${buf.length}, ожидался ${size}`);
      fs.writeFileSync(out, buf);
      console.log(`[nnue] ок: ${name} (${buf.length} б)`);
    } catch (e) {
      // Не валим сборку: opt-in фича, её сеть не критична для остального сайта.
      console.warn(`[nnue] ⚠️ не удалось ${name}: ${e instanceof Error ? e.message : e}. `
        + `«Глубокий анализ» покажет ошибку загрузки; остальной сайт не затронут.`);
    }
  }
}

main();
