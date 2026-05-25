#!/usr/bin/env node
/**
 * fix-seed-codes-v2 — миграция учебных псевдо-шифров демонтажных норм.
 *
 * В seed v0.5.0 21 расценка имела префикс «ДЕМ-XX-YY-ZZZ», которого в
 * ЭСН РК 8.04-01-2024 не существует — демонтажные работы там нормируются
 * через основные сборники с понижающими коэффициентами (п.1.18 общих
 * положений). Студент привыкал к несуществующим шифрам.
 *
 * Что делаем:
 *  - Переименовываем «ДЕМ-XX-YY-ZZZ» → «ЭСНСбBB-YY.Д-ZZZ», где BB —
 *    номер реального родительского сборника ЭСН РК по таблице SB_MAP.
 *    Суффикс «.Д» прозрачно маркирует учебный демонтажный дериватив,
 *    чтобы не выдавать псевдо-шифр за «настоящую» норму конкретной
 *    таблицы (нумерация таблиц ЭСН РК не выдумывается).
 *  - В technicalNotes добавляем методическую справку с диапазоном
 *    коэффициента демонтажа и ссылкой на п.1.18 общих положений.
 *  - Параллельно правим 8 файлов исходников (.ts/.tsx), где эти коды
 *    зашиты в уроки/экзамены/практику/demoFill.
 *
 * Запуск: node scripts/fix-seed-codes-v2.mjs (из frontend/)
 * Идемпотентен — повторный запуск ничего не меняет.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED_PATH = path.join(ROOT, "src/app/smeta-trainer/data/seed.json");

// «ДЕМ-XX» (первая группа в псевдо-шифре) → реальный сборник ЭСН РК
const SB_MAP = {
  "11": "11", // общестроительные внутренние работы (полы, стяжки)
  "12": "12", // кровли
  "15": "15", // отделочные (штукатурка, плитка, потолки)
  "16": "18", // отопление (радиаторы) — реальный сборник Сб.18
  "17": "17", // водопровод и канализация (унитаз, умывальник, ванна)
  "21": "21", // электромонтажные
  "06": "10", // деревянные конструкции (окна, двери)
  "08": "08", // бетонные/каменные перегородки
  "05": "06", // бетонные конструкции (фундамент)
};

// Диапазон коэффициента демонтажа по характеру работ (п.1.18 ЭСН РК)
const DEM_COEF_BY_SB = {
  "11": "0.6–0.8", // полы, стяжки
  "12": "0.5–0.6", // кровли
  "15": "0.5–0.7", // отделка
  "18": "0.4–0.5", // отопление
  "17": "0.4–0.5", // сантехника
  "21": "0.3–0.5", // электромонтаж
  "10": "0.4–0.5", // деревянные
  "08": "0.5–0.6", // каменные/бетонные перегородки
  "06": "0.5",     // бетонные конструкции
};

const NOTE_TAG = "Учебный шифр демонтажа.";

function newCode(oldCode) {
  const m = /^ДЕМ-(\d+)-(\d+)-(\d+)$/.exec(oldCode);
  if (!m) return null;
  const [, src, mid, num] = m;
  const sb = SB_MAP[src];
  if (!sb) {
    console.error(`!! нет маппинга для сборника ${src} (${oldCode})`);
    return null;
  }
  return `ЭСНСб${sb}-${mid}.Д-${num}`;
}

function notesFor(sb) {
  const coef = DEM_COEF_BY_SB[sb] ?? "0.4–0.7";
  return (
    `${NOTE_TAG} В реальной смете применяется одна из норм Сб.${sb} ЭСН РК ` +
    `с понижающим коэффициентом k=${coef} согласно п.1.18 общих положений ` +
    `ЭСН РК 8.04-01-2024 (демонтаж = укладка/монтаж × k).`
  );
}

// --- (1) seed.json ---
const data = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
const codeRename = new Map(); // oldCode -> newCode
let renamed = 0;
let notesAdded = 0;
let notesUpdated = 0;

for (const rate of data.rates ?? []) {
  if (!/^ДЕМ-/.test(rate.code)) continue;
  const nc = newCode(rate.code);
  if (!nc) continue;
  codeRename.set(rate.code, nc);
  rate.code = nc;
  renamed++;

  const sb = nc.match(/^ЭСНСб(\d+)-/)?.[1];
  const note = notesFor(sb);
  if (!rate.technicalNotes) {
    rate.technicalNotes = note;
    notesAdded++;
  } else if (!rate.technicalNotes.includes(NOTE_TAG)) {
    rate.technicalNotes = `${rate.technicalNotes} ${note}`;
    notesUpdated++;
  }
}

data._meta = data._meta ?? {};
data._meta.version = "0.6.0";
data._meta.lastReview = new Date().toISOString().slice(0, 10);
data._meta.changelog = data._meta.changelog ?? [];
if (!data._meta.changelog.some((c) => c.version === "0.6.0")) {
  data._meta.changelog.unshift({
    version: "0.6.0",
    date: data._meta.lastReview,
    notes:
      "Псевдо-шифры демонтажных норм ДЕМ-XX-YY-ZZZ переименованы в формат " +
      "ЭСНСбBB-YY.Д-ZZZ, где BB — реальный родительский сборник ЭСН РК. " +
      "Суффикс «.Д» прозрачно маркирует учебный демонтажный дериватив. " +
      "В technicalNotes — методическая ссылка на п.1.18 общих положений и " +
      "диапазон коэффициента демонтажа. Параллельно обновлены ссылки в " +
      "examTasks/practiceExercises/demoFill/Level3-4View/DefectActView/levels.",
  });
}

fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");

// --- (2) файлы исходников ---
const FILES = [
  "src/app/smeta-trainer/lib/examTasks.ts",
  "src/app/smeta-trainer/lib/levels.ts",
  "src/app/smeta-trainer/lib/practiceExercises.ts",
  "src/app/smeta-trainer/lib/demoFill.ts",
  "src/app/smeta-trainer/components/Level3View.tsx",
  "src/app/smeta-trainer/components/Level4View.tsx",
  "src/app/smeta-trainer/components/DefectActView.tsx",
];

let srcReplacements = 0;
const perFile = {};
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`!! файл не найден: ${rel}`);
    continue;
  }
  let txt = fs.readFileSync(abs, "utf8");
  let n = 0;
  for (const [oldC, newC] of codeRename) {
    const re = new RegExp(oldC.replace(/[-]/g, "\\-"), "g");
    txt = txt.replace(re, () => {
      n++;
      return newC;
    });
  }
  if (n > 0) {
    fs.writeFileSync(abs, txt, "utf8");
    perFile[rel] = n;
    srcReplacements += n;
  }
}

console.log("=== Маппинг (выборка) ===");
let shown = 0;
for (const [oldC, newC] of codeRename) {
  if (shown++ < 7) console.log(`  ${oldC}  →  ${newC}`);
}
if (codeRename.size > 7) console.log(`  … и ещё ${codeRename.size - 7}`);

console.log(`\n=== Summary ===`);
console.log(`seed.rates renamed:        ${renamed}`);
console.log(`technicalNotes добавлены:  ${notesAdded}`);
console.log(`technicalNotes дополнены:  ${notesUpdated}`);
console.log(`Исходники — замен:         ${srcReplacements}`);
for (const [f, n] of Object.entries(perFile)) console.log(`  ${n.toString().padStart(3)}  ${f}`);
