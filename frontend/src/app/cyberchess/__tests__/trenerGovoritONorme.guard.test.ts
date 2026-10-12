import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { soobschenieONorme, ССЫЛКА_НА_ТАРИФ_ШАХМАТ } from "../normaTrenera";

/*
 * 🔴 402 от тренера — это слова о норме и ссылка на тариф, а не ответ движка.
 *
 * Повод 13.10.2026: спящая норма FREE_COACH_PER_DAY (бэкенд, coachNorma.ts).
 * Любой не-ok от /api/coach/chat уходил в общий catch и подменялся ответом
 * Stockfish — отказ был невидим. Половины: текст (настоящий вызов) и место на
 * странице (по исходнику: ветка 402 стоит ДО общего «не ok → throw» в блоке
 * запроса к /api/coach/chat и кладёт сообщение в чат).
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("тренер говорит о норме", () => {
  it("текст: сообщение сервера, ссылка на тариф с origin, без выдуманного хода", () => {
    const т = soobschenieONorme({ message: "Норма 3 в день исчерпана.", upgradeUrl: "/pricing?app=cyberchess", limit: 3 }, "https://aevion.app");
    expect(т).toContain("Норма 3 в день исчерпана.");
    expect(т).toContain("https://aevion.app/pricing?app=cyberchess");
    expect(т).not.toMatch(/Stockfish|лучший ход/);
  });

  it("пустое или чужое тело — запасной текст и штатная ссылка; внешний адрес из тела не берём", () => {
    const т = soobschenieONorme(null, "https://aevion.app");
    expect(т).toContain("Бесплатная норма тренера на сегодня исчерпана.");
    expect(т).toContain("https://aevion.app" + ССЫЛКА_НА_ТАРИФ_ШАХМАТ);
    const чужой = soobschenieONorme({ upgradeUrl: "https://evil.example/pay" }, "https://aevion.app");
    expect(чужой).not.toContain("evil.example");
    expect(чужой).toContain(ССЫЛКА_НА_ТАРИФ_ШАХМАТ);
  });

  it("🔴 на странице ветка 402 стоит в запросе к /api/coach/chat ДО общего отказа и кладёт сообщение в чат", () => {
    const запрос = СТРАНИЦА.indexOf("fetch(`${BACKEND}/api/coach/chat`,");
    expect(запрос).toBeGreaterThan(-1);
    const кусок = СТРАНИЦА.slice(запрос, запрос + 2500);
    const ветка = кусок.indexOf("if(res.status===402){");
    const общий = кусок.indexOf("if(!res.ok){");
    expect(ветка, "ветка 402 есть").toBeGreaterThan(-1);
    expect(общий, "общий отказ есть").toBeGreaterThan(-1);
    expect(ветка, "402 разбирается раньше общего throw").toBeLessThan(общий);
    const телоВетки = кусок.slice(ветка, общий);
    expect(телоВетки).toContain("soobschenieONorme(");
    expect(телоВетки).toContain("sCoachChat(");
    expect(телоВетки, "после сообщения — выход, не продолжение к throw").toContain("return;");
  });

  it("ровно одна точка разбора 402 у тренера (стрим при не-ok сам падает на обычный /chat)", () => {
    expect(СТРАНИЦА.split("res.status===402").length - 1).toBe(1);
    expect(СТРАНИЦА.split("soobschenieONorme(").length - 1).toBe(1);
  });
});
