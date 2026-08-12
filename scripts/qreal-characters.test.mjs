#!/usr/bin/env node
// Тест реестра персонажей QReal.
//   node scripts/qreal-characters.test.mjs
//
// Проверяет то, ради чего реестр существует: один и тот же персонаж из разных
// кадров должен слиться в ОДНУ запись с одним описанием, а разные персонажи —
// не слипнуться. Ошибка в любую сторону хуже, чем отсутствие фичи: слипание
// подменит одного героя другим, разделение вернёт дрейф.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.join(HERE, "..");

// .mts-копия: бэкенд — CommonJS-пакет, .ts в нём грузится как CJS.
const tmp = path.join(tmpdir(), `qreal-characters-${process.pid}.mts`);
writeFileSync(tmp, readFileSync(path.join(ROOT, "aevion-globus-backend/src/services/qreal/characters.ts"), "utf8"), "utf8");
const m = await import("file:///" + tmp.replace(/\\/g, "/"));
process.on("exit", () => { try { unlinkSync(tmp); } catch { /* уже убран */ } });

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

/* ── 1. Слияние одного героя из разных кадров ───────────────────────────── */

// Реальный дрейф из демо «Утро в степи»: мальчик описан по-разному в двух кадрах.
const drifting = [
  { id: "s1", subjects: [
    { kind: "child", description: "7yo boy, tousled hair, oversized sweater, childlike gait" },
    { kind: "animal", description: "Central Asian shepherd dog, tail wagging, ears reacting to voice" },
  ]},
  { id: "s2", subjects: [
    { kind: "child", description: "little boy running, tousled hair" },
    { kind: "nature", description: "steppe, feather grass, dawn light" },
  ]},
  { id: "s3", subjects: [
    { kind: "animal", description: "shepherd dog Alabai, tail wagging" },
  ]},
];
const chars = m.deriveCharacters(drifting);
ok("два персонажа, а не четыре", chars.length === 2, `получил ${chars.length}: ${chars.map((c) => c.name).join(" | ")}`);

const boy = chars.find((c) => c.kind === "child");
const dog = chars.find((c) => c.kind === "animal");
ok("мальчик найден", !!boy);
ok("собака найдена", !!dog);
ok("мальчик занят в двух кадрах", boy?.shotIds.join(",") === "s1,s2", boy?.shotIds.join(","));
ok("собака занята в двух кадрах", dog?.shotIds.join(",") === "s1,s3", dog?.shotIds.join(","));

// Каноническим должно стать САМОЕ ПОДРОБНОЕ описание — короткое из него выводимо,
// наоборот нет.
ok("каноническое описание — подробное", boy?.canonical.includes("oversized sweater"), boy?.canonical);

/* ── 2. Разные персонажи НЕ слипаются ───────────────────────────────────── */

const twoPeople = [
  { id: "s1", subjects: [
    { kind: "human", description: "grandmother ~70, weathered hands, warm squint, headscarf" },
    { kind: "child", description: "7yo boy, tousled hair, oversized sweater" },
  ]},
];
const pair = m.deriveCharacters(twoPeople);
ok("бабушка и мальчик — разные персонажи", pair.length === 2, `получил ${pair.length}`);

// Два животных разных видов не должны слиться только потому, что оба «животные».
const twoAnimals = m.deriveCharacters([
  { id: "s1", subjects: [
    { kind: "animal", description: "Central Asian shepherd dog, tail wagging" },
    { kind: "animal", description: "grey cat, twitching ear, sitting on windowsill" },
  ]},
]);
ok("собака и кот не слиплись", twoAnimals.length === 2, `получил ${twoAnimals.length}`);

/* ── 3. Пейзаж и реквизит персонажами не становятся ─────────────────────── */

const propsOnly = m.deriveCharacters([
  { id: "s1", subjects: [
    { kind: "nature", description: "steppe, feather grass, dawn light, wind" },
    { kind: "object", description: "copper kettle, piala bowls, steam in light shaft" },
  ]},
]);
ok("трава и чайник не персонажи", propsOnly.length === 0, `получил ${propsOnly.length}`);

/* ── 4. human/child путаница LLM не плодит дубли ────────────────────────── */

const mixedKind = m.deriveCharacters([
  { id: "s1", subjects: [{ kind: "human", description: "7yo boy, tousled hair, oversized sweater" }] },
  { id: "s2", subjects: [{ kind: "child", description: "boy with tousled hair, oversized sweater" }] },
]);
ok("один мальчик, хотя kind разный", mixedKind.length === 1, `получил ${mixedKind.length}`);
ok("итоговый kind уточнён до child", mixedKind[0]?.kind === "child", mixedKind[0]?.kind);

/* ── 5. Подстановка в кадр ──────────────────────────────────────────────── */

const lines = m.subjectLines(drifting[1].subjects, chars);
ok("в кадре 2 подставлено каноническое описание", lines.some((l) => l.includes("oversized sweater")), lines.join(" | "));
ok("разовый субъект остался как был", lines.some((l) => l.includes("feather grass")), lines.join(" | "));

