import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 153 (18.10.2026). Оркестратор в настоящем Chrome 1463×746 на /cyberchess/p/li_0gUUz: буквы под доской на x = −39…460
 * при доске с x≈236 — «a» за краем, под a1 подписано «c», под g/h пусто. Причина: подпись вертикали имела класс `f`,
 * а боковая ссылка — тоже `.f`; при ширине ≥1024 правило `.hdr,.z,.s,.hb,.of,.zm,.r,.f{grid-column:2;width:290px}`
 * (≥1280 — 360px) давало букве ширину колонки, и она уезжала влево от своей клетки. Цифры рядов (класс `r`) прятал
 * блок результата `.r{display:none}` — на проде ВСЕ 8 цифр были невидимы на всех 7 окнах (прибор 153-priemka-bukvy.cjs,
 * база 18.10: 21 из 21 негодны). Подписи переименованы в `kf`/`kr`; этот сторож не даёт классу подписи совпасть
 * с любым одиночным классом боковой колонки или любого другого правила страницы.
 */
const ROUTE = readFileSync(join(__dirname, "..", "[id]", "route.ts"), "utf8");
const KLIENT = readFileSync(join(__dirname, "..", "klientSkript.ts"), "utf8");

function классыПодписей(src: string): string[] {
  return [...src.matchAll(/<i class=\\?"c (\w+)\\?">/g)].map((m) => m[1]);
}

/** Все одиночные классы, к которым CSS страницы обращается без привязки к доске (`.X{`, `.X,`, `,.X{`), кроме `.b i.X`. */
function одиночныеКлассыCSS(css: string): Set<string> {
  const out = new Set<string>();
  for (const m of css.matchAll(/(^|[\s,{}])\.([a-zA-Z][\w-]*)(?=[,{\s:])/g)) out.add(m[2]);
  return out;
}

describe("153: подписи клеток на /cyberchess/p не делят класс с боковыми блоками", () => {
  test("🔴 сервер и клиент рисуют подписи одними классами, и это kf/kr", () => {
    expect(классыПодписей(ROUTE)).toEqual(["kf", "kr"]);
    expect(классыПодписей(KLIENT)).toEqual(["kf", "kr"]);
  });

  test("🔴 ни один класс подписи не встречается в CSS страницы как одиночный селектор вне `.b i.`", () => {
    const css = ROUTE.slice(ROUTE.indexOf("<style>"), ROUTE.indexOf("</style>"));
    expect(css.length).toBeGreaterThan(1000);
    const безДоски = css.replace(/\.b i\.(kf|kr)\b/g, "");
    const одиночные = одиночныеКлассыCSS(безДоски);
    // контроль прибора: боковые классы видны, а старые имена подписей в этом списке есть — значит столкновение он различает
    expect(одиночные.has("f")).toBe(true);
    expect(одиночные.has("r")).toBe(true);
    for (const k of классыПодписей(ROUTE)) expect(одиночные.has(k), `класс подписи «${k}» задет чужим правилом`).toBe(false);
  });

  test("🔴 правила положения подписей привязаны к новым классам", () => {
    expect(ROUTE).toContain(".b i.kf{right:4%;bottom:3%}");
    expect(ROUTE).toContain(".b i.kr{left:5%;top:4%}");
  });
});
