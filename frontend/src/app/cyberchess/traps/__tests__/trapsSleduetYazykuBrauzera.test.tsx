// @vitest-environment jsdom
// 4.11.2026: /cyberchess/traps уводит англо- и казахоязычного гостя на /en|/kk/cyberchess/traps
// с меткой канала; русский остаётся. Замер прода 9ca100905: en-браузер видел 84 русские строки.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { язык, redirect } = vi.hoisted(() => ({
  язык: { v: "ru" as "ru" | "en" | "kk" },
  redirect: vi.fn((url: string) => { throw new Error("REDIRECT " + url); }),
}));
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => язык.v }));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<object>()), redirect }));

import TrapsPageRu from "../page";

const зайти = (c?: string) => TrapsPageRu({ searchParams: Promise.resolve(c ? { c } : {}) });

describe("ловушки следуют языку браузера", () => {
  beforeEach(() => { redirect.mockClear(); });
  it("en → /en/cyberchess/traps с меткой", async () => {
    язык.v = "en";
    await expect(зайти("ch-b-01")).rejects.toThrow("REDIRECT /en/cyberchess/traps?c=ch-b-01");
  });
  it("kk → /kk/cyberchess/traps", async () => {
    язык.v = "kk";
    await expect(зайти()).rejects.toThrow("REDIRECT /kk/cyberchess/traps");
  });
  it("ru остаётся на месте", async () => {
    язык.v = "ru";
    await expect(зайти("yt-x")).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
