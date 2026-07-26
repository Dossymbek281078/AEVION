#!/usr/bin/env node
// Тест карты разногласий мультичата.
//   node scripts/multichat-dissent.test.mjs
//
// Главное, что проверяем: карта не выдаёт «консенсус» там, где сравнивать не с
// чем, и не считает конфликтом числа из разных тем. Ошибка в любую сторону
// обесценивает всю идею: ложный консенсус усыпляет, ложный конфликт зашумляет.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SRC = path.join(HERE, "..", "aevion-globus-backend/src/services/multichat/dissent.ts");

// .mts-копия: бэкенд — CommonJS-пакет, .ts в нём грузится как CJS.
const tmp = path.join(tmpdir(), `multichat-dissent-${process.pid}.mts`);
writeFileSync(tmp, readFileSync(SRC, "utf8"), "utf8");
const m = await import("file:///" + tmp.replace(/\\/g, "/"));
process.on("exit", () => { try { unlinkSync(tmp); } catch { /* уже убран */ } });

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

const A = (agentId, reply, ok = true, error) => ({ agentId, ok, reply, error });

/* ── 1. Согласие и расхождение ──────────────────────────────────────────── */

const agree = m.buildDissentMap([
  A("gpt", "Рекомендую Kling: он дешевле в 2.4 раза и качества хватает для теста гипотезы."),
  A("claude", "Стоит взять Kling — дешевле примерно в 2.4 раза, качества достаточно для проверки гипотезы."),
]);
ok("похожие ответы → consensus", agree.verdict === "consensus", `${agree.verdict} (${agree.agreement})`);
ok("в примечании есть предупреждение о совпадении ошибок", /ошибаются похоже/.test(agree.note));

const split = m.buildDissentMap([
  A("gpt", "Берите Seedance: качество режиссуры выше, разница в цене несущественна."),
  A("claude", "Ни в коем случае не Seedance. Аудитория не заметит разницы, деньги уйдут впустую."),
]);
ok("противоположные ответы → split", split.verdict === "split", `${split.verdict} (${split.agreement})`);

/* ── 2. Нечего сравнивать — не выдавать консенсус ───────────────────────── */

ok("один ответ → insufficient", m.buildDissentMap([A("gpt", "Ответ")]).verdict === "insufficient");
ok("пустой список → insufficient", m.buildDissentMap([]).verdict === "insufficient");
const oneFailed = m.buildDissentMap([A("gpt", "Ответ"), A("claude", undefined, false, "timeout")]);
ok("второй агент упал → insufficient, а не consensus", oneFailed.verdict === "insufficient", oneFailed.verdict);
ok("упавший агент попал в hedges", oneFailed.hedges.some((h) => h.kind === "failed"));

/* ── 3. Числовые конфликты ──────────────────────────────────────────────── */

const money = m.buildDissentMap([
  A("gpt", "Полный прогон бенчмарка обойдётся примерно в $36 на выбранном движке."),
  A("claude", "Полный прогон бенчмарка обойдётся примерно в $15 на выбранном движке."),
]);
ok("разные суммы в схожем контексте → конфликт", money.numericConflicts.length >= 1,
  JSON.stringify(money.numericConflicts).slice(0, 120));
ok("в конфликте названы оба агента", money.numericConflicts[0]?.values.length === 2);
ok("разброс посчитан", money.numericConflicts[0]?.spread === 21, String(money.numericConflicts[0]?.spread));

// Числа из РАЗНЫХ тем не должны слипаться в конфликт.
const differentTopics = m.buildDissentMap([
  A("gpt", "Бюджет составит 40 долларов на рендер видеороликов."),
  A("claude", "Команде потребуется 5 человек для запуска маркетинговой кампании."),
]);
ok("числа из разных тем не конфликтуют", differentTopics.numericConflicts.length === 0,
  JSON.stringify(differentTopics.numericConflicts).slice(0, 100));

// Одинаковые числа — это согласие, а не конфликт.
const sameNumber = m.buildDissentMap([
  A("gpt", "Прогон стоит 25 долларов при текущем курсе."),
  A("claude", "Прогон стоит 25 долларов при текущем курсе."),
]);
ok("одинаковые числа конфликтом не считаются", sameNumber.numericConflicts.length === 0);

// Годы — шум, а не предмет спора.
const years = m.buildDissentMap([
  A("gpt", "Технология появилась в 2023 году и развивалась быстро."),
  A("claude", "Технология появилась в 2024 году и развивалась быстро."),
]);
ok("годы не порождают ложный конфликт", years.numericConflicts.length === 0,
  JSON.stringify(years.numericConflicts).slice(0, 100));

