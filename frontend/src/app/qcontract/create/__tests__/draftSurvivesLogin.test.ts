/*
 * Гость, заполнивший документ, после входа возвращается к форме со своим
 * черновиком. Замер прода 12.10.2026 (окно Приложения-31.12): было «Войдите
 * на /auth» простым текстом, набранное пропадало (draft.ts).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ЧЕРНОВИК, ВХОД_С_ВОЗВРАТОМ } from "../draft";
import { адресВозврата } from "../../../auth/returnTo";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"), "utf8");

describe("QContract: черновик переживает вход", () => {
  it("ссылка входа возвращает именно на форму", () => {
    expect(адресВозврата(new URL(ВХОД_С_ВОЗВРАТОМ, "https://aevion.app").search)).toBe("/qcontract/create");
    expect(SRC).toContain("href={ВХОД_С_ВОЗВРАТОМ}");
  });

  it("без входа черновик сохраняется ДО выхода из обработчика", () => {
    const ветка = SRC.slice(SRC.indexOf("if (!token) {"), SRC.indexOf("setНуженВход(false);"));
    expect(ветка).toMatch(/sessionStorage\.setItem\(ЧЕРНОВИК/);
    expect(ветка.indexOf("sessionStorage.setItem")).toBeLessThan(ветка.indexOf("return;"));
  });

  it("пароль документа в черновик НЕ попадает", () => {
    const запись = /sessionStorage\.setItem\(ЧЕРНОВИК, JSON\.stringify\(\{([^}]*)\}\)\)/.exec(SRC);
    expect(запись, "запись черновика не найдена — сторож ослеп").toBeTruthy();
    expect(запись![1]).not.toMatch(/password/i);
  });

  it("при открытии формы черновик восстанавливается и стирается", () => {
    expect(SRC).toMatch(/sessionStorage\.getItem\(ЧЕРНОВИК\)/);
    expect(SRC).toMatch(/sessionStorage\.removeItem\(ЧЕРНОВИК\)/);
    expect(ЧЕРНОВИК).toMatch(/^qcontract\./);
  });
});