const inShot = m.charactersInShot(drifting[0].subjects, chars);
ok("в кадре 1 занято два персонажа", inShot.length === 2, String(inShot.length));

/* ── 6. Директива консистентности ───────────────────────────────────────── */

const dir = m.consistencyDirective(inShot);
ok("директива называет обоих персонажей", dir.includes("oversized sweater") && dir.includes("shepherd dog"));
ok("директива запрещает переосмысление", /do not reinterpret/i.test(dir));
ok("без персонажей директива пуста", m.consistencyDirective([]) === "");

/* ── 7. Детерминированность ─────────────────────────────────────────────── */

const again = m.deriveCharacters(drifting);
ok("повторный вызов даёт те же id и описания",
  JSON.stringify(again) === JSON.stringify(chars),
  "реестр обязан быть стабильным, иначе он прыгает при каждой пересборке");

/* ── 8. Мусор на входе не роняет ────────────────────────────────────────── */

ok("пустой список кадров", m.deriveCharacters([]).length === 0);
ok("кадр без субъектов", m.deriveCharacters([{ id: "s1", subjects: [] }]).length === 0);
ok("пустое описание игнорируется", m.deriveCharacters([{ id: "s1", subjects: [{ kind: "child", description: "  " }] }]).length === 0);

/* ── 9. Референс-каст для reference-to-video ────────────────────────────── */

// Без референсов — обычные строки, image_urls пуст: вызывающий останется на
// text-to-video, а не заплатит за reference-модель впустую.
const noRefs = m.referenceCast(drifting[0].subjects, chars);
ok("без референсов image_urls пуст", noRefs.imageUrls.length === 0);
ok("без референсов в промте нет @Image", !noRefs.lines.join(" ").includes("@Image"));

// С референсами: номер в промте обязан совпадать с позицией в массиве —
// разъедутся, и модель приклеит лицо мальчика собаке.
const withRefs = JSON.parse(JSON.stringify(chars));
withRefs.find((c) => c.kind === "child").refImages = ["https://cdn/boy.png"];
withRefs.find((c) => c.kind === "animal").refImages = ["https://cdn/dog.png"];
const rc = m.referenceCast(drifting[0].subjects, withRefs);
ok("оба референса собраны", rc.imageUrls.length === 2, rc.imageUrls.join(","));
const boyLine = rc.lines.find((l) => l.includes("oversized sweater"));
const boyIdx = rc.imageUrls.indexOf("https://cdn/boy.png") + 1;
ok("мальчик ссылается на СВОЮ картинку", boyLine?.includes(`@Image${boyIdx}`), `${boyLine} | idx ${boyIdx}`);
const dogLine = rc.lines.find((l) => l.includes("shepherd dog"));
const dogIdx = rc.imageUrls.indexOf("https://cdn/dog.png") + 1;
ok("собака ссылается на свою", dogLine?.includes(`@Image${dogIdx}`), `${dogLine} | idx ${dogIdx}`);

// Персонаж без референса не должен «съесть» чужой номер.
const partial = JSON.parse(JSON.stringify(chars));
partial.find((c) => c.kind === "animal").refImages = ["https://cdn/dog.png"];
const rp = m.referenceCast(drifting[0].subjects, partial);
ok("персонаж без референса номера не получает", rp.imageUrls.length === 1, String(rp.imageUrls.length));
ok("единственный референс — @Image1", rp.lines.some((l) => l.includes("@Image1") && l.includes("shepherd dog")), rp.lines.join(" | "));

/* ── 10. Метка персонажа ────────────────────────────────────────────────── */

// Наивное «первые два слова» давало «central asian» — метку без предмета.
// Предмет стоит в конце первой фразы, уточнения идут после запятой.
const names = [
  ["Central Asian shepherd dog, tail wagging, ears reacting to voice", "shepherd dog"],
  ["7yo boy, tousled hair, oversized sweater, childlike gait", "7yo boy"],
  ["golden eagle, accurate wing mechanics, feather detail", "golden eagle"],
  ["grandmother ~70, weathered hands, warm squint, headscarf", "grandmother"],
  ["grey cat, twitching ear, sitting on windowsill", "grey cat"],
];
for (const [input, expected] of names) {
  const got = m.deriveName(input);
  ok(`метка «${expected}»`, got === expected, `получил «${got}»`);
}
ok("пустое описание не роняет", m.deriveName("") === "персонаж");

/* ── 11. Правка канона не должна ломать узнавание ───────────────────────── */

// Найдено вычиткой: если сопоставлять кадр с ПРАВЛЕНЫМ каноном, то режиссёр,
// переписавший описание своими словами (например, по-русски), обнулит
// сходство с английским описанием кадра — персонаж перестанет узнаваться, и
// его же правка молча перестанет применяться.
const edited = JSON.parse(JSON.stringify(chars));
const boyEdited = edited.find((c) => c.kind === "child");
boyEdited.canonical = "Ақтөс, семилетний казахский мальчик в растянутом свитере";

