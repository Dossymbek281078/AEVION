import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Переключатель языка обещает перевод, а словарь покрывает практически
 * только главную: замер 29.08.2026 — 269 обращений на ней и 0 на остальных
 * 21 странице модуля при сотнях русских слов. Человек с английским браузером
 * видел кнопку EN и русский текст, не понимая, сломалось ли что-то.
 *
 * Полоса живёт в МАКЕТЕ, а не в каждой странице: так одна правка покрывает
 * весь модуль, и — важнее — нельзя получить два предупреждения на одной
 * странице, если кто-то добавит своё.
 */
const KOREN = join(__dirname, "..");
const komponent = readFileSync(join(KOREN, "RussianOnlyNotice.tsx"), "utf8");
const maket = readFileSync(join(KOREN, "layout.tsx"), "utf8");
const stranica = readFileSync(join(KOREN, "daily", "page.tsx"), "utf8");

describe("непереведённые страницы честно об этом говорят", () => {
  it("полоса подключена в макете модуля", () => {
    expect(maket).toContain("RussianOnlyNotice");
    expect(maket).toMatch(/<RussianOnlyNotice\s*\/>/);
  });

  it("показывается только при не-русском языке и не на переведённой", () => {
    expect(komponent).toMatch(/ne_ru\s*&&\s*!perevedena/);
    expect(komponent).toContain("Russian only");
  });

  it("язык читается в эффекте, а не при отрисовке", () => {
    const vyzov = komponent.indexOf("loadLocale()");
    expect(vyzov).toBeGreaterThan(0);
    const do_vyzova = komponent.slice(0, vyzov);
    expect(do_vyzova.lastIndexOf("useEffect")).toBeGreaterThan(
      do_vyzova.lastIndexOf("return"),
    );
  });

  it("предупреждение существует в ОДНОМ экземпляре", () => {
    // дубль хуже отсутствия: отсутствие видно как пустота, дубль — как норма
    expect(stranica).not.toContain("Russian only");
  });

  it("текст на языке того, кто его прочтёт", () => {
    const m = komponent.match(/This page is available[^<]*/);
    expect(m).toBeTruthy();
    expect(m![0]).not.toMatch(/[а-яА-Я]/);
  });
});
