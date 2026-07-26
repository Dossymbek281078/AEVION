#!/usr/bin/env node
// Тест судьи непрерывности QReal.
//   node scripts/qreal-continuity.test.mjs
//
// Главное, что проверяем: вердикт «непрерывно» не выдаётся там, где сравнивать
// было нечего. Ложное «consistent» хуже отсутствия проверки — оно подтверждает
// заявление, которое никто не измерял.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.join(HERE, "..");
const SVC = path.join(ROOT, "aevion-globus-backend/src/services/qreal");

// .mts-копии рядом с оригиналами: бэкенд — CommonJS-пакет, .ts в нём грузится
// как CJS и не отдаёт именованные экспорты; ESM требует явных расширений.
const pid = process.pid;
const tmpFiles = [];
function stage(name, rewrites = []) {
  const src = readFileSync(path.join(SVC, `${name}.ts`), "utf8");
  const out = rewrites.reduce((s, [from, to]) => s.replace(from, to), src);
  const file = path.join(SVC, `_${name}-test-${pid}.mts`);
  writeFileSync(file, out, "utf8");
  tmpFiles.push(file);
  return file;
}
stage("judge");
stage("characters");
const continuityFile = stage("continuity", [
  ['from "./judge"', `from "./_judge-test-${pid}.mts"`],
  ['from "./characters"', `from "./_characters-test-${pid}.mts"`],
]);
let m;
try {
  m = await import("file:///" + continuityFile.replace(/\\/g, "/"));
} finally {
  for (const f of tmpFiles) { try { unlinkSync(f); } catch { /* уже убран */ } }
}

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

/* ── 1. Критерии и якоря совпадают ──────────────────────────────────────── */

const ids = m.CONTINUITY_CRITERIA.map((c) => c.id);
ok("пять критериев непрерывности", ids.length === 5, String(ids.length));
ok("у каждого есть якорь", ids.every((id) => m.CONTINUITY_ANCHORS[id]));
ok("у каждого якоря три уровня",
  ids.every((id) => ["1", "3", "5"].every((l) => typeof m.CONTINUITY_ANCHORS[id][l] === "string")));

/* ── 2. Порог строже покадрового ────────────────────────────────────────── */

// Подмена лица рушит сцену целиком, слабая мимика лишь снижает качество —
// поэтому планка выше, чем 0.7 у покадрового QC.
ok("порог непрерывности 0.8", m.continuityThreshold() === 0.8, String(m.continuityThreshold()));

/* ── 3. Вердикты ────────────────────────────────────────────────────────── */

const all5 = m.scoreContinuity(ids.map((id) => ({ id, score: 5 })));
ok("всё совпадает → consistent", all5.verdict === "consistent", all5.verdict);
ok("тотал 1.0", all5.totalScore === 1);

const all1 = m.scoreContinuity(ids.map((id) => ({ id, score: 1 })));
ok("всё разъехалось → drifting", all1.verdict === "drifting", all1.verdict);

// 4 из 5 — придирчиво, но ниже 0.8: сцена с поехавшим лицом не должна
// проскакивать как «непрерывная».
const all4 = m.scoreContinuity(ids.map((id) => ({ id, score: 4 })));
ok("оценки «4» не дотягивают до порога", all4.verdict === "drifting", `${all4.totalScore} → ${all4.verdict}`);

// Лицо провалено, остальное идеально — вес лица должен утянуть вердикт.
const faceBroken = m.scoreContinuity([
  { id: "face-identity", score: 1 }, { id: "wardrobe", score: 5 }, { id: "markings", score: 5 },
  { id: "proportions", score: 5 }, { id: "scene-light", score: 5 },
]);
ok("подмена лица роняет вердикт", faceBroken.verdict === "drifting", `${faceBroken.totalScore}`);
ok("виновник назван первым", faceBroken.weakest[0]?.id === "face-identity");

/* ── 4. Нечего сравнивать — не выдаём бодрый вердикт ────────────────────── */

const thin = m.scoreContinuity([{ id: "face-identity", score: 5 }]);
ok("мало оценок → insufficient, а не consistent", thin.verdict === "insufficient", thin.verdict);

const oneShotCast = [{ id: "ch-1", kind: "child", name: "boy", canonical: "boy", refImages: [], shotIds: ["s1"] }];
ok("герой в одном кадре — измерять нечего", m.isMeasurable(oneShotCast) === false);
const twoShotCast = [{ id: "ch-1", kind: "child", name: "boy", canonical: "boy", refImages: [], shotIds: ["s1", "s2"] }];
ok("герой в двух кадрах — измеримо", m.isMeasurable(twoShotCast) === true);
ok("пустой каст — измерять нечего", m.isMeasurable([]) === false);

/* ── 5. Промт судьи ─────────────────────────────────────────────────────── */

const p = m.buildContinuityPrompt(twoShotCast, [{ order: 1, title: "Степь" }, { order: 2, title: "Мальчик и собака" }]);
ok("в промте перечислены кадры", p.user.includes("Мальчик и собака"));
ok("в промте назван каст", p.user.includes("boy"));
ok("в промте есть якоря", /1 = .+\n\s+3 = .+\n\s+5 = /.test(p.user));
ok("судью просят СРАВНИВАТЬ, а не оценивать красоту", /СРАВНИТЬ/.test(p.system));
ok("одиночное появление → null, а не 5", /только в одном кадре/.test(p.system) && /НЕ ставь 5/.test(p.system));

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
