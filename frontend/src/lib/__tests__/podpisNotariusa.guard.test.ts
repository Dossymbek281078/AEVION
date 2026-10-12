import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { podpisNotariusaTekst } from "../podpisNotariusa";

/**
 * 🔴 ДЕМО-ПОДПИСЬ НАЗВАНА СВОИМ ИМЕНЕМ ТАМ, ГДЕ ЕЁ ВИДИТ ПОКУПАТЕЛЬ.
 *
 * До 12.10.2026 значок NOTARIZED выглядел одинаково для Ed25519 и для
 * demo-hmac-sha256 — а на проде ВСЕ подписи были демонстрационными. Бюро
 * продаётся за доказуемость; молчать об этом на витрине нельзя.
 */
describe("строка о подписи нотариуса", () => {
  it("🔴 четыре исхода — знаменатель 4 из 4", () => {
    const ок = podpisNotariusaTekst({ ok: true, keyId: "0123456789abcdef", algorithm: "ed25519" });
    expect(ок.тон).toBe("ok");
    expect(ок.текст).toContain("проверена");
    expect(ок.текст).toContain("0123456789abcdef");
    const демо = podpisNotariusaTekst({ ok: false, reason: "demo-signature" });
    expect(демо.тон).toBe("demo");
    expect(демо.текст).toContain("Демо-подпись");
    expect(демо.текст).toContain("доказательством не является");
    const чужой = podpisNotariusaTekst({ ok: false, reason: "key-mismatch" });
    expect(чужой.тон).toBe("warn");
    expect(чужой.текст).toContain("другим ключом");
    const нет = podpisNotariusaTekst(null);
    expect(нет.тон).toBe("warn");
    expect(нет.текст).toContain("недоступна");
    // Контроль: демо никогда не выглядит как «ok».
    expect(podpisNotariusaTekst({ ok: false, reason: "demo-signature" }).тон).not.toBe("ok");
  });

  it("🔴 страница сертификата показывает строку только нотаризованным и спрашивает ручку проверки", () => {
    const стр = readFileSync(join(process.cwd(), "src/app/bureau/cert/[certId]/page.tsx"), "utf8");
    expect(стр).toContain('data.verificationLevel === "notarized" ? podpisNotariusaTekst(await loadNotarization(certId)) : null');
    expect(стр).toContain("/notarization/verify");
    expect(стр).toContain("{подпись && (");
    expect(стр).toContain("data-bureau-signature={подпись.тон}");
  });
});