ok("персонаж узнаётся после правки канона на другом языке",
  m.matchCharacter(drifting[0].subjects[0], edited)?.id === boyEdited.id,
  "сопоставление обязано идти по неизменным aliases, а не по canonical");

const linesAfterEdit = m.subjectLines(drifting[1].subjects, edited);
ok("правленый канон реально уходит в кадр",
  linesAfterEdit.some((l) => l.includes("Ақтөс")), linesAfterEdit.join(" | "));

ok("aliases сохранены при выводе", boyEdited.aliases.length >= 2, String(boyEdited.aliases?.length));

// Старые записи из БД (до появления aliases) не должны переставать работать.
const legacy = edited.map((c) => { const { aliases, ...rest } = c; return rest; });
const legacyBoy = legacy.find((c) => c.kind === "child");
legacyBoy.canonical = "7yo boy, tousled hair, oversized sweater, childlike gait";
ok("запись без aliases падает на canonical, а не ломается",
  m.matchCharacter(drifting[0].subjects[0], legacy)?.id === legacyBoy.id);

/* ── Различитель, отменяющий склейку ────────────────────────────────────── */
//
// Мера схожести делит общие слова на размер МЕНЬШЕГО набора — так «7yo boy» и
// «7yo boy, tousled hair, sweater» узнают друг друга, и это правильно. Но у
// такой нормировки есть следствие: любое описание-надмножество получает 1.0,
// сколько бы слов в него ни добавили — включая слово, которое делает героя
// ДРУГИМ. Замер до правки: «7yo boy with glasses» против «7yo boy without
// glasses» → 1.000 при пороге склейки 0.34.
//
// Цена ошибки прямая: два разных персонажа сливаются в одного, и генератор
// берёт для обоих кадров одну референсную картинку — тот самый дрейф
// внешности, ради устранения которого реестр и написан.

// Саму меру схожести не трогаем: порог 0.34 подобран под свою задачу, а
// «7yo boy» и «7yo boy, tousled hair, sweater» обязаны узнавать друг друга.
// Поэтому она по-прежнему говорит 1.0 — и именно поэтому решение принимает не
// она одна. Проверка закрепляет разделение обязанностей, а не «улучшение» меры.
ok("схожесть слов сама по себе различитель не видит",
  m.similarity("7yo boy with glasses", "7yo boy without glasses") === 1,
  String(m.similarity("7yo boy with glasses", "7yo boy without glasses")));
ok("различитель виден отдельным сигналом",
  m.contradictsFeature("7yo boy with glasses", "7yo boy without glasses"));

const glasses = m.deriveCharacters([
  { id: "s1", subjects: [{ kind: "human", description: "7yo boy with glasses" }] },
  { id: "s2", subjects: [{ kind: "human", description: "7yo boy without glasses" }] },
]);
ok("мальчик в очках и без очков — два персонажа", glasses.length === 2,
  `получил ${glasses.length}: ${glasses.map((c) => c.canonical).join(" | ")}`);

const noBeard = m.deriveCharacters([
  { id: "s1", subjects: [{ kind: "human", description: "tall man with beard, dark coat" }] },
  { id: "s2", subjects: [{ kind: "human", description: "tall man, no beard, dark coat" }] },
]);
ok("«с бородой» и «без бороды» — два персонажа", noBeard.length === 2,
  `получил ${noBeard.length}: ${noBeard.map((c) => c.canonical).join(" | ")}`);

// Обратная ошибка так же вредна: отрицание в ОБОИХ описаниях различителем не
// является, и дробить одного героя на двоих нельзя.
const bothWithout = m.deriveCharacters([
  { id: "s1", subjects: [{ kind: "human", description: "7yo boy without glasses" }] },
  { id: "s2", subjects: [{ kind: "human", description: "7yo boy without glasses, red sweater" }] },
]);
ok("оба «без очков» — один персонаж", bothWithout.length === 1,
  `получил ${bothWithout.length}: ${bothWithout.map((c) => c.canonical).join(" | ")}`);

// Умолчание — не отрицание: если во втором кадре про очки просто не сказано,
// это тот же герой, а не новый.
const silent = m.deriveCharacters([
  { id: "s1", subjects: [{ kind: "human", description: "7yo boy with glasses, red sweater" }] },
  { id: "s2", subjects: [{ kind: "human", description: "7yo boy, red sweater" }] },
]);
ok("умолчание про очки персонажа не раздваивает", silent.length === 1,
  `получил ${silent.length}: ${silent.map((c) => c.canonical).join(" | ")}`);

// И то же самое на распознавании субъекта кадра, а не только на сборке.
ok("субъект «без очков» не признаётся персонажем в очках",
  m.matchCharacter({ kind: "human", description: "7yo boy without glasses" },
    [{ id: "ch-1", kind: "human", canonical: "7yo boy with glasses", aliases: ["7yo boy with glasses"], shotIds: [] }]) === null);

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
