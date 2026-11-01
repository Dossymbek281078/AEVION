import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translations } from "@/lib/i18n-all";

/**
 * 01.11.2026: доступ к CyberChess привязан к почте входа. Гость, заплативший другой почтой,
 * рискует остаться без доступа — рядом с кнопкой покупки (гостю, не вошедшему) стоит одна строка
 * на трёх языках. Вошедшему её не показываем: касса уже знает его аккаунт (custom_data.accountEmail).
 */
const страница = readFileSync(join(process.cwd(), "src/app/pricing/page.tsx"), "utf8");
const KEY = "pricing.home.payEmailHint";
const ТЕКСТ: Record<string, string> = {
  ru: "Платите той же почтой, с которой войдёте в AEVION — по ней откроется доступ.",
  en: "Pay with the same email you'll sign in to AEVION with — access is tied to it.",
  kk: "AEVION-ға кіретін поштамен төлеңіз — қолжетімділік соған ашылады.",
};

describe("/pricing: строка про почту оплаты у кнопки CyberChess", () => {
  test.each(Object.keys(ТЕКСТ))("язык %s: текст из задачи лежит в словаре", (L) => {
    const d = (translations as Record<string, Record<string, string>>)[L];
    expect(d?.[KEY], `${L}: ключ ${KEY}`).toBe(ТЕКСТ[L]);
  });
  test("на ru/en в строке нет чужого алфавита (kk — кириллица, en — латиница)", () => {
    expect(ТЕКСТ.en).not.toMatch(/[\u0400-\u04FF]/);
    expect(ТЕКСТ.ru).not.toMatch(/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/);
  });
  test("обе кнопки CyberChess (верхняя и в «Отдельных приложениях») сопровождены строкой только для гостя", () => {
    const куски = страница.split('data-testid="pay-email-hint"');
    expect(куски.length - 1, "ожидаем два места").toBe(2);
    for (let i = 0; i < 2; i++) {
      const до = куски[i].slice(-260);
      expect(до, "условие: гость и cyberchess").toMatch(/!вошёл\s*&&\s*(app|a)\.slug === "cyberchess"/);
    }
    expect(страница).toContain('t("pricing.home.payEmailHint")');
  });
});
