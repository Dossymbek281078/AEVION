#!/usr/bin/env node
// Тест судьи реализма QReal. Без фреймворка — как остальные .mjs в scripts/.
//   node scripts/qreal-judge.test.mjs
//
// Проверяет то, что ломается молча: покрытие якорями, конвертацию шкалы,
// исключение неприменимых критериев из ОБОИХ концов дроби, и то, что вердикт
// «перегенерировать» (= деньги) не выдаётся на недостаточных данных.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.join(HERE, "..");

// Исходники читаем текстом только для проверки покрытия id (блок 1);
// сами функции исполняются как настоящий модуль ниже, в блоке 2.
const judgeSrc = readFileSync(path.join(ROOT, "aevion-globus-backend/src/services/qreal/judge.ts"), "utf8");
const routeSrc = readFileSync(path.join(ROOT, "aevion-globus-backend/src/routes/qreal.ts"), "utf8");

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

/* ── 1. Якоря покрывают ровно набор критериев ───────────────────────────── */

const critIds = [...routeSrc.matchAll(/\{\s*id:\s*"([a-z-]+)",\s*label:/g)].map((m) => m[1]);
const anchorBlock = judgeSrc.slice(judgeSrc.indexOf("REALISM_ANCHORS"), judgeSrc.indexOf("export type CriterionDef"));
const anchorIds = [...anchorBlock.matchAll(/^\s{2}"?([a-z-]+)"?:\s*\{/gm)].map((m) => m[1]);

ok(`критериев найдено: ${critIds.length}`, critIds.length === 14, `ожидал 14, нашёл ${critIds.length}`);
const missing = critIds.filter((id) => !anchorIds.includes(id));
const orphan = anchorIds.filter((id) => !critIds.includes(id));
ok("у каждого критерия есть якорь", missing.length === 0, `без якорей: ${missing.join(", ")}`);
ok("нет якорей-сирот", orphan.length === 0, `лишние: ${orphan.join(", ")}`);

// У каждого якоря должны быть все три уровня — иначе судья домысливает.
const levels = [...anchorBlock.matchAll(/"([135])":\s*"/g)].map((m) => m[1]);
ok("у каждого якоря есть уровни 1/3/5", levels.length === anchorIds.length * 3, `ожидал ${anchorIds.length * 3} уровней, нашёл ${levels.length}`);

/* ── 2. Математика скоринга ─────────────────────────────────────────────── */
// Исполняем НАСТОЯЩИЙ judge.ts, а не копию формул в тесте — иначе тест
// проверял бы сам себя. Node 24 срезает типы штатно, сборка не нужна.
// Копия с расширением .mts: бэкенд — CommonJS-пакет, и .ts в нём грузится как
// CJS («Unexpected token 'export'»). .mts всегда ESM, срезание типов работает.
const tmp = path.join(tmpdir(), `qreal-judge-${process.pid}.mts`);
writeFileSync(tmp, judgeSrc, "utf8");
const mod = await import("file:///" + tmp.replace(/\\/g, "/"));
process.on("exit", () => { try { unlinkSync(tmp); } catch { /* уже убран */ } });

const defs = [
  { id: "a", label: "A", weight: 2 },
  { id: "b", label: "B", weight: 1 },
  { id: "c", label: "C", weight: 1 },
  { id: "d", label: "D", weight: 1 },
];

// 5 → 1.0, 1 → 0.0, 3 → 0.5
const all5 = mod.scoreCriteria(defs, defs.map((d) => ({ id: d.id, score: 5 })));
ok("оценка 5 по всем → тотал 1.0", all5.verdict.totalScore === 1);
const all1 = mod.scoreCriteria(defs, defs.map((d) => ({ id: d.id, score: 1 })));
ok("оценка 1 по всем → тотал 0.0", all1.verdict.totalScore === 0);
const all3 = mod.scoreCriteria(defs, defs.map((d) => ({ id: d.id, score: 3 })));
ok("оценка 3 по всем → тотал 0.5", all3.verdict.totalScore === 0.5);

// Вес реально влияет: тяжёлый критерий провален, лёгкие идеальны.
const weighted = mod.scoreCriteria(defs, [
  { id: "a", score: 1 }, { id: "b", score: 5 }, { id: "c", score: 5 }, { id: "d", score: 5 },
]);
ok("тяжёлый критерий тянет тотал вниз", Math.abs(weighted.verdict.totalScore - 3 / 5) < 1e-9, `получил ${weighted.verdict.totalScore}`);

// Ключевое: null выпадает из ЧИСЛИТЕЛЯ И ЗНАМЕНАТЕЛЯ. Если бы null считался
// нулём, тотал упал бы до 0.5 — и кадр без речи наказывался бы за липсинк.
const withNa = mod.scoreCriteria(defs, [
  { id: "a", score: 5 }, { id: "b", score: 5 }, { id: "c", score: null }, { id: "d", score: null },
]);
ok("неприменимые критерии не штрафуют кадр", withNa.verdict.totalScore === 1, `получил ${withNa.verdict.totalScore}`);
ok("неприменимые посчитаны как пропущенные", withNa.verdict.skippedCriteria === 2);

// Оценка вне 1..5 — не данные, а мусор; должна отбрасываться, а не искажать тотал.
const garbage = mod.scoreCriteria(defs, [
  { id: "a", score: 5 }, { id: "b", score: 9 }, { id: "c", score: 0 }, { id: "d", score: 5 },
]);
ok("оценки вне 1..5 отброшены", garbage.verdict.judgedCriteria === 2, `судимых: ${garbage.verdict.judgedCriteria}`);

/* ── 3. Вердикт и защита бюджета ────────────────────────────────────────── */

ok("высокий тотал → pass", all5.verdict.verdict === "pass");
ok("низкий тотал → regenerate", all1.verdict.verdict === "regenerate");

// Судимо меньше половины критериев — вердикта быть не должно: «regenerate»
// здесь означал бы трату денег на основании шума.
const thin = mod.scoreCriteria(defs, [{ id: "a", score: 1 }]);
ok("мало данных → insufficient, а не regenerate", thin.verdict.verdict === "insufficient", `получил ${thin.verdict.verdict}`);

// Слабые места должны называться — иначе «перегенерируй» без объяснения.
ok("названы слабейшие критерии", weighted.verdict.weakest[0]?.id === "a");

/* ── 4. Политика авто-перегенерации ─────────────────────────────────────── */

delete process.env.QREAL_QC_AUTOREGEN;
ok("по умолчанию авто-перегенерация ВЫКЛЮЧЕНА", mod.autoRegenPolicy(0).auto === false);
process.env.QREAL_QC_AUTOREGEN = "1";
ok("включается явным флагом", mod.autoRegenPolicy(0).auto === true);
ok("лимит попыток соблюдается", mod.autoRegenPolicy(1).auto === false, "вторая попытка при лимите 1 должна уйти человеку");
delete process.env.QREAL_QC_AUTOREGEN;

/* ── 5. Промт судьи несёт якоря ─────────────────────────────────────────── */

const prompt = mod.buildJudgePrompt(
  [{ id: "lipsync", label: "Липсинк", weight: 1.3 }],
  { description: "Женщина говорит у окна", dialogue: "Он не позвонил", soundscape: "room tone" }
);
ok("в промт попали якоря 1/3/5", /1 = .+\n\s+3 = .+\n\s+5 = /.test(prompt.user));
ok("в промт попала реплика", prompt.user.includes("Он не позвонил"));
ok("судье велено ставить null, а не среднее", /null/.test(prompt.system) && /НЕ ставь средн/.test(prompt.system));

/* ── 6. Разбор ответа VLM-судьи ─────────────────────────────────────────── */

const vlmSrc = readFileSync(path.join(ROOT, "aevion-globus-backend/src/services/qreal/vlmJudge.ts"), "utf8");
// vlmJudge.ts импортирует judge.ts относительным путём — кладём копию рядом
// с оригиналом, чтобы импорт разрешился, и меняем только расширение.
const qrealDir = path.join(ROOT, "aevion-globus-backend/src/services/qreal");
const vlmTmp = path.join(qrealDir, `_vlm-test-${process.pid}.mts`);
// Зависимости тоже кладём как .mts: .ts внутри CommonJS-пакета грузится как CJS
// и не отдаёт именованные экспорты. ESM вдобавок требует явных расширений.
const judgeTmp = path.join(qrealDir, `_judge-test-${process.pid}.mts`);
const falTmp = path.join(ROOT, "aevion-globus-backend/src/lib", `_fal-test-${process.pid}.mts`);
writeFileSync(judgeTmp, judgeSrc, "utf8");
writeFileSync(falTmp, readFileSync(path.join(ROOT, "aevion-globus-backend/src/lib/falClient.ts"), "utf8"), "utf8");
writeFileSync(
  vlmTmp,
  vlmSrc
    .replace('from "./judge"', `from "./_judge-test-${process.pid}.mts"`)
    .replace('from "../../lib/falClient"', `from "../../lib/_fal-test-${process.pid}.mts"`),
  "utf8"
);
let vlm;
try {
  vlm = await import("file:///" + vlmTmp.replace(/\\/g, "/"));
} finally {
  for (const f of [vlmTmp, judgeTmp, falTmp]) { try { unlinkSync(f); } catch { /* уже убран */ } }
}

const vdefs = [{ id: "lipsync", label: "Липсинк", weight: 1.3 }, { id: "room-tone", label: "Room tone", weight: 1 }];

// Модель отвечает текстом, а не структурой: JSON почти всегда обёрнут в прозу.
const wrapped = vlm.parseJudgeReply(
  'Посмотрел клип. Вот оценки:\n```json\n{"scores":[{"id":"lipsync","score":4,"note":"почти точно"},{"id":"room-tone","score":null,"note":"тишина цифровая"}]}\n```\nГотов пояснить.',
  vdefs
);
ok("JSON достаётся из прозы и code-fence", wrapped.scores.length === 2, `разобрано ${wrapped.scores.length}`);
ok("null сохраняется как неприменимость", wrapped.scores[1].score === null);
ok("заметка судьи не теряется", wrapped.scores[0].note === "почти точно");

// Судья может выдумать критерий — вливать его в тотал нельзя.
const invented = vlm.parseJudgeReply('{"scores":[{"id":"vibe","score":5},{"id":"lipsync","score":3}]}', vdefs);
ok("выдуманный критерий отброшен", invented.scores.length === 1 && invented.scores[0].id === "lipsync");
ok("отброшенное названо явно", invented.dropped.includes("vibe"));

// Оценка вне шкалы от модели = не данные; пусть станет null, а не 9 баллов.
const outOfRange = vlm.parseJudgeReply('{"scores":[{"id":"lipsync","score":9}]}', vdefs);
ok("оценка вне 1..5 от модели → null", outOfRange.scores[0].score === null);

// Мусор не должен притворяться судейством.
ok("не-JSON → пусто", vlm.parseJudgeReply("Извините, не могу оценить это видео.", vdefs).scores.length === 0);
ok("пустой ответ → пусто", vlm.parseJudgeReply("", vdefs).scores.length === 0);

// Без ключа судья обязан честно сказать, что недоступен, а не молчать.
const hadKey = process.env.FAL_KEY;
delete process.env.FAL_KEY;
ok("без FAL_KEY судья не сконфигурирован", vlm.vlmJudgeConfigured() === false);
const noKey = await vlm.judgeRender("https://example/x.mp4", vdefs, { description: "тест" });
ok("без ключа возвращает ошибку, а не пустой скор", noKey.ok === false);
if (hadKey) process.env.FAL_KEY = hadKey;

ok("model-id по умолчанию — проверенный по каталогу fal", vlm.vlmJudgeModel() === "fal-ai/video-understanding");

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
