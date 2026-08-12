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

/* ── 1б. Прямое отрицание — не консенсус ────────────────────────────────── */
//
// Худший из возможных отказов этой карты. Схожесть считается по общим словам, а
// «не» лежит в стоп-словах — то есть слово, переворачивающее смысл, выбрасывали
// ДО сравнения. «Стоит запускать» и «не стоит запускать» давали схожесть 1.0 и
// вердикт «агенты сошлись»: продукт, вся ценность которого в показе
// разногласия, на самом ярком разногласии молчал.

const negated = m.buildDissentMap([
  A("gpt", "Да, стоит запускать платный тариф до первой продажи на текущем трафике."),
  A("claude", "Нет, не стоит запускать платный тариф до первой продажи на текущем трафике."),
]);
ok("прямое отрицание → split, а не консенсус", negated.verdict === "split",
  `${negated.verdict} (схожесть ${negated.agreement})`);
ok("противоречие названо словом, по которому оно найдено",
  negated.contradictions?.some((c) => c.word === "стоит"),
  JSON.stringify(negated.contradictions));
ok("названы обе стороны", negated.contradictions?.[0]?.affirms.includes("gpt") && negated.contradictions?.[0]?.denies.includes("claude"),
  JSON.stringify(negated.contradictions?.[0]));
ok("противоречие попало в «что проверить»",
  (negated.checks || []).some((c) => c.kind === "contradiction"),
  JSON.stringify((negated.checks || []).map((c) => c.kind)));

const notRecommended = m.buildDissentMap([
  A("gpt", "Мы рекомендуем подписывать этот договор в текущей редакции."),
  A("claude", "Мы не рекомендуем подписывать этот договор в текущей редакции."),
]);
ok("«рекомендуем» против «не рекомендуем» → split", notRecommended.verdict === "split",
  `${notRecommended.verdict} (${notRecommended.agreement})`);

const canCannot = m.buildDissentMap([
  A("gpt", "Данные пользователей можно передавать подрядчику при наличии согласия."),
  A("claude", "Данные пользователей нельзя передавать подрядчику даже при наличии согласия."),
]);
ok("«можно» против «нельзя» → split", canCannot.verdict === "split",
  `${canCannot.verdict} (${canCannot.agreement})`);

// Обратная ошибка так же вредна: отрицание в ОДНОМ ответе (или в обоих) не
// делает ответы противоречащими друг другу.
const bothNegate = m.buildDissentMap([
  A("gpt", "Нет, не стоит запускать платный тариф до первой продажи."),
  A("claude", "Не стоит запускать платный тариф до первой продажи."),
]);
ok("оба отрицают одно и то же — противоречия нет", (bothNegate.contradictions || []).length === 0,
  JSON.stringify(bothNegate.contradictions));

// Обороты, где «не» — усилитель, а не отрицание. «Не только в цене» не спорит
// с «только цена и решает», «не менее 300» не отрицает «менее 300»: это
// конструкции «X и сверх того» и «не ниже границы». Без этого разбора
// детектор противоречий сам становится источником ложных конфликтов — того
// самого шума, ради устранения которого он и заведён.
const notOnly = m.buildDissentMap([
  A("gpt", "Проблема не только в цене: людям неясна сама польза продукта."),
  A("claude", "Только цена и решает: остальное вторично для этой аудитории."),
]);
ok("«не только» противоречием не считается", notOnly.contradictions.length === 0,
  JSON.stringify(notOnly.contradictions));

const notLess = m.buildDissentMap([
  A("gpt", "Нужен трафик не менее 300 визитов в месяц, иначе выборка бессмысленна."),
  A("claude", "При трафике менее 300 визитов запускать тариф рано."),
]);
ok("«не менее» противоречием не считается", notLess.contradictions.length === 0,
  JSON.stringify(notLess.contradictions));

const notJust = m.buildDissentMap([
  A("gpt", "Это не просто скидка, а изменение модели монетизации."),
  A("claude", "Просто дайте скидку и посмотрите на отклик."),
]);
ok("«не просто» противоречием не считается", notJust.contradictions.length === 0,
  JSON.stringify(notJust.contradictions));

// А вот усилитель степени отрицание пропускает дальше: спорят о «хорошо», а не
// о слове «очень».
const notVery = m.buildDissentMap([
  A("gpt", "Идея не очень удачная при текущем позиционировании продукта."),
  A("claude", "Идея удачная при текущем позиционировании продукта."),
]);
ok("«не очень удачная» спорит с «удачная»", notVery.contradictions.some((c) => c.word === "удачная"),
  JSON.stringify(notVery.contradictions));

// Настоящие противоречия от этого разбора не пострадали.
const stillReal = m.buildDissentMap([
  A("gpt", "На текущем трафике выборки не хватит, вывод будет шумом."),
  A("claude", "Выборки хватит: 300 визитов достаточно для первой проверки."),
]);
ok("«не хватит» против «хватит» осталось противоречием",
  stillReal.contradictions.some((c) => c.word === "хватит"), JSON.stringify(stillReal.contradictions));

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

