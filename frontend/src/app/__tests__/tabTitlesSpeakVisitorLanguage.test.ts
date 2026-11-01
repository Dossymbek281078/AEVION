import { describe, it, expect, vi } from "vitest";

/**
 * 2.11.2026 (прод 5c84234b1): вкладки /auth, /pricing, /multichat-engine, /bureau у русского гостя
 * шли английскими или двуязычной склейкой. Теперь generateMetadata layout'а берёт язык запроса.
 */
const lang = { value: "ru" as string };
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => lang.value }));
vi.mock("@/lib/i18n-server", () => ({ getServerLang: async () => lang.value }));

async function title(path: string, l: string): Promise<string> {
  lang.value = l;
  const mod = (await import(path)) as { generateMetadata: () => Promise<{ title?: unknown }> };
  const m = await mod.generateMetadata();
  const t = m.title as { absolute?: string } | string;
  return typeof t === "string" ? t : (t.absolute ?? "");
}

const ПУТИ = {
  auth: "../auth/layout",
  pricing: "../pricing/layout",
  multichat: "../multichat-engine/layout",
  bureau: "../bureau/layout",
} as const;

describe("заголовки вкладок по языку гостя", () => {
  for (const [имя, путь] of Object.entries(ПУТИ)) {
    it(`${имя}: ru — кириллица без латинской склейки, en — без кириллицы, kk — казахские буквы`, async () => {
      const ru = await title(путь, "ru");
      const en = await title(путь, "en");
      const kk = await title(путь, "kk");
      expect(ru).toMatch(/[а-яё]/i);
      expect(ru).not.toMatch(/·/);
      expect(en).not.toMatch(/[а-яё]/i);
      expect(kk).toMatch(/[әіңқұүөғ]/i);
      expect(new Set([ru, en, kk]).size).toBe(3);
      expect(await title(путь, "de")).toBe(en);
      for (const t of [ru, en, kk]) expect(t).toContain("AEVION");
    });
  }
});
