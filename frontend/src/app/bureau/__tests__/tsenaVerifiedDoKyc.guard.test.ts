import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ценаVerifiedДляВитрины, ценаСПериодом } from "../verifiedPrice";

/*
 * 🔴 Цена Verified на /bureau не показывается, пока проверка личности не живая.
 *
 * Решение оркестратора 13.10.2026 (заглушка KYC одобряет любого — тариф не
 * продаётся до KYC). Две поверхности страницы — абзац и карточка тарифа —
 * печатают одно и то же через одну функцию; «не знаю» (health не ответил)
 * равносильно «не живой»: своя неосведомлённость не обещает.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/bureau/page.tsx"), "utf8");

describe("цена Verified до KYC", () => {
  it("🔴 живой KYC — цена; заглушка и «не знаю» — ожидание, не цена", () => {
    expect(ценаVerifiedДляВитрины("live", "en", 2900)).toBe("$29/month");
    expect(ценаVerifiedДляВитрины("stub", "en", 2900)).toBe("price appears after identity verification");
    expect(ценаVerifiedДляВитрины(null, "en", 2900)).toBe("price appears after identity verification");
    expect(ценаVerifiedДляВитрины("stub", "ru", 2900)).toBe("цена появится после проверки личности");
    // 30.10.2026: kk получал английское ожидание — теперь свой язык
    expect(ценаVerifiedДляВитрины("stub", "kk", 2900)).toBe("жеке басын тексергеннен кейін баға шығады");
    expect(ценаVerifiedДляВитрины(null, "kk", 2900)).not.toMatch(/[A-Za-z]/);
    // ни в одном «не живом» исходе нет знака доллара
    for (const m of ["stub", null] as const) for (const l of ["ru", "en", "kk"]) expect(ценаVerifiedДляВитрины(m, l, 2900)).not.toContain("$");
  });

  it("живая цена берёт центы с сервера, как и раньше", () => {
    expect(ценаVerifiedДляВитрины("live", "ru", 3200)).toBe(ценаСПериодом(3200, "ru"));
    expect(ценаVerifiedДляВитрины("live", "ru", undefined)).toBe(ценаСПериодом(undefined, "ru"));
    expect(ценаVerifiedДляВитрины("live", "en", 3200)).toBe("$32/month");
  });

  it("🔴 страница печатает цену только через эту функцию — в обоих местах", () => {
    expect(СТРАНИЦА.split("ценаVerifiedДляВитрины(").length - 1, "абзац + карточка").toBe(3 - 1 + 1); // импорт не считается: это вызовы с «(»
    expect(СТРАНИЦА).not.toContain("ценаТекстом(");
    expect(СТРАНИЦА).not.toContain("ценаСПериодом(");
    expect(СТРАНИЦА).toContain("price: ценаVerifiedДляВитрины(kycMode, buLang,");
  });

  it("абзац есть на русском и на английском и переключается по языку читателя", () => {
    expect(СТРАНИЦА).toContain("Анонимные сертификаты полностью защищены криптографически");
    expect(СТРАНИЦА).toContain("Anonymous certificates are fully cryptographically protected");
    const i = СТРАНИЦА.indexOf("Анонимные сертификаты полностью защищены");
    expect(СТРАНИЦА.slice(Math.max(0, i - 200), i)).toContain('buLang === "ru"');
  });
});