// Разделитель тысяч. Модели пишут суммы по-разному в одном и том же ответе:
// «$1,200» и «$1200» — это ОДНА сумма. Запятая читалась как десятичная точка,
// $1,200 превращалось в 1.2, и два агента, назвавшие одинаковую сумму, попадали
// в карту разногласий с разбросом 1198.8. Ложный конфликт хуже пропущенного:
// он отправляет человека проверять то, чего нет, и обесценивает всю карту.
ok("тысячи через запятую разобраны", m.numericClaims("Бюджет $1,200 в месяц")[0]?.value === 1200,
  JSON.stringify(m.numericClaims("Бюджет $1,200 в месяц")));
ok("тысячи в несколько групп разобраны", m.numericClaims("Оборот $1,234,567 за год")[0]?.value === 1234567,
  JSON.stringify(m.numericClaims("Оборот $1,234,567 за год")));
ok("десятичная запятая осталась десятичной", m.numericClaims("Рост 2,5 процента")[0]?.value === 2.5,
  JSON.stringify(m.numericClaims("Рост 2,5 процента")));
ok("тысячи через точку разобраны", m.numericClaims("Оборот 1.234.567 тенге")[0]?.value === 1234567,
  JSON.stringify(m.numericClaims("Оборот 1.234.567 тенге")));
ok("десятичная точка осталась десятичной", m.numericClaims("Коэффициент 1.5 к выручке")[0]?.value === 1.5,
  JSON.stringify(m.numericClaims("Коэффициент 1.5 к выручке")));

const sameMoney = m.buildDissentMap([
  A("gpt", "Месячный бюджет на рекламу составит $1,200 при текущих ставках."),
  A("claude", "Месячный бюджет на рекламу составит $1200 при текущих ставках."),
]);
ok("одна сумма в разной записи конфликтом не считается", sameMoney.numericConflicts.length === 0,
  JSON.stringify(sameMoney.numericConflicts).slice(0, 160));

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

/* ── 7. Список «что проверить» ──────────────────────────────────────────── */

// Карта отвечает «где разошлись» — это диагноз. Человеку нужен следующий шаг.
const withNumbers = m.buildDissentMap([
  A("analyst", "На текущем трафике это примерно 40 посетителей в месяц, выборки не хватит."),
  A("skeptic", "На текущем трафике это примерно 300 посетителей в месяц, и это меняет вывод."),
  A("practic", "Не уверен, что это вообще развилка. Проверьте на десяти живых людях сначала."),
]);
const checks = withNumbers.checks;
ok("список не пуст при расхождении", checks.length > 0, JSON.stringify(checks).slice(0, 80));
ok("числовой пункт есть", checks.some((c) => c.kind === "number"));
ok("числовой пункт называет обе стороны",
  checks.some((c) => c.kind === "number" && c.text.includes("40") && c.text.includes("300")),
  JSON.stringify(checks.find((c) => c.kind === "number")));
ok("неуверенность попала в список", checks.some((c) => c.kind === "hedge"));
ok("аутлаер попал в список", checks.some((c) => c.kind === "outlier"));

// Порядок — по ПРОВЕРЯЕМОСТИ. Совет, который нельзя закрыть за минуту, на
// практике не выполняют, поэтому числа обязаны идти раньше «прочитать и подумать».
const iNum = checks.findIndex((c) => c.kind === "number");
const iOut = checks.findIndex((c) => c.kind === "outlier");
ok("проверяемое стоит раньше требующего суждения", iNum >= 0 && iOut > iNum, `число=${iNum}, аутлаер=${iOut}`);
ok("вес убывает по списку", checks.every((c, i) => i === 0 || checks[i - 1].weight >= c.weight),
  checks.map((c) => c.weight).join(","));
ok("список ограничен по длине", checks.length <= 5, String(checks.length));

// Упавший агент — не «мелочь»: без его ответа картина неполна, и это должно
// стоять в списке наравне с числами, а не теряться внизу.
const failedAgent = m.buildDissentMap([
  A("gpt", "Ответ по существу с оценкой в 20 долларов за прогон."),
  { agentId: "claude", ok: false, error: "timeout" },
]);
ok("отказ агента попал в список", failedAgent.checks.some((c) => c.kind === "failure"));
ok("отказ имеет высокий вес", failedAgent.checks.find((c) => c.kind === "failure")?.weight === 3);

// При согласии список НЕ пустой: молчание читалось бы как «всё в порядке»,
// тогда как согласие моделей само по себе ничего не доказывает.
const agreed = m.buildDissentMap([
  A("gpt", "Стратегия роста через партнёрские интеграции выглядит оптимальной сейчас."),
  A("claude", "Стратегия роста через партнёрские интеграции выглядит оптимальной сейчас."),
]);
ok("при согласии список предупреждает об общей посылке",
  agreed.verdict === "consensus" && agreed.checks.some((c) => c.kind === "consensus"),
  `${agreed.verdict} / ${JSON.stringify(agreed.checks)}`);

// Дискриминирующая сила: на входе без единого расхождения числовых пунктов
// быть НЕ должно, иначе тест выше проходил бы на чём угодно.
ok("без расхождений числовых пунктов нет", !agreed.checks.some((c) => c.kind === "number"),
  JSON.stringify(agreed.checks));

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
