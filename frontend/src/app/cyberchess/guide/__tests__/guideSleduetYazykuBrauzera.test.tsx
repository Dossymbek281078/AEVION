// @vitest-environment jsdom
// 5.11.2026: /cyberchess/guide уводит англо- и казахоязычного гостя на /en|/kk/cyberchess/guide с меткой канала.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { язык, redirect } = vi.hoisted(() => ({
  язык: { v: "ru" as "ru" | "en" | "kk" },
  redirect: vi.fn((url: string) => { throw new Error("REDIRECT " + url); }),
}));
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => язык.v }));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<object>()), redirect }));

import CcGuidePageRu from "../page";

const зайти = (c?: string) => CcGuidePageRu({ searchParams: Promise.resolve(c ? { c } : {}) });

describe("страница о тренере следует языку браузера", () => {
  beforeEach(() => { redirect.mockClear(); });
  it("en → /en/cyberchess/guide с меткой", async () => {
    язык.v = "en";
    await expect(зайти("ch-a-01")).rejects.toThrow("REDIRECT /en/cyberchess/guide?c=ch-a-01");
  });
  it("kk → /kk/cyberchess/guide", async () => {
    язык.v = "kk";
    await expect(зайти()).rejects.toThrow("REDIRECT /kk/cyberchess/guide");
  });
  it("ru остаётся на месте", async () => {
    язык.v = "ru";
    await expect(зайти("yt-x")).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
