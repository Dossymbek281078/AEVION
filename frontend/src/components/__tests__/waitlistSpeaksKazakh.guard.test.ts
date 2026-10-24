import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 24.10.2026, прод /kk/cyberchess: подвал «Не готовы сегодня — оставьте адрес»,
// «Адрес электронной почты» — по-русски. WaitlistCapture знал только ru/en, а
// подвал выбирал «en или русский»: kk падал на русский на каждой странице.
const CAP = readFileSync(join(__dirname, "..", "WaitlistCapture.tsx"), "utf8");
const FOOT = readFileSync(join(__dirname, "..", "FooterWaitlist.tsx"), "utf8");

describe("лист ожидания говорит по-казахски", () => {
  test("у WaitlistCapture есть свой kk и язык kk выбирается", () => {
    expect(CAP).toMatch(/\n  kk: \{\n    title: "/);
    expect(CAP).toContain('i18n?.lang === "kk" ? "kk"');
    // знаменатель: тот же набор полей, что у ru
    const поля = (блок: string) => [...блок.matchAll(/^    (\w+):/gm)].map((m) => m[1]);
    const ru = CAP.slice(CAP.indexOf("  ru: {"), CAP.indexOf("  en: {"));
    const kk = CAP.slice(CAP.indexOf("  kk: {"), CAP.indexOf("} as const;"));
    expect(поля(ru).length).toBeGreaterThan(8);
    expect(поля(kk)).toEqual(поля(ru));
  });
  test("подвал больше не выбирает «en или русский»", () => {
    expect(FOOT).not.toMatch(/язык === "en" \? "[^"]+" : "[А-Яа-я]/);
    expect(FOOT).toContain("Бүгін дайын емессіз бе");
  });
});
