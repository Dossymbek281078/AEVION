import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Волна 133 (13.10.2026). Тост после публикации обещал «свой адрес на aevion.app появится через
 * несколько минут» — замер: через 13 минут 404 (зона под *.aevion.app не подключена). Правило 0-ДЕНЬГИ п.3:
 * нет обещаний, которых продукт не выполняет. Теперь тост зовёт оставить почту с тем же сроком, что и
 * карточка «Keep my site» («в течение суток»), во всех трёх словарях.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/devhub/[id]/page.tsx"), "utf8");
const МИНУТЫ = /minute|минут|минөт/i;

describe("тост после публикации не обещает адрес «через несколько минут»", () => {
  it("🔴 три словаря: domainSoon без слова «минут», срок — сутки, зовёт оставить почту", () => {
    const значения = [...СТРАНИЦА.matchAll(/domainSoon: "([^"]+)"/g)].map((m) => m[1]);
    expect(значения, "ru/en/kk").toHaveLength(3);
    for (const v of значения) expect(v, v).not.toMatch(МИНУТЫ);
    expect(значения[0]).toContain("в течение суток");
    expect(значения[1]).toContain("within a day");
    expect(значения[1]).toContain("Leave your email below");
    expect(значения[2]).toContain("бір тәулік");
    // Та же формулировка срока, что в карточке «Keep my site».
    const saveDone = [...СТРАНИЦА.matchAll(/saveDone: "([^"]+)"/g)].map((m) => m[1]);
    expect(saveDone[1]).toContain("within a day");
  });

  it("тост составляется как «адрес. обещание», обещание берётся из словаря", () => {
    expect(СТРАНИЦА).toContain("`${GL.siteLive}: ${d.liveUrl ?? d.pagesUrl}. ${GL.domainSoon}`");
    expect(СТРАНИЦА).not.toContain("will appear in a few minutes");
    expect(СТРАНИЦА).not.toContain("появится через несколько минут");
  });
});
