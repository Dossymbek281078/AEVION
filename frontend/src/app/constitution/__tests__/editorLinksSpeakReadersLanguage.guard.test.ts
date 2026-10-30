// Подписи пути к оплате в constitution — на языке читателя.
// 27.10.2026 (Приложения-2, замер прода ru): в редакторе «🎓 Academy», «📝 Blog», «💎 Pricing», а на
// /constitution/pricing кнопка Pro «Choose a term →» — по-английски на русской странице, ровно на пути к кассе.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR = readFileSync(join(HERE, "..", "page.tsx"), "utf8");
const PRICING = readFileSync(join(HERE, "..", "pricing", "page.tsx"), "utf8");
const КЛЮЧИ = ["constitution.nav.academy", "constitution.nav.blog", "constitution.nav.pricing", "constitution.pricing.tier.pro.cta"];

describe("constitution: подписи пути к оплате переведены", () => {
  it("в исходнике нет английских подписей-строк", () => {
    expect(EDITOR).not.toMatch(/^\s*🎓 Academy\s*$/m);
    expect(EDITOR).not.toMatch(/^\s*📝 Blog\s*$/m);
    expect(EDITOR).not.toMatch(/^\s*💎 Pricing\s*$/m);
    expect(PRICING).not.toContain('cta: "Choose a term →"');
    expect(EDITOR).toContain('t("constitution.nav.pricing")');
    expect(PRICING).toContain('t("constitution.pricing.tier.pro.cta")');
  });

  it("ключи есть в ru/en/kk; ru — кириллицей (контроль: en — латиницей)", () => {
    for (const d of [ru, en, kk] as Record<string, string>[]) for (const k of КЛЮЧИ) expect(d[k], k).toBeTruthy();
    for (const k of КЛЮЧИ) expect((ru as Record<string, string>)[k], `ru ${k}`).toMatch(/[А-Яа-яЁё]/);
    expect((en as Record<string, string>)["constitution.nav.pricing"]).toBe("Pricing");
  });
});
