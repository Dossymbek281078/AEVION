#!/usr/bin/env node
// Синхронизирует scripts/qreal-benchmark.rubric.json с REALISM_ANCHORS из
// aevion-globus-backend/src/services/qreal/judge.ts.
//
// Якоря — продуктовый IP: по ним судит VLM-судья в /qc и по ним же судят люди
// в слепом бенчмарке. Две расходящиеся копии означают, что машинный и
// человеческий скор несопоставимы, а бенчмарк меряет не то, что продукт.
// Поэтому json не правится руками — он генерируется из кода.
//
//   node scripts/qreal-sync-rubric.mjs           # синхронизировать
//   node scripts/qreal-sync-rubric.mjs --check   # только проверить (exit 1 при расхождении)

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.join(HERE, "..");
const JUDGE = path.join(ROOT, "aevion-globus-backend/src/services/qreal/judge.ts");
const RUBRIC = path.join(HERE, "qreal-benchmark.rubric.json");
const checkOnly = process.argv.includes("--check");

// Бэкенд — CommonJS-пакет, поэтому .ts в нём грузится как CJS. Копия с
// расширением .mts всегда ESM, и Node 24 срезает типы штатно, без сборки.
const tmp = path.join(tmpdir(), `qreal-judge-sync-${process.pid}.mts`);
writeFileSync(tmp, readFileSync(JUDGE, "utf8"), "utf8");
let anchors;
try {
  ({ REALISM_ANCHORS: anchors } = await import("file:///" + tmp.replace(/\\/g, "/")));
} finally {
  try { unlinkSync(tmp); } catch { /* уже убран */ }
}

const rubric = JSON.parse(readFileSync(RUBRIC, "utf8"));
const drift = Object.keys(anchors).filter((id) => JSON.stringify(anchors[id]) !== JSON.stringify(rubric.anchors?.[id]));
const orphan = Object.keys(rubric.anchors || {}).filter((id) => !anchors[id]);

if (!drift.length && !orphan.length) {
  console.log(`Якоря совпадают с кодом (${Object.keys(anchors).length} критериев).`);
  process.exitCode = 0;
} else if (checkOnly) {
  console.error(`Расхождение с judge.ts:`);
  if (drift.length) console.error(`  тексты разошлись: ${drift.join(", ")}`);
  if (orphan.length) console.error(`  якоря-сироты в json: ${orphan.join(", ")}`);
  console.error(`Почини: node scripts/qreal-sync-rubric.mjs`);
  process.exitCode = 1;
} else {
  rubric.anchors = anchors;
  rubric.note =
    "СГЕНЕРИРОВАН из REALISM_ANCHORS в aevion-globus-backend/src/services/qreal/judge.ts. " +
    "Руками не править — править код и прогнать scripts/qreal-sync-rubric.mjs. " +
    "Раннер бенчмарка сверяет тексты с /api/qreal/realism-criteria и падает при расхождении.";
  writeFileSync(RUBRIC, JSON.stringify(rubric, null, 2) + "\n", "utf8");
  console.log(`Синхронизировано: ${drift.length} расхождений, ${orphan.length} сирот убрано.`);
}
