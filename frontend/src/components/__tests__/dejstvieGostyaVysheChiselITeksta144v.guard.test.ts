import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 144в (18.10.2026): вторая партия подъёмов первого действия гостя на телефоне. Замер на проде 627d18515
 * (390×844, 144-niže.mjs, кадр 844): psyapp-deps — первое поле онбординга ~1119 (между заголовком и ним полоса
 * чисел сообщества); qfusionai — кнопки стратегии ~1143 (над ними четыре бейджа героя); shadownet — выбор модели
 * угроз ~1457 (над ним полоса чисел); veilnetx — поле почты списка ожидания ~1204 (py-16, абзац и статус выше формы);
 * qcontract после 144б — h1 на 573 (эмодзи 💣 и крупный заголовок), кнопка «Создать» всё ещё за кадром.
 * Порядок в разметке: действие → числа/бейджи/абзац. Пиксели меряет браузер на проде.
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("144в: действие гостя выше чисел, бейджей и абзацев", () => {
  test("🔴 psyapp-deps: полоса чисел сообщества после блока онбординга, а не в герое", () => {
    const s = файл("src/app/psyapp-deps/page.tsx");
    const онбординг = s.indexOf("<Onboarding onStarted={handleStarted} />");
    const числа = s.indexOf("<CommunityStatsRow />");
    expect(онбординг).toBeGreaterThan(0);
    expect(числа).toBeGreaterThan(онбординг);
    expect(s.split("<CommunityStatsRow />").length - 1).toBe(1);
  });
  test("🔴 qfusionai: бейджи героя после площадки FusionPlayground", () => {
    const s = файл("src/app/qfusionai/page.tsx");
    const площадка = s.indexOf("<FusionPlayground onResult={handleResult} />");
    const бейджи = s.indexOf('{ label: "5 провайдеров"');
    expect(площадка).toBeGreaterThan(0);
    expect(бейджи).toBeGreaterThan(площадка);
  });
  test("🔴 shadownet: полоса чисел после секции выбора модели угроз", () => {
    const s = файл("src/app/shadownet/page.tsx");
    const угрозы = s.indexOf("1. threat model selector");
    const числа = s.indexOf("<StatsStrip />");
    expect(угрозы).toBeGreaterThan(0);
    expect(числа).toBeGreaterThan(угрозы);
    expect(s.split("<StatsStrip />").length - 1).toBe(1);
  });
  test("🔴 veilnetx: форма списка ожидания раньше абзаца и статуса; верхнее поле героя py-8 на телефоне", () => {
    const s = файл("src/app/veilnetx/page.tsx");
    expect(s).toContain('className="max-w-5xl mx-auto px-6 py-8 md:py-16 space-y-6"');
    const форма = s.indexOf("<WaitlistForm />");
    const абзац = s.indexOf("Не «обещаем» приватность");
    const статус = s.indexOf("<StatusPill onPaywall={setPaywall} />");
    expect(форма).toBeGreaterThan(0);
    expect(абзац).toBeGreaterThan(форма);
    expect(статус).toBeGreaterThan(форма);
  });
  test("🔴 qcontract: эмодзи героя только с md, заголовок и абзац на телефоне меньше", () => {
    const s = файл("src/app/qcontract/page.tsx");
    expect(s).toContain('<div className="hidden md:block text-6xl mb-6">💣</div>');
    expect(s).toContain('<h1 className="text-3xl md:text-4xl font-black mb-4">{t("qcontract.home.hero.title")}</h1>');
    expect(s).toContain('className="text-slate-400 text-base md:text-lg mb-6 md:mb-8 leading-relaxed"');
  });
});
