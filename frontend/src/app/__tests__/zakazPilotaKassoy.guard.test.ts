import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Оплата пилота $490 с /proof идёт обычным путём кассы (волна 129б, 13.10.2026):
 * кнопка считает checkout_start с товаром и каналом, ссылку даёт наш бэкенд
 * (/api/proof/pilot-checkout), отказ назван словами и говорит «ничего не списано»;
 * страница успеха для ref=pilot_490 обещает ровно то, что /proof: письмо в течение 24 часов.
 */
const КНОПКА = readFileSync(join(process.cwd(), "src/components/PilotPayButton.tsx"), "utf8");
const БЛОК = readFileSync(join(process.cwd(), "src/components/ProofPilotBlock.tsx"), "utf8");
const УСПЕХ = readFileSync(join(process.cwd(), "src/app/pricing/checkout/success/page.tsx"), "utf8");

describe("оплата пилота через кассу", () => {
  it("🔴 кнопка: checkout_start с товаром pilot_490 и каналом, ссылка от /api/proof/pilot-checkout, переход на кассу", () => {
    expect(КНОПКА).toContain('apiUrl("/api/proof/pilot-checkout")');
    expect(КНОПКА).toContain('type: "checkout_start"');
    expect(КНОПКА).toContain("product: PILOT_FEATURE");
    expect(КНОПКА).toMatch(/\.\.\.\(channel \? \{ channel \} : \{\}\)/);
    expect(КНОПКА).toContain("window.location.href = body.url");
    expect(КНОПКА).toContain("Pay $${PILOT_USD} now");
  });

  it("отказ кассы назван словами и говорит, что ничего не списано", () => {
    expect(КНОПКА).toContain("Nothing was charged");
    expect(КНОПКА).toContain("Network error — nothing was charged");
    expect(КНОПКА).toContain("within 24 hours");
  });

  it("🔴 блок пилота: кнопка оплаты стоит перед формой, «ничего не списывается» сказано про форму, а не про страницу", () => {
    expect(БЛОК).toContain("<PilotPayButton />");
    expect(БЛОК.indexOf("<PilotPayButton />")).toBeLessThan(БЛОК.indexOf("<PilotOrderForm />"));
    expect(БЛОК).not.toContain("Nothing is charged on this page");
    expect(БЛОК).toContain("Nothing is charged by the request form");
  });

  it("🔴 страница успеха: ветка ref=pilot_490 обещает письмо в течение 24 часов", () => {
    expect(УСПЕХ).toContain('sp.get("ref") === "pilot_490"');
    expect(УСПЕХ).toContain("We email you within 24 hours to agree the scope");
    expect(УСПЕХ).toContain("Payment received — thank you");
  });
});