// Контекст конфликта человек читает ПЕРВЫМ — он обязан быть цельной фразой, а
// не обрывком окна фиксированной ширины (так было до 2026-07-26: контекст
// начинался с середины слова и им же заканчивался).
const ctxSrc = [
  A("gpt", "Сначала нужен канал. На текущем трафике это примерно 40 посетителей в месяц, выборки не хватит."),
  A("claude", "Сначала нужен канал. На текущем трафике это примерно 300 посетителей в месяц, выборки не хватит."),
];
const ctx = m.buildDissentMap(ctxSrc)?.numericConflicts[0]?.context || "";
ok("контекст — целая фраза, конфликт найден", !!ctx, ctx);
ok("контекст не начинается с обрезка предыдущей фразы", !/^[а-яё]/.test(ctx) && !ctx.startsWith("канал"), ctx);
ok("контекст — ровно своё предложение целиком",
  ctx === "На текущем трафике это примерно 40 посетителей в месяц, выборки не хватит.", ctx);

// Длинное предложение всё-таки режется — но по границе слова и с многоточием,
// иначе усечённое слово читается как опечатка нашего продукта.
const longSentence = "Оценка стоимости прогона " + "с учётом дополнительных проверок и повторных рендеров ".repeat(6) + "составит 40 долларов итого.";
const longCtx = m.buildDissentMap([
  A("gpt", longSentence),
  A("claude", longSentence.replace("40 долларов", "90 долларов")),
])?.numericConflicts[0]?.context || "";
ok("длинный контекст усечён многоточием", longCtx.endsWith("…"), longCtx.slice(-30));
ok("усечённый контекст не длиннее лимита", longCtx.length <= 181, String(longCtx.length));
// Настоящая проверка границы слова: снимаем многоточие и смотрим, что в
// исходнике сразу за этим местом стоит пробел. Если бы резали по букве, там
// оказалась бы середина слова.
const body = longCtx.slice(0, -1);
ok("усечение попало на границу слова",
  longSentence.startsWith(body) && /^\s/.test(longSentence.slice(body.length)),
  `«…${body.slice(-18)}» → «${longSentence.slice(body.length, body.length + 8)}»`);

/* ── 4. Аутлаер ─────────────────────────────────────────────────────────── */

const three = m.buildDissentMap([
  A("a", "Нужно выбрать Kling: дешевле, качества достаточно для проверки гипотезы."),
  A("b", "Стоит взять Kling — он дешевле, качества хватит для проверки гипотезы."),
  A("c", "Вопрос поставлен неверно: сначала нужно определить критерий успеха, иначе выбор движка бессмысленен."),
]);
ok("аутлаер определён", three.outlier?.agentId === "c", JSON.stringify(three.outlier));
ok("на двух агентах аутлаера нет", m.buildDissentMap([A("a", "текст один"), A("b", "текст два")]).outlier === null);

/* ── 5. Хеджи ───────────────────────────────────────────────────────────── */

const hedged = m.buildDissentMap([
  A("gpt", "Однозначно берите первый вариант, он лучше по всем параметрам."),
  A("claude", "Не уверен: данных для сравнения недостаточно, нужен замер."),
]);
ok("осторожный ответ помечен", hedged.hedges.some((h) => h.kind === "hedged"), JSON.stringify(hedged.hedges));

// Детектор обязан работать на ОБОИХ языках. В первой версии он молча не видел
// кириллицу: `\b` в JS определён по [A-Za-z0-9_] и перед «не» не срабатывает.
const hedgedEn = m.buildDissentMap([
  A("gpt", "Definitely go with option one, it wins on every metric."),
  A("claude", "I cannot answer this reliably without more data."),
]);
ok("англоязычный хедж тоже помечен", hedgedEn.hedges.some((h) => h.kind === "hedged"), JSON.stringify(hedgedEn.hedges));

/* ── 6. Детерминированность ─────────────────────────────────────────────── */

const input = [A("a", "Первый развёрнутый ответ про стоимость прогона."), A("b", "Второй ответ про стоимость прогона.")];
ok("повторный вызов даёт тот же результат",
  JSON.stringify(m.buildDissentMap(input)) === JSON.stringify(m.buildDissentMap(input)),
  "карта обязана быть воспроизводимой — иначе её нельзя класть в чек");

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
