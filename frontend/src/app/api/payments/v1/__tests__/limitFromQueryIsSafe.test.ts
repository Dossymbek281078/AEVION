import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readLimit } from "../_lib";

/**
 * Сторож: мусор в ?limit не превращает ответ в «у вас ничего нет».
 *
 * ЗАЧЕМ. Было `Number(searchParams.get("limit") ?? 25)` в трёх местах: журнал
 * выплат, аудит платежей, список ссылок. На `?limit=zzz` это даёт NaN, а NaN
 * проходит сквозь Math.min невредимым — `slice(0, NaN)` возвращает ПУСТОЙ
 * список, и рядом `has_more` становится false. Ответ выглядит как честный:
 * «выплат нет», «в аудите пусто». Для денежных журналов пустой список,
 * неотличимый от правды, опаснее ошибки.
 */
const V1 = join(__dirname, "..");

describe("предел выборки из запроса безопасен", () => {
  it("мусор и отрицательные значения дают умолчание, а не пустоту", () => {
    for (const мусор of ["zzz", "", "-5", "0", "NaN", "1e", null]) {
      expect(
        readLimit(мусор as string | null, { поумолчанию: 25, максимум: 100 }),
        `вход ${JSON.stringify(мусор)} дал не умолчание`
      ).toBe(25);
    }
  });

  it("разумное значение проходит, чрезмерное обрезается потолком", () => {
    expect(readLimit("30", { поумолчанию: 25, максимум: 100 })).toBe(30);
    expect(readLimit("1000000", { поумолчанию: 25, максимум: 100 })).toBe(100);
    expect(readLimit("7.9", { поумолчанию: 25, максимум: 100 })).toBe(7);
  });

  it("ни один маршрут не разбирает число из запроса сам", () => {
    const файлы: string[] = [];
    const обойти = (dir: string) => {
      for (const i of readdirSync(dir)) {
        if (i === "__tests__") continue;
        const p = join(dir, i);
        if (statSync(p).isDirectory()) обойти(p);
        else if (i === "route.ts") файлы.push(p);
      }
    };
    обойти(V1);
    expect(файлы.length, "маршрутов не найдено — обход сломан").toBeGreaterThan(8);

    const свои = файлы.filter((f) =>
      readFileSync(f, "utf8")
        .split(String.fromCharCode(10))
        .some((l) => {
          const t = l.trim();
          if (t.startsWith("//") || t.startsWith("*")) return false;
          return t.includes("searchParams") && t.includes("Number(");
        })
    );
    expect(свои, "маршрут снова разбирает число из запроса сам").toEqual([]);
  });
});
