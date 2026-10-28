import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 28.10.2026 (окно «Приложения-2»). Баннер /psyapp-deps подписывался «Разблокировать PsyApp Pro», а платного в PsyApp
 * нет ничего: бэкенд psyappDeps.ts не проверяет подписку, касса по этой кнопке продаёт «AEVION Планета — 12 месяцев»
 * (замер на проде 9a21fceb8, put-do-kassy.mjs psyapp-deps, 5 пар окон, Total $150). Подпись — по умолчанию из UpgradeButton.
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("psyapp-deps: кнопка оплаты не обещает несуществующий Pro", () => {
  test("🔴 баннер без своей подписи и без «PsyApp Pro»", () => {
    const s = файл("src/app/psyapp-deps/page.tsx");
    expect(s).toContain('<PaddleUpgradeButton variant="banner" appId="psyapp-deps" />');
    expect(s).not.toMatch(/label="[^"]*PsyApp Pro/);
  });
});
