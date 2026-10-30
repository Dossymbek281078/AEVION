import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { sendVerificationEmail } from "../src/lib/build/email";
import { resolveMailLang } from "../src/lib/mailLang";

/** Само письмо (через Resend с подменой fetch): тема и тело по языку; ссылка не меняется. */
const fetchMock = vi.fn();
const VARS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  VARS.forEach((v) => { saved[v] = process.env[v]; delete process.env[v]; });
  process.env.RESEND_API_KEY = "re_key";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  VARS.forEach((v) => { if (saved[v] === undefined) delete process.env[v]; else process.env[v] = saved[v]; });
  vi.unstubAllGlobals();
});

async function mail(lang?: "ru" | "en" | "kk") {
  expect(await sendVerificationEmail({ to: "a@b.c", name: "Sam", token: "tok-1", tokenId: "id-1", brand: "AEVION", lang })).toBe(true);
  const [, opts] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(opts.body) as { subject: string; html: string };
}
const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ]/;

describe("письмо подтверждения почты по языку", () => {
  test("en: тема и текст без кириллицы, ссылка прежняя", async () => {
    const m = await mail("en");
    expect(m.subject).toBe("Confirm your email — AEVION");
    expect(CYR.test(m.subject)).toBe(false);
    expect(CYR.test(m.html)).toBe(false);
    expect(m.html).toContain('lang="en"');
    expect(m.html).toContain("/build/verify-email?token=tok-1&id=id-1");
  });
  test("kk: казахские тема и текст", async () => {
    const m = await mail("kk");
    expect(m.subject).toBe("Email мекенжайыңызды растаңыз — AEVION");
    expect(m.html).toContain("Сілтеме 24 сағат жарамды.");
    expect(m.html).toContain('lang="kk"');
  });
  test("без языка -> ru, как раньше", async () => {
    const m = await mail();
    expect(m.subject).toBe("Подтвердите email — AEVION");
    expect(m.html).toContain("Ссылка действует 24 часа.");
  });
});

describe("resolveMailLang", () => {
  test.each([
    [undefined, "en-US,en;q=0.9", "en"],
    [undefined, "kz", "kk"],
    [undefined, "kk-KZ", "kk"],
    [undefined, undefined, "ru"],
    [undefined, "", "ru"],
    [undefined, "de-DE", "en"],
    [undefined, "ru-RU,ru;q=0.9,en;q=0.8", "ru"],
    ["kk", "en", "kk"],
    ["xx", "en", "en"],
  ])("lang=%s, AL=%s -> %s", (b, h, want) => {
    expect(resolveMailLang(b, h)).toBe(want);
  });
});
