import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * По устаревшей ссылке страница турнира делала заголовок ИЗ АДРЕСА:
 * /cyberchess/tournaments/net-takogo-turnira превращалось в
 * «🏆 Net Takogo Turnira» — правдоподобный турнир, которого нет. Рядом
 * стояла строка «Бэкенд недоступен (tournament HTTP 404). Показываем
 * sample data, если оно есть» — три внутренних слова подряд на публичной
 * странице.
 *
 * Замер 02.09.2026 браузером: страница отвечала 200 и показывала обе вещи.
 */

const КОД = () => bezKommentariev(
  readFileSync(join(__dirname, "..", "tournaments", "[id]", "page.tsx"), "utf8"));

describe("страница турнира по неверной ссылке", () => {
  it("не выдаёт адрес за название турнира", () => {
    const код = КОД();
    expect(код).toContain("turnirNeNayden");
    // заголовок обязан спрашивать признак, а не печатать догадку из адреса
    const i = код.indexOf("<h1");
    expect(i).toBeGreaterThan(0);
    const шапка = код.slice(i, i + 220);
    expect(шапка).toContain("turnirNeNayden");
  });

  it("говорит по-человечески, без «бэкенда» и «sample data»", () => {
    const код = КОД();
    for (const слово of ["Бэкенд недоступен", "sample data"]) {
      expect(код, `«${слово}» видно человеку`).not.toContain(слово);
    }
    expect(код).toContain("ссылка устарела");
  });

  it("контроль прибора: вырезалка комментариев не съедает разметку", () => {
    expect(bezKommentariev('const a = <h1>{x}</h1>; // тут был sample data'))
      .toContain("<h1>");
    expect(bezKommentariev('const a = 1; // тут был sample data'))
      .not.toContain("sample data");
  });
});
