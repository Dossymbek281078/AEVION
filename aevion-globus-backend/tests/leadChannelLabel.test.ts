// Заявка несёт метку канала ?c= (например mail-pb340), чтобы её можно было
// привязать к письму. Мусорная метка отбрасывается, без метки — как раньше.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.NODE_ENV = "test";

const FILE = join(tmpdir(), "aevion-leads-channel-test.jsonl");
const SAVED_LEADS = process.env.LEADS_FILE;
const SAVED_NOTIFY = process.env.NOTIFY_EMAIL;

const { письма } = vi.hoisted(() => ({
  письма: [] as Array<{ to: string; subject: string; text: string }>,
}));

vi.mock("../src/routes/provisioning", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/routes/provisioning")>();
  return {
    ...orig,
    sendEmail: async (p: { to: string; subject: string; text: string }) => {
      письма.push({ to: p.to, subject: p.subject, text: p.text });
      return { ok: true, mode: "real" as const, error: undefined };
    },
  };
});

const приложение = async () => {
  vi.resetModules();
  const { pricingRouter } = await import("../src/routes/pricing");
  const a = express();
  a.use(express.json());
  return a.use("/api/pricing", pricingRouter);
};

const ЗАЯВКА = { name: "Алия Смагулова", email: "buyer@example.com", source: "pricing/contact:bureau" };

const записанная = () => JSON.parse(readFileSync(FILE, "utf8").trim().split("\n").pop() as string);

beforeEach(() => {
  process.env.LEADS_FILE = FILE;
  process.env.NOTIFY_EMAIL = "sales@aevion.app";
  rmSync(FILE, { force: true });
  письма.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(FILE, { force: true });
  vi.restoreAllMocks();
  if (SAVED_LEADS === undefined) delete process.env.LEADS_FILE;
  else process.env.LEADS_FILE = SAVED_LEADS;
  if (SAVED_NOTIFY === undefined) delete process.env.NOTIFY_EMAIL;
  else process.env.NOTIFY_EMAIL = SAVED_NOTIFY;
});

describe("метка канала в заявке", () => {
  test("channel сохраняется в записи и попадает в письмо строкой «Канал»", async () => {
    const r = await request(await приложение()).post("/api/pricing/lead").send({ ...ЗАЯВКА, channel: "mail-pb340" });
    expect(r.status).toBe(201);
    expect(записанная().channel).toBe("mail-pb340");
    const п = письма.filter((x) => x.to === "sales@aevion.app");
    expect(п.length).toBe(1);
    expect(п[0].text).toContain("Канал: mail-pb340");
  });

  test.each([
    ["заглавные и пробел", "Mail PB340"],
    ["разметка", "<script>x</script>"],
    ["длиннее 80", "a".repeat(81)],
    ["не строка", 123],
  ])("мусорный channel отбрасывается: %s", async (_n, channel) => {
    const r = await request(await приложение()).post("/api/pricing/lead").send({ ...ЗАЯВКА, channel });
    expect(r.status).toBe(201);
    expect("channel" in записанная()).toBe(false);
    expect(письма.some((x) => x.text.includes("Канал:"))).toBe(false);
  });

  test("без channel — как раньше", async () => {
    const r = await request(await приложение()).post("/api/pricing/lead").send(ЗАЯВКА);
    expect(r.status).toBe(201);
    expect("channel" in записанная()).toBe(false);
    expect(записанная().source).toBe("pricing/contact:bureau");
  });
});
