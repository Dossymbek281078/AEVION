import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Заказ пилота $490 с /proof идёт формой на наш бэкенд, а не только mailto.
 * Повод 13.10.2026: единственный путь был mailto (тупик без почтового клиента), кнопка
 * на 4096 px на телефоне, 0 нажатий за 14 дн. Форма: почта, объём, срок, строка о данных,
 * honeypot; событие pilot_490; отказ назван словами; mailto — запасной путь под формой;
 * дубль кнопки заказа в первом экране.
 */
const ФОРМА = readFileSync(join(process.cwd(), "src/components/PilotOrderForm.tsx"), "utf8");
const БЛОК = readFileSync(join(process.cwd(), "src/components/ProofPilotBlock.tsx"), "utf8");
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/proof/page.tsx"), "utf8");

describe("заказ пилота формой", () => {
  it("🔴 форма шлёт POST на /api/proof/pilot-order с полями и honeypot, считает pilot_490", () => {
    expect(ФОРМА).toContain('apiUrl("/api/proof/pilot-order")');
    for (const f of ["email", "records", "days", "data", "website", "channel", "post", "path"]) expect(ФОРМА, f).toMatch(new RegExp(`\\b${f}\\b`));
    expect(ФОРМА).toContain('name="website"');
    expect(ФОРМА).toContain('type: "feature_use", source: "proof", meta: { feature: PILOT_FEATURE');
    expect(ФОРМА).toContain("Nothing is charged by this form");
  });

  it("отказы не молчат: сеть, код ошибки и неудача письма — словами в note", () => {
    expect(ФОРМА).toContain("Network error");
    expect(ФОРМА).toContain("Could not send the request");
    expect(ФОРМА).toContain("could not send the confirmation email");
  });

  it("🔴 блок пилота рендерит форму, mailto остаётся запасным под ней", () => {
    expect(БЛОК).toContain("<PilotOrderForm />");
    expect(БЛОК.indexOf("<PilotOrderForm />")).toBeLessThan(БЛОК.indexOf("href={pismoZakaza()}"));
    expect(БЛОК).toContain("Prefer email?");
  });

  it("в первом экране /proof есть дубль кнопки заказа, ведущий к блоку пилота", () => {
    expect(СТРАНИЦА).toContain('data-proof-order-top');
    expect(СТРАНИЦА).toMatch(/data-proof-order-top[^>]*>Order the pilot — \$\{PILOT_USD\}</);
    expect(СТРАНИЦА.indexOf("data-proof-order-top")).toBeLessThan(СТРАНИЦА.indexOf("<ProofPilotBlock />"));
  });
});
