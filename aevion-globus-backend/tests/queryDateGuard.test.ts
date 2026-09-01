import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { queryDate } from "../src/lib/queryDate";

/**
 * Дата из запроса не имеет права доехать до СУБД непроверенной.
 *
 * Замер 28.08.2026. Идиома «проверить форму, потом разобрать, иначе 400» была
 * скопирована в трёх файлах и ОТСУТСТВОВАЛА в четырёх местах, где значение так
 * же уходит в сравнение с колонкой времени: три ручки qpaynet и календарь
 * выплат. Там `?before=zzz` давал 500 — то есть клиентскую ошибку выдавали за
 * серверную аварию, поднимая тревогу в Sentry на каждый заход робота.
 *
 * Заведён общий `lib/queryDate`, все семь мест приведены к нему. Копий
 * регулярки в маршрутах теперь ноль: три способа делать одно и то же — это три
 * места, где следующий забудет.
 */

describe("queryDate: форма проверяется до разбора", () => {
  test("отсутствие параметра — это законный null, а не ошибка", () => {
    expect(queryDate(undefined)).toBeNull();
    expect(queryDate(null)).toBeNull();
    // Пустая строка — «фильтр не задан»: так ведут себя формы с пустым полем.
    expect(queryDate("")).toBeNull();
    expect(queryDate("   ")).toBeNull();
  });

  test("годная дата возвращается как есть", () => {
    expect(queryDate("2026-08-28")).toBe("2026-08-28");
    expect(queryDate("2026-08-28T12:00:00Z")).toBe("2026-08-28T12:00:00Z");
    // Возвращается ИСХОДНАЯ строка, а не Date: параметр уходит в запрос как
    // есть, и превращение в Date добавило бы шаг со сдвигом часового пояса.
    expect(typeof queryDate("2026-08-28")).toBe("string");
  });

  test("мусор — это undefined, то есть повод ответить 400", () => {
    for (const bad of ["zzz", "9999-99-99", "28.08.2026", "2026/08/28", "-1"]) {
      expect(queryDate(bad), `«${bad}» принят как дата`).toBeUndefined();
    }
  });

  test("«1» отвергается, хотя Date.parse его принимает", () => {
    // Главная причина проверять ФОРМУ: Date.parse("1") в Node даёт валидную
    // дату (год 2001), а Postgres такую строку не принимает. Проверка одним
    // разбором была бы СЛАБЕЕ базы, и 500 остался бы.
    expect(Number.isNaN(Date.parse("1"))).toBe(false);
    expect(queryDate("1")).toBeUndefined();
  });

  test("массив берётся по первому значению", () => {
    // ?before=2026-08-28&before=zzz
    expect(queryDate(["2026-08-28", "zzz"])).toBe("2026-08-28");
    expect(queryDate(["zzz", "2026-08-28"])).toBeUndefined();
  });

  test("не строка — не дата", () => {
    expect(queryDate(20260828)).toBeUndefined();
    expect(queryDate({})).toBeUndefined();
  });
});

describe("класс закрыт по маршрутам, а не по одному файлу", () => {
  const SRC = path.join(__dirname, "..", "src");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (e.name.endsWith(".ts")) out.push(p);
    }
    return out;
  }

  test("копий регулярки в маршрутах не осталось", () => {
    const copies = walk(SRC)
      .filter((p) => !p.endsWith(path.join("lib", "queryDate.ts")))
      .filter((p) => fs.readFileSync(p, "utf8").includes("ISO_DATE"));
    expect(
      copies.map((p) => path.relative(SRC, p)),
      "регулярка снова скопирована в маршрут — держите её в lib/queryDate",
    ).toEqual([]);
  });

  test("прибор работает: обход находит много файлов и сам помощник", () => {
    const all = walk(SRC);
    expect(all.length).toBeGreaterThan(50);
    expect(all.some((p) => p.endsWith("queryDate.ts"))).toBe(true);
  });

  /**
   * Исключения — поимённо и с причиной. Список без причин через месяц
   * становится местом, куда дописывают, чтобы сторож замолчал.
   *
   * `aevion-hub` `?date=` — не фильтр, а документированный сдвиг «сегодня»
   * для отладки и досыла архивных постов. Форма там уже проверяется, а мусор
   * ОСОЗНАННО откатывается к текущему дню: 400 сломал бы описанное поведение.
   * Никуда дальше значение не уходит — только в `new Date`.
   */
  // Два валидатора одного класса, и это не небрежность, а след параллельной
  // работы: 28.08.2026 две сессии независимо закрывали «дата из запроса уходит
  // в SQL без проверки». Мой queryDate и их queryIsoTimestamp равны по строгости
  // (форма + Date.parse), их вдобавок нормализует результат к ISO.
  //
  // Сторож принимает оба НАМЕРЕННО. Красное на верно написанном коде хуже
  // отсутствия сторожа: к нему привыкают и перестают читать. Сведение двух
  // помощников в один — отдельная задача, она трогает шесть файлов в чужой зоне.
  const VALIDATORS = ["queryDate(", "queryIsoTimestamp("];

  const EXEMPT = new Set(["routes/aevion-hub.ts:734"]);

  test("каждое место, читающее дату из запроса, её проверяет", () => {
    const NAMES = /req\.query\.(before|after|since|until|from|to|date|day|start|end)\b/;
    const bad: string[] = [];
    for (const p of walk(SRC)) {
      const src = fs.readFileSync(p, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!NAMES.test(lines[i])) continue;
        // Проверка обязана стоять на ЭТОЙ ЖЕ строке. Первая версия сторожа
        // смотрела окно в шесть строк — и мутация «вернуть непроверенную
        // дату» её пережила: рядом стоял queryDate для СОСЕДНЕГО параметра и
        // отбеливал испорченную строку. Окно шире предмета не защищает, а
        // создаёт вид защиты.
        const line = lines[i];
        // Разделитель приводим к "/": иначе сторож зависит от платформы.
        const rel = path.relative(SRC, p).split(path.sep).join("/");
        const where = `${rel}:${i + 1}`;
        // Проверка бывает СТРОКОЙ НИЖЕ: сперва читают в переменную, потом валидируют
        // (так сделано в qpaynet). Поэтому смотрим и следующие строки — но только
        // проверку ТОЙ ЖЕ переменной. Это важно: раньше сторож глядел на окно из шести
        // строк без привязки к имени, и соседний верный вызов ОБЕЛЯЛ испорченную
        // строку — мутация выживала. Имя переменной убирает эту дыру.
        const name = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line)?.[1];
        const near = lines.slice(i, i + 3).join(" ");
        const validatedHere = VALIDATORS.some((v) => line.includes(v));
        const validatedBelow = !!name && VALIDATORS.some((v) => near.includes(v + name));
        const guarded = validatedHere || validatedBelow || EXEMPT.has(where);
        if (!guarded) bad.push(`${path.relative(SRC, p)}:${i + 1}`);
      }
    }
    expect(bad, "дата из запроса уходит в сравнение без проверки формы").toEqual([]);
  });
});
