#!/usr/bin/env node
/**
 * fix-seed-codes-v3 — финальная миграция учебных псевдо-шифров.
 *
 * В seed v0.6.0 осталось 288 расценок с 21 псевдо-префиксом
 * (ОТД-, ФАС-, ОВК-, СНТ-, МНТ- и др.), которых нет в ЭСН РК.
 * Меняем префикс на «ЭСНСбBB-» по таблице соответствия родительских
 * сборников ЭСН РК 8.04-01-2024 (без «.Д» — это монтажные нормы).
 *
 * Сохраняем весь остаток шифра без изменений, чтобы:
 *  (а) не нарушить уникальность;
 *  (б) сохранить понятную ссылку из уроков/экзаменов/практики.
 *
 * Запуск: node scripts/fix-seed-codes-v3.mjs (из frontend/)
 * Идемпотентен.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED_PATH = path.join(ROOT, "src/app/smeta-trainer/data/seed.json");

// Префикс псевдо-шифра → реальный сборник ЭСН РК 8.04-01-2024
const PREFIX_MAP = {
  ОТД: { sb: "15" }, // отделочные работы
  ФАС: { sb: "15" }, // фасадные = отделочные
  ОВК: { sb: "20" }, // отопление, вентиляция, кондиционирование
  СНТ: { sb: "17" }, // водопровод и канализация
  МНТ: { sb: "07" }, // монтаж технологического оборудования
  ЗЕМ: { sb: "01" }, // земляные работы
  ЭЛ:  { sb: "21" }, // электромонтажные работы
  ФУН: { sb: "06" }, // бетонные и ж/б конструкции (фундаменты)
  КРВ: { sb: "12" }, // кровли
  МЕТ: { sb: "09" }, // металлические конструкции
  ИЗО: { sb: "26" }, // тепловая изоляция
  ДОР: { sb: "27" }, // автомобильные дороги
  РСМ: { sb: "46" }, // ремонтно-строительные работы
  БЛАГ:{ sb: "47" }, // благоустройство
  КЛК: { sb: "08" }, // каменные/кладочные работы
  ОПС: { sb: "21", soft: true }, // слаботочные системы → секция Сб.21
  СКУД:{ sb: "21", soft: true },
  СВЗ: { sb: "21", soft: true },
  СКС: { sb: "21", soft: true },
  ВН:  { sb: "18" }, // внутренние сети отопления
  ОБС: { sb: "46" }, // обследование/реконструкция
};

const NOTE_TAG = "Учебный псевдо-шифр приведён к реальному сборнику ЭСН РК.";
const SOFT_TAG = "Слаботочные системы (ОПС/СКУД/СВЗ/СКС)";

const SOFT_NOTE_BY_PREFIX = {
  ОПС: "охранно-пожарная сигнализация",
  СКУД: "система контроля и управления доступом",
  СВЗ: "система связи и оповещения",
  СКС: "структурированная кабельная система",
};

function softNote(prefix) {
  const human = SOFT_NOTE_BY_PREFIX[prefix];
  return (
    `${NOTE_TAG} ${SOFT_TAG}: ${human}. В действующем ЭСН РК 8.04-01-2024 ` +
    `не выделены отдельным сборником — нормируются по Сб.21 как раздел ` +
    `«Электромонтажные и слаботочные работы».`
  );
}

function regularNote(sb) {
  return (
    `${NOTE_TAG} Применяется по нормам Сб.${sb} ЭСН РК 8.04-01-2024 ` +
    `(монтажные работы).`
  );
}

// --- (1) seed.json ---
const data = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
const codeRename = new Map();
const byPrefix = {};
let renamed = 0;
let notesAdded = 0;
let notesUpdated = 0;

for (const rate of data.rates ?? []) {
  const m = /^([А-Я]+)-/.exec(rate.code);
  if (!m) continue;
  const prefix = m[1];
  if (prefix === "ЭСН") continue;
  const def = PREFIX_MAP[prefix];
  if (!def) continue;

  const tail = rate.code.slice(prefix.length + 1);
  const nc = `ЭСНСб${def.sb}-${tail}`;
  codeRename.set(rate.code, nc);
  rate.code = nc;
  renamed++;
  byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;

  const note = def.soft ? softNote(prefix) : regularNote(def.sb);
  if (!rate.technicalNotes) {
    rate.technicalNotes = note;
    notesAdded++;
  } else if (!rate.technicalNotes.includes(NOTE_TAG)) {
    rate.technicalNotes = `${rate.technicalNotes} ${note}`;
    notesUpdated++;
  }
}

data._meta = data._meta ?? {};
data._meta.version = "0.7.0";
data._meta.lastReview = new Date().toISOString().slice(0, 10);
data._meta.changelog = data._meta.changelog ?? [];
if (!data._meta.changelog.some((c) => c.version === "0.7.0")) {
  data._meta.changelog.unshift({
    version: "0.7.0",
    date: data._meta.lastReview,
    notes:
      "Финальная миграция учебных псевдо-шифров: 288 расценок с 21 префиксом " +
      "(ОТД-/ФАС-/ОВК-/СНТ-/МНТ-/ЗЕМ-/ЭЛ-/ФУН-/КРВ-/МЕТ-/ИЗО-/ДОР-/РСМ-/" +
      "БЛАГ-/КЛК-/ОПС-/СКУД-/СВЗ-/СКС-/ВН-/ОБС-) переименованы в формат " +
      "ЭСНСбBB-... по таблице соответствия родительских сборников ЭСН РК. " +
      "Для слаботочных систем (ОПС/СКУД/СВЗ/СКС) добавлена пометка о " +
      "принадлежности к разделу Сб.21. Итог: 0 псевдо-шифров в корпусе.",
  });
}

fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");

// --- (2) исходники ---
const FILES = [
  "src/app/smeta-trainer/import-check/page.tsx",
  "src/app/smeta-trainer/lib/lessons.ts",
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
  if (!fs.existsSync(abs)) continue;
  let txt = fs.readFileSync(abs, "utf8");
  let n = 0;
  for (const [oldC, newC] of codeRename) {
    const escaped = oldC.replace(/[-]/g, "\\-");
    const re = new RegExp(escaped, "g");
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

console.log("=== Маппинг (выборка по префиксам) ===");
let i = 0;
for (const [oldC, newC] of codeRename) {
  if (i++ < 10) console.log(`  ${oldC.padEnd(22)} →  ${newC}`);
}
if (codeRename.size > 10) console.log(`  … ещё ${codeRename.size - 10}`);

console.log(`\n=== Summary ===`);
console.log(`seed.rates renamed:        ${renamed}`);
console.log(`technicalNotes добавлены:  ${notesAdded}`);
console.log(`technicalNotes дополнены:  ${notesUpdated}`);
console.log(`Исходники — замен:         ${srcReplacements}`);
for (const [f, n] of Object.entries(perFile)) console.log(`  ${n.toString().padStart(3)}  ${f}`);
console.log(`\nПо префиксам:`);
for (const [p, n] of Object.entries(byPrefix).sort((a, b) => b[1] - a[1])) {
  const sb = PREFIX_MAP[p].sb;
  const soft = PREFIX_MAP[p].soft ? " [слаботочка]" : "";
  console.log(`  ${p.padEnd(6)} ×${n.toString().padStart(3)} → Сб.${sb}${soft}`);
}
