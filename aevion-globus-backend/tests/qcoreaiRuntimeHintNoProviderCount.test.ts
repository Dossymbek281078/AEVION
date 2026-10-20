/**
 * Подсказка QCoreAI в реестре (видна на главной) не называет числа поставщиков.
 * 20.10.2026: «16 провайдеров, anthropic активен» — в реестре 16, с ключами 4, активен не только anthropic.
 */
import { describe, it, expect } from "vitest";
import { MODULE_RUNTIME } from "../src/data/moduleRuntime";

describe("moduleRuntime.qcoreai.hint", () => {
  it("без числа поставщиков и без «активен только X»", () => {
    const h = MODULE_RUNTIME.qcoreai.hint;
    expect(h).not.toMatch(/\d+\s*провайдер/);
    expect(h).not.toMatch(/активен/);
  });
});
