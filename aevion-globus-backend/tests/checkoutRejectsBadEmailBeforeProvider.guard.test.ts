// Неверная почта в теле /api/pricing/checkout/session — 400 ДО вызова кассы.
// Замер прода 30.10.2026: {"tierId":"max","email":"not-an-email"} → 503
// «попробуйте позже»: адрес уходил в Lemon Squeezy без проверки, касса его
// отвергала, и отказ провайдера выглядел как наш сбой. Неверный запрос — 4xx.
// Сторож ИСХОДНИКА: касса зовёт внешнего провайдера, supertest тут не поднять.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./helpers/sourceCode";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = stripComments(readFileSync(join(HERE, "..", "src", "routes", "checkout.ts"), "utf8"));

describe("касса: неверная почта → 400 до провайдера", () => {
  const at = src.indexOf('error: "invalid_email"');
  it("проверка есть и стоит ДО первого createIntent", () => {
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(src.indexOf("createIntent("));
  });
  it("проверяется body.email по той же регулярке, что почта аккаунта; пустая строка не отбивается", () => {
    const окно = src.slice(at - 400, at);
    expect(окно).toContain("typeof body.email === \"string\" && body.email.trim() && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(body.email.trim())");
    expect(окно).toContain("!почтаАккаунта &&");
  });
  it("ответ — 400 с человеческим текстом", () => {
    const окно = src.slice(at, at + 200);
    expect(src.slice(at - 60, at)).toContain("status(400)");
    expect(окно).toContain("Проверьте адрес почты");
  });
});
