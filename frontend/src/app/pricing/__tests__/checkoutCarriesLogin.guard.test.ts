import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 19.10.2026 (замер Продаж): /pricing звал кассу без Authorization и без email —
 * касса не знала аккаунт, подписка привязывалась к адресу, набранному в кассе, а
 * норма снимается по почте из токена. Сторож держит: запрос кассы несёт заголовки
 * входа (getAuthHeaders), и над карточками есть строка про адрес входа.
 */
const страница = readFileSync(join(process.cwd(), "src/app/pricing/page.tsx"), "utf8");

describe("/pricing: касса знает вошедшего", () => {
  test("запрос /api/pricing/checkout/session несёт заголовки входа", () => {
    const i = страница.indexOf('apiUrl("/api/pricing/checkout/session")');
    expect(i, "вызов кассы найден").toBeGreaterThan(0);
    const окно = страница.slice(i, i + 600);
    expect(окно, "headers без getAuthHeaders()").toContain("...getAuthHeaders()");
    expect(страница).toContain('import { getAuthHeaders, isAuthenticated } from "@/lib/auth";');
  });
  test("строка про адрес входа стоит над карточками и зависит от входа", () => {
    expect(страница).toContain('data-testid="pay-with-login-note"');
    expect(страница).toContain('t("pricing.home.tier.accessToAccount")');
    expect(страница).toContain('t("pricing.home.tier.payWithLoginEmail")');
    expect(страница).toContain("setВошёл(isAuthenticated())");
  });
  test("ключи есть в трёх словарях", () => {
    for (const L of ["ru", "en", "kk"]) {
      const d = readFileSync(join(process.cwd(), `src/lib/i18n-lang/${L}.ts`), "utf8");
      expect(d, `${L}: accessToAccount`).toContain('"pricing.home.tier.accessToAccount"');
      expect(d, `${L}: payWithLoginEmail`).toContain('"pricing.home.tier.payWithLoginEmail"');
    }
  });
});
