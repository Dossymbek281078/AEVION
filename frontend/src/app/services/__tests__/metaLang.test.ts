import { describe, test, expect, vi, beforeEach } from "vitest";

const lang = vi.hoisted(() => ({ v: "ru" }));
vi.mock("@/lib/i18n-server", () => ({ getServerLang: async () => lang.v }));

import { generateMetadata, языкМетатегов } from "../page";

const titleOf = (m: { title?: unknown }) => (m.title as { absolute: string }).absolute;

describe("/services — метатеги по языку посетителя", () => {
  beforeEach(() => { lang.v = "ru"; });

  test("языкМетатегов: ?lang главнее, остальное по серверному языку", () => {
    expect(языкМетатегов("en", "ru")).toBe("en");
    expect(языкМетатегов("ru", "en")).toBe("ru");
    expect(языкМетатегов(undefined, "en")).toBe("en");
    expect(языкМетатегов(undefined, "kk")).toBe("ru");
    expect(языкМетатегов(["en"], "ru")).toBe("en");
  });

  test("?lang=en даёт английские метатеги", async () => {
    const m = await generateMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    expect(titleOf(m)).toContain("AEVION services");
    expect(m.openGraph?.locale).toBe("en_US");
  });

  test("без ?lang и серверный ru — русские метатеги", async () => {
    const m = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(titleOf(m)).toContain("Услуги AEVION");
    expect(m.openGraph?.locale).toBe("ru_RU");
  });

  test("без ?lang и серверный en (кука/Accept-Language) — английские метатеги", async () => {
    lang.v = "en";
    const m = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(titleOf(m)).toContain("AEVION services");
  });
});
