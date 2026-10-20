/**
 * Ссылка ?country=/ ?artifact= не перетирается черновиком из localStorage.
 *
 * ПОВОД (20.10.2026, путь гостя на проде, put-onboarding.mjs): онбординг → «США» →
 * «Открыть редактор» → /constitution?country=us показывал ползунки по умолчанию (30/50/20)
 * и «Поздний феодализм» вместо пресета США (35/65/25): черновик по умолчанию, записанный
 * первым заходом до /welcome, восстанавливался эффектом, объявленным ПОСЛЕ эффекта ссылки.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { countryByCode, DEFAULT_SLIDERS } from "@/lib/constitution";

const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("constitution: ссылка на страну сильнее черновика", () => {
  it("эффект черновика выходит при ?country/?artifact ДО чтения localStorage", () => {
    const i = SRC.indexOf("window.localStorage.getItem(STORAGE_KEY)");
    expect(i, "чтение черновика не найдено — сторож смотрел бы в пустоту").toBeGreaterThan(0);
    const до = SRC.slice(Math.max(0, i - 900), i);
    expect(до).toMatch(/if \(sp\.has\("country"\) \|\| sp\.has\("artifact"\)\) return;/);
  });

  it("КОНТРОЛЬ: пресет США отличается от значений по умолчанию (иначе дефект не виден)", () => {
    const us = countryByCode("us")!;
    expect(us).toBeTruthy();
    expect({ ...DEFAULT_SLIDERS, ...us.sliders }).not.toEqual(DEFAULT_SLIDERS);
  });
});
