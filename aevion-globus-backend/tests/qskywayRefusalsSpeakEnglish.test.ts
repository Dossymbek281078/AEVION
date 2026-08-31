import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Отказ — худший момент, чтобы заговорить на языке, которого человек не знает.
 *
 * ⚠️ ЭТА ПРОВЕРКА ПЕРЕПИСАНА 28.08.2026, и причина важнее её самой.
 *
 * Первая версия держала СПИСОК из пяти отказов. Список был зелёный и обещал
 * охват, которого не давал: замер того же дня нашёл в модуле 29 русских
 * отказов, из них 18 без английской половины. Ни один из восемнадцати в список
 * не входил, и проверка о них молчала.
 *
 * Слепота была не в списке, а в свипе, которым список составлен: он искал
 * `error:` ПЕРВЫМ непробельным на строке, то есть видел только многострочную
 * форму записи. Однострочный `res.status(404).json({ error: "…" })` проходил
 * мимо шаблона — а таких было большинство. Один и тот же текст «неизвестный
 * город» стоял одиннадцатью копиями.
 *
 * Поэтому теперь здесь ОБХОД, а не перечень: каждый русский `error:` в файле
 * обязан нести `errorEn:` рядом. Список не может промолчать о том, чего в нём
 * нет, — потому что списка больше нет.
 *
 * Проверка по ИСХОДНИКУ, а не по живому ответу: поднимать сервер и доводить его
 * до 429 ради двух строк дороже, чем прочитать файл, а промахнуться тут негде —
 * строки литеральные.
 */

const ROUTES = path.join(__dirname, "..", "src", "routes");

/**
 * Читаем всю семью `qskyway.*`, а не один файл: 28.08.2026 сосед
 * `qskyway.airspace.anchor.ts` отдавал русские отказы через `fail("…")`, и
 * проверка по одному файлу их не видела. Форма записи там тоже была другая —
 * не присваивание поля, а аргумент помощника.
 */
const MODULE_FILES = readdirSync(ROUTES)
  .filter((f) => f.startsWith("qskyway") && f.endsWith(".ts"))
  .sort();
const SRC = MODULE_FILES.map((f) => readFileSync(path.join(ROUTES, f), "utf8")).join(String.fromCharCode(10));

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

// Отказы, у которых обязана быть английская половина. Ключ — кусок русской
// строки, значение — то, что обязано стоять рядом.
//
// ⚠️ Английская половина сверяется ЦЕЛИКОМ и с закрывающей кавычкой. Первая
// версия искала обрывок «no corridor within the regulator», и мутация её НЕ
// поймала: includes находит подстроку и в «…regulatorX». Тот же дефект я в этот
// же день нашёл у себя дважды — он въедливый.
const REFUSALS: Array<[string, string]> = [
  ["нет коридора в пределах опубликованного потолка", "no corridor within the regulator's published ceiling"],
  ["пруф слишком большой", "proof too large"],
  ["реестр QRight недоступен", "QRight registry unavailable — registration was not performed"],
  ["Слишком много проверок якоря", "Too many anchor checks — verification calls external calendars, try again in a minute."],
  ["Слишком много обращений к реестру", "Too many registry requests — try again in a minute."],
];

describe("отказы QSkyway говорят и по-английски", () => {
  // Каждый отказ файла: русский текст и есть ли английская половина рядом.
  // Разбор построчный и без регулярок — на этой машине обратный слэш в
  // сгенерированном коде живёт плохо, а `indexOf` в такой находке не ошибается.
  const LINES = SRC.split(String.fromCharCode(10));
  const NEEDLE = "error: " + String.fromCharCode(34);
  const refusals: Array<{ line: number; ru: string; paired: boolean }> = [];
  for (let i = 0; i < LINES.length; i++) {
    const at = LINES[i].indexOf(NEEDLE);
    if (at < 0) continue;
    const from = at + NEEDLE.length;
    const to = LINES[i].indexOf(String.fromCharCode(34), from);
    if (to < 0) continue;
    const ru = LINES[i].slice(from, to);
    if (!hasCyrillic(ru)) continue;
    const near = LINES[i] + (LINES[i + 1] ?? "");
    refusals.push({ line: i + 1, ru, paired: near.includes("errorEn:") });
  }

  it("контроль охвата: читается вся семья файлов модуля", () => {
    expect(MODULE_FILES.length).toBeGreaterThan(5);
    expect(MODULE_FILES).toContain("qskyway.ts");
    expect(MODULE_FILES).toContain("qskyway.airspace.anchor.ts");
  });

  it("контроль прибора: обход нашёл отказы, а не пустоту", () => {
    // Без этого «непарных ноль» неотличимо от «не умею искать» — ровно та
    // ошибка, из-за которой предыдущая версия пропустила восемнадцать.
    //
    // Порог понижать МОЖНО только когда отказы СВЕДЕНЫ в общий ответ (так число
    // 19 стало 18, когда близнец from/to уехал в refuseNonNumericPair). Если он
    // упал сам по себе — это не порядок навели, это обход ослеп.
    expect(refusals.length).toBeGreaterThanOrEqual(18);
    expect(refusals.some((r) => r.ru.includes("неизвестный город"))).toBe(true);
  });

  it("ни один отказ не приходит только по-русски", () => {
    const lonely = refusals.filter((r) => !r.paired);
    expect(
      lonely.map((r) => r.line + ": " + r.ru).join("; "),
      "эти отказы придут человеку только по-русски",
    ).toBe("");
  });

  it("одинаковый отказ не размножен копиями", () => {
    // «Неизвестный город» стоял одиннадцатью копиями, и английскую половину
    // пришлось бы добавлять одиннадцать раз. Свели в refuseUnknownCity.
    const seen = new Map<string, number>();
    for (const r of refusals) seen.set(r.ru, (seen.get(r.ru) ?? 0) + 1);
    const dup = [...seen.entries()].filter(([, n]) => n > 1);
    expect(dup.map(([t, n]) => t + " x" + n).join("; "), "текст отказа продублирован").toBe("");
  });

  it("контроль прибора: исходник прочитан и он тот самый", () => {
    // Без этого «все пять на месте» неотличимо от «файл пуст».
    expect(SRC.length).toBeGreaterThan(10000);
    expect(hasCyrillic(SRC)).toBe(true);
    expect(SRC.includes("qskywayRouter")).toBe(true);
  });

  for (const [ru, en] of REFUSALS) {
    it("отказ «" + ru.slice(0, 34) + "…» несёт английскую половину", () => {
      // Русскую половину ищем как НАЧАЛО строкового литерала: без кавычки перед
      // ней утверждение держалось бы и на тексте, куда фразу вставили внутрь
      // другой — то есть проверяло бы не то место.
      expect(SRC.includes(String.fromCharCode(34) + ru), "русская половина исчезла — обновите проверку").toBe(true);
      expect(SRC.includes(en + String.fromCharCode(34)), "английской половины нет: отказ придёт только по-русски").toBe(true);
      expect(hasCyrillic(en)).toBe(false);
    });
  }

  it("перечень не усох: пять отказов, а не сколько осталось", () => {
    // Список из трёх строк тоже был бы зелёным и обещал бы охват, которого нет.
    expect(REFUSALS.length).toBe(5);
  });
});
