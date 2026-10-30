// 30.10.2026: цены модулей отменены (слово основателя 19.10) — отдельно продаются только шахматы.
// Вычитка пачки 0111 нашла на /apps: строку «apps bought separately: $<сумма баз>» и кнопку
// срочного модуля, ведущую в /pricing?app=…#apps (раздел одних шахмат), а не к срокам Планеты.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const код = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("/apps продаёт Планету, а не отменённые модули", () => {
  it("нет суммы «по отдельности» в тексте страницы", () => {
    expect(код).not.toMatch(/bought separately: \$\{RACK_RATE\}/);
    expect(код).not.toMatch(/\$\{RACK_RATE\}/);
  });
  it("кнопка срочного модуля ведёт к выбору срока Планеты (#tiers)", () => {
    expect(код).toContain("href={keepChannel(PRICING_TIERS_LIST, channel)}");
    expect(код).not.toContain("href={keepChannel(app.checkoutUrl, channel)}");
  });
});
