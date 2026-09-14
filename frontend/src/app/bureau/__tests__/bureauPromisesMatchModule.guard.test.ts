import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Метаданные бюро не обещают того, что модуль сам называет демо.
 *
 * 14.09.2026 превью, описание и разметка для Google обещали «verified creators»,
 * «notarized certificates» и «KYC + payment + Planet quorum stamp every
 * certificate», а `/api/bureau/health` в ту же минуту отвечал `kyc: "stub"`,
 * `notarySignature: "demo"`. По слову основателя поставлен честный текст.
 * Этот сторож не даёт обещанию вернуться молча.
 *
 * Если проверка личности и нотариальная подпись станут настоящими — сторожа
 * надо пересмотреть осознанно, а не обходить.
 */
const ОБЕЩАНИЯ = /verified|notarized|kyc|b2b verification/i;

describe("метаданные бюро не обещают демо-возможности как готовые", () => {
  it("прибор исправен: находит обещание в образце и молчит на честном тексте", () => {
    expect(ОБЕЩАНИЯ.test("Verified creators, notarized certificates")).toBe(true);
    expect(ОБЕЩАНИЯ.test("Public registry of creators. Identity checks are in demo mode.")).toBe(false);
  });

  it("в метаданных и JSON-LD бюро нет verified / notarized / KYC", () => {
    const src = readFileSync(join(process.cwd(), "src/app/bureau/layout.tsx"), "utf8");
    expect(src.length, "файл метаданных бюро прочитан пустым — проверка слепа").toBeGreaterThan(500);
    const строки = src.split("\n").filter((l) => ОБЕЩАНИЯ.test(l) && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(строки, "обещание вернулось в метаданные бюро").toEqual([]);
  });
});
