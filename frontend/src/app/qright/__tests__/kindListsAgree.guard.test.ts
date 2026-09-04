import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Виды объектов на витрине и в публичной спецификации API — один список.
 *
 * ЗАЧЕМ. Форма регистрации строит кнопки выбора вида из `KIND_OPTIONS`, а
 * внешний разработчик интегрируется по спецификации. Если списки разошлись,
 * НАША ЖЕ форма предлагает значение, которое НАША ЖЕ спецификация объявляет
 * недопустимым. Спорят два наших ответа об одном, и оба выглядят
 * авторитетно.
 *
 * ЗАМЕР 04.09.2026, из-за которого сторож написан. Списков оказалось ТРИ, и
 * все три разные:
 *
 *     витрина        code design idea music other text video
 *     спецификация   audio video image text code other
 *     прод (14 зап.) ai-video airspace-edition idea image music other text
 *
 * То есть `design`, `idea` и `music` человек выбрать может, а спецификация
 * их не признаёт; `audio` и `image` спецификация признаёт, а выбрать их
 * негде; а на проде живут два вида, которых нет ни в одном списке —
 * их пишут модули НАПРЯМУЮ, минуя форму.
 *
 * ДИАГНОЗ, а не наблюдение: ограничение стоит на человеческом пути и
 * отсутствует на машинном. Поэтому дописать один вид значит починить
 * сегодняшний случай и оставить механизм: следующий модуль добавит
 * следующий неизвестный вид, и снова никто не скажет.
 *
 * ГРАНИЦА, и её надо знать, читая зелёный. Сторож сверяет ДВА списка,
 * которые лежат в коде. Виды, которые модули пишут в базу напрямую, он не
 * видит: значение приходит из вызова, а не литералом (проверено свипом —
 * ни `ai-video`, ни `airspace-edition` в исходниках этого дерева нет).
 * Значит его зелёный означает «витрина и спецификация согласованы», а НЕ
 * «все виды в реестре известны».
 */

const HERE = __dirname;
const STRANICA = path.join(HERE, "..", "page.tsx");
const SPEKA = path.join(
  HERE, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "lib", "openapiSpec.ts",
);

/** Виды, которые витрина предлагает человеку. */
function vitrina(): string[] {
  const src = fs.readFileSync(STRANICA, "utf8");
  const start = src.indexOf("KIND_OPTIONS");
  expect(start, "в странице QRight не найден KIND_OPTIONS — сломан якорь").toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf("];", start));
  return [...block.matchAll(/value: "([a-z0-9-]+)"/g)].map((m) => m[1]).sort();
}

/** Виды, которые публичная спецификация объявляет допустимыми. */
function spetsifikatsiya(): string[] {
  const src = fs.readFileSync(SPEKA, "utf8");
  // Якорь — ИМЯ СХЕМЫ, а не строка `kind: enum`. Первая редакция брала
  // второе и разобрала ЧУЖОЙ перечень: в файле три таких строки, и первая
  // из них — банковские операции ["topup", "transfer"]. Прибор вернул два
  // вида вместо шести и был уверен в ответе.
  const shema = src.indexOf("QRightObject: {");
  expect(shema, "в спецификации не найдена схема QRightObject — сломан якорь").toBeGreaterThan(-1);
  const start = src.indexOf('kind: { type: "string", enum: [', shema);
  expect(start, "в схеме QRightObject не найден перечень видов").toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf("]", start));
  return [...block.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1])
    .filter((v) => v !== "string")
    .sort();
}

/**
 * Известные расхождения на 04.09.2026. Список обязан ТАЯТЬ.
 *
 * Он здесь не чтобы простить, а чтобы сторож был зелёным на сегодняшнем
 * состоянии и краснел на НОВОМ расхождении. Починили — проверка ниже сама
 * скажет «уберите строку», и освобождение не забудется.
 */
const IZVESTNYE_LISHNIE = ["design", "idea", "music"];

describe("виды объектов: витрина и спецификация", () => {
  it("прибор исправен: оба списка непусты и различимы", () => {
    // Без этого поломка любого якоря делает сторожа вечнозелёным:
    // пустое множество не нарушает ничего.
    const v = vitrina();
    const s = spetsifikatsiya();
    expect(v.length, "витрина не разобрана").toBeGreaterThanOrEqual(5);
    expect(s.length, "спецификация не разобрана").toBeGreaterThanOrEqual(5);
    // Положительный контроль на СМЫСЛ, а не только на объём: оба списка
    // обязаны содержать вид, который есть у обоих. Иначе разобрали не то.
    expect(v, "в витрине нет text — разобран не тот блок").toContain("text");
    expect(s, "в спецификации нет text — разобран не тот блок").toContain("text");
  });

  it("витрина не предлагает того, чего спецификация не признаёт", () => {
    const s = new Set(spetsifikatsiya());
    const lishnie = vitrina().filter((k) => !s.has(k) && !IZVESTNYE_LISHNIE.includes(k));
    expect(
      lishnie,
      "форма даёт выбрать вид, который наш же публичный API объявляет недопустимым",
    ).toEqual([]);
  });

  it("список известных расхождений не пережил свою причину", () => {
    // Зеркальная половина: исключение, которое живёт вечно, замораживает
    // ровно то, что должно было беречь.
    const s = new Set(spetsifikatsiya());
    const pochineno = IZVESTNYE_LISHNIE.filter((k) => s.has(k));
    expect(
      pochineno,
      "починено — удалите эти виды из IZVESTNYE_LISHNIE",
    ).toEqual([]);
  });
});
