import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Пометка «расход не сверили» доезжает до экрана.
 *
 * Проверка кредита падает ОТКРЫТО: если расход прочитать не удалось, трату
 * разрешают, чтобы не блокировать платящего из-за икоты базы, и помечают
 * ответ полем creditUnverified. Решение защитимое — но только пока человеку
 * об этом говорят.
 *
 * Замер 29.08.2026: сервер ставил пометку на двух платных ручках, витрина не
 * читала её НИ РАЗУ. Правда доезжала до границы API и умирала там.
 */
const WS = path.join(__dirname, "..", "[id]", "page.tsx");

describe("несверенный расход виден человеку", () => {
  it("витрина читает пометку и показывает предупреждение", () => {
    const src = fs.readFileSync(WS, "utf8");
    // Контроль прибора: файл должен быть тем самым и прочитаться целиком.
    expect(src.length, "файл рабочего окна не прочитался").toBeGreaterThan(10000);

    const reads = src.split("creditUnverified").length - 1;
    expect(reads, "витрина не читает пометку о несверенном расходе").toBeGreaterThan(1);

    // И не молча: рядом обязан быть показ человеку.
    const idx = src.indexOf("creditUnverified");
    const around = src.slice(idx, idx + 600);
    expect(around, "пометка прочитана, но человеку ничего не сказано").toContain("showToast");
  });
});
