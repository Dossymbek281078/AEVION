import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Путь гостя Мультичата: остаток честный, стена — словами.
 *
 * Замер 13.10.2026 (прод bede7bfd2, Playwright 390×844, свежий контекст):
 * первый вопрос — ответ трёх агентов за 4 с; после него страница продолжала
 * писать «осталось 2 запроса» (остаток спрашивался только при монтировании);
 * второй вопрос упёрся в модульную стену, и на экране печаталось голое
 * «upgrade_required»; кнопка «Спросить консилиум» стояла на y=832 при
 * высоте 39 — за кадром 844.
 *
 * Сторож по исходнику (компонент тянет fetch, устройство и вход; поднимать его
 * ради трёх свойств дороже пользы) — проверяет расположение, не доставку.
 */
const ИСХОДНИК = readFileSync(join(process.cwd(), "src/app/multichat-engine/CouncilConsole.tsx"), "utf8");

describe("гость Мультичата видит остаток и стену словами", () => {
  it("🔴 остаток пересчитывается после каждого вопроса: finally увеличивает пересчёт, эффект зависит от него", () => {
    const ask = ИСХОДНИК.slice(ИСХОДНИК.indexOf("async function ask()"), ИСХОДНИК.indexOf("async function runExample")); // граница — следующая функция, не 3000 символов (21.10: комментарий сдвинул finally на 3056)
    const finallyI = ask.indexOf("} finally {");
    expect(finallyI).toBeGreaterThan(-1);
    expect(ask.slice(finallyI, finallyI + 200)).toContain("setПересчёт((n) => n + 1)");
    expect(ИСХОДНИК).toContain("}, [authed, пересчёт]);");
  });

  it("🔴 код стены upgrade_required не печатается человеку — вместо него текст", () => {
    const i = ИСХОДНИК.indexOf('conv?.error === "upgrade_required"');
    expect(i).toBeGreaterThan(-1);
    // ровно первый оператор после условия — до точки с запятой; дальше идёт общий throw с кодом
    const строка = ИСХОДНИК.slice(i, ИСХОДНИК.indexOf(";", i) + 1);
    expect(строка).toContain("throw new Error(");
    expect(строка).toMatch(/[а-я]{5}/);
    expect(строка).not.toMatch(/Error\(conv\?\.error/);
    // и общий throw с кодом стоит ПОСЛЕ человеческого, а не вместо него
    expect(ИСХОДНИК.indexOf('throw new Error(conv?.error || "не удалось создать беседу")')).toBeGreaterThan(i);
  });

  it("поле в две строки и ряд кнопки прижат — «Спросить консилиум» в кадре 390×844", () => {
    expect(ИСХОДНИК).toContain("rows={2}");
    expect(ИСХОДНИК).not.toContain("rows={3}");
    // замер 13.10: с rows=2 и marginTop 10 низ кнопки был 848 > 844; отступ 4 и кнопка 7px — в кадре
    const ряд = ИСХОДНИК.indexOf('alignItems: "center", gap: 12, marginTop: 4 }}>');
    expect(ряд, "ряд кнопок с отступом 4").toBeGreaterThan(-1);
    expect(ИСХОДНИК.slice(ряд, ряд + 500)).toContain('padding: "7px 18px"');
  });
  it("🔴 124: первое действие гостя считается — вопрос и пример шлют feature_use в воронку (ступень «попробовали»)", () => {
    // повод: 14 дн., youtube|/multichat-engine — 15 живых сессий, внимание 6, попробовали 0: страница не слала событий вовсе
    expect(ИСХОДНИК).toContain('import { track } from "@/lib/track";');
    const ask = ИСХОДНИК.slice(ИСХОДНИК.indexOf("async function ask()"), ИСХОДНИК.indexOf("async function runExample()"));
    expect(ask).toContain('feature: "council_ask"');
    expect(ask.indexOf("track({")).toBeLessThan(ask.indexOf("await fetch("));
    const ex = ИСХОДНИК.slice(ИСХОДНИК.indexOf("async function runExample()"));
    expect(ex).toContain('feature: "council_example"');
    expect((ИСХОДНИК.match(/type: "feature_use"/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
