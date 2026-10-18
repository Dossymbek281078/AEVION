import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 159 (18.10.2026). Прибор полного пути (156) на проде: клик по «Опишите проект — покажу бесплатный разбор»
 * в первую секунду после загрузки терял мастер на 2 окнах из 5 (390×844, 1024×900); с паузой 2 с — 5/5.
 * Причина — клик до гидратации: у кнопки ещё нет обработчика React. Правка: встроенный скрипт в HTML сервера
 * ловит клик по [data-se-wizard] на фазе захвата и ставит флаг; после монтирования эффект открывает мастер.
 * Здесь — связность трёх частей (атрибут, скрипт, эффект) и то, что сам скрипт исполняется в jsdom как написан.
 * Приёмка кликом в первые 300 мс на проде — 156-polnyj-put.cjs (режим «быстрый клик»).
 */
const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

function текстСкрипта(): string {
  const m = /__html:\s*\n?\s*"((?:[^"\\]|\\.)*)"/.exec(src.slice(src.indexOf("159: очередь клика")));
  if (!m) throw new Error("встроенный скрипт 159 не найден");
  return JSON.parse(`"${m[1]}"`);
}

describe("159: клик по «Опишите проект» до гидратации не теряется", () => {
  test("🔴 кнопка помечена data-se-wizard, и это та кнопка, что открывает мастер", () => {
    const i = src.indexOf("data-se-wizard\n");
    expect(i).toBeGreaterThan(0);
    expect(src.slice(i, i + 120)).toContain("onClick={() => setShowWizard(true)}");
  });

  test("🔴 встроенный скрипт ставит флаг по клику на [data-se-wizard] — исполняем его в jsdom", () => {
    const js = текстСкрипта();
    expect(js).toContain("[data-se-wizard]");
    expect(js).toContain("__seWizardQueued=1");
    document.body.innerHTML = '<button data-se-wizard><span>Опишите проект</span></button><button id="other">x</button>';
    const w = window as unknown as { __seWizardQueued?: number };
    w.__seWizardQueued = 0;
    // eslint-disable-next-line no-new-func
    new Function(js)();
    (document.querySelector("#other") as HTMLElement).click();
    expect(w.__seWizardQueued, "чужая кнопка не должна ставить флаг").toBe(0);
    (document.querySelector("[data-se-wizard] span") as HTMLElement).click();
    expect(w.__seWizardQueued, "клик по вложенному элементу кнопки должен ставить флаг").toBe(1);
  });

  test("🔴 после монтирования эффект читает флаг и открывает мастер, сбрасывая флаг", () => {
    const i = src.indexOf("if (w.__seWizardQueued) {");
    expect(i).toBeGreaterThan(0);
    const тело = src.slice(i, i + 160);
    expect(тело).toContain("w.__seWizardQueued = 0;");
    expect(тело).toContain("setShowWizard(true);");
    // эффект без зависимостей — исполняется один раз при монтировании
    expect(src.slice(i, i + 220)).toMatch(/\}\s*\n\s*\}, \[\]\);/);
  });
});
