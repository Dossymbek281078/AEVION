import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * На экране стояло «ветер 5.14→27.35 м/с». Две цифры после запятой — точность
 * измерения, а верхняя часть этой пары к измерению отношения не имеет: рядом в
 * ответе честно написано, что рост скорости по высоте это ИЛЛЮСТРАТИВНАЯ
 * модель, потому что METAR данных о ветре на высоте не содержит.
 *
 * То есть число выглядело точнее, чем знает источник. Модуль этого класса не
 * терпит в других местах (`confClearOnObstaclesM` округляется тем же способом),
 * и здесь он был нарушен недосмотром, а не решением.
 *
 * Один знак — не косметика: он говорит читателю, СКОЛЬКО тут правды.
 */

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
};

function decimals(n: number): number {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

describe("скорость ветра не притворяется точнее источника", () => {
  it("контроль прибора: считалка знаков после запятой работает", () => {
    // Иначе «знаков не больше одного» верно и для сломанной проверки.
    expect(decimals(27.35)).toBe(2);
    expect(decimals(27.3)).toBe(1);
    expect(decimals(27)).toBe(0);
  });

  it("у земли и наверху — не больше одного знака после запятой", async () => {
    const r = await request(app()).get("/api/qskyway/city?city=astana");
    expect(r.status).toBe(200);
    const w = r.body?.wind;
    expect(w, "в ответе нет блока ветра — проверка ничего не проверяет").toBeTruthy();
    expect(
      decimals(w.groundMs),
      `скорость у земли ${w.groundMs} несёт больше одного знака: это точность, которой у источника нет`,
    ).toBeLessThanOrEqual(1);
    expect(
      decimals(w.topMs),
      `скорость наверху ${w.topMs} несёт больше одного знака, хотя рост по высоте — иллюстративная модель`,
    ).toBeLessThanOrEqual(1);
  });

  it("и рядом сказано, какая часть числа настоящая", async () => {
    // Округление без этой оговорки только прячет проблему: читатель по-прежнему
    // не знает, что верхняя скорость смоделирована.
    const r = await request(app()).get("/api/qskyway/city?city=astana");
    expect(String(r.body?.wind?.note || "")).toMatch(/METAR|иллюстративн/);
  });

  it("округление ПРИМЕНЕНО в коде — проверка по ответу его удаление не поймает", () => {
    // Честная граница, а не украшение. В тестовой среде METAR недоступен, и
    // работает иллюстративная модель: там значения и так с одним знаком
    // (groundMs 4, topMs 26.2). Проверено мутацией — убрал округление, набор
    // остался ЗЕЛЁНЫМ. Две цифры точности приходят только с ЖИВЫМ METAR, то
    // есть ровно там, куда тест не достаёт.
    //
    // Поэтому здесь проверяется наличие округления в исходнике. Это слабее
    // проверки поведения, и потому сказано вслух.
    const src = readFileSync(
      path.join(__dirname, "..", "src", "routes", "qskyway.ts"),
      "utf8",
    );
    for (const field of ["groundMs", "topMs"]) {
      expect(
        src.includes(field + ": +windAt(") || src.includes(field + ": +"),
        `у ${field} пропало округление: с живым METAR на экран вернутся две цифры `
          + "точности у величины, верхняя часть которой смоделирована",
      ).toBe(true);
    }
  });
});
