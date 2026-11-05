import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 05.11.2026: «свой» у подтверждённой оплаты = testMode || адрес наш || метка канала probe-/smoke-/qa-.
 * Оплата основателя в live-режиме кассы на ящик вне списка иначе считалась живой.
 */
const FILE = join(mkdtempSync(join(tmpdir(), "ownmark-")), "events.jsonl");
let записать: typeof import("../src/lib/payment/paymentConfirmedEvent").записатьПодтверждённуюОплату;
let оплатаНаша: typeof import("../src/routes/events").оплатаНаша;

function последнее(): { ts: string; meta: Record<string, unknown> } {
  const l = readFileSync(FILE, "utf8").trim().split("\n");
  return JSON.parse(l[l.length - 1]);
}

beforeAll(async () => {
  process.env.EVENTS_FILE = FILE;
  записать = (await import("../src/lib/payment/paymentConfirmedEvent")).записатьПодтверждённуюОплату;
  оплатаНаша = (await import("../src/routes/events")).оплатаНаша;
});

describe("свой по метке канала", () => {
  it("channel=probe-x при test_mode=false и чужом ящике — свой", () => {
    записать({ source: "lemonsqueezy", email: "someone@gmail.com", testMode: false, channel: "probe-x" });
    expect(последнее().meta.свой).toBe(true);
    expect(оплатаНаша(последнее())).toBe(true);
  });
  it("smoke- и qa- — свои", () => {
    записать({ source: "lemonsqueezy", email: "someone@gmail.com", channel: "smoke-ls" });
    expect(последнее().meta.свой).toBe(true);
    записать({ source: "lemonsqueezy", email: "someone@gmail.com", channel: "qa-run" });
    expect(последнее().meta.свой).toBe(true);
  });
  it("чужой ящик, test_mode=false, без метки — не свой", () => {
    записать({ source: "lemonsqueezy", email: "someone@gmail.com", testMode: false });
    expect(последнее().meta.свой).toBe(false);
    expect(оплатаНаша(последнее())).toBe(false);
  });
  it("живая метка (youtube-x) не делает оплату своей", () => {
    записать({ source: "gumroad", email: "someone@gmail.com", channel: "yt-shorts-12" });
    expect(последнее().meta.свой).toBe(false);
  });
  it("gumroad без testMode, но smoke-адрес — свой", () => {
    записать({ source: "gumroad", email: "smoke-gr1@gmail.com" });
    expect(последнее().meta.свой).toBe(true);
  });
  it("канал не попадает в событие", () => {
    записать({ source: "gumroad", email: "a@b.co", channel: "probe-secret" });
    expect(JSON.stringify(последнее())).not.toContain("probe-secret");
  });
});

describe("ЛЕГАСИ-фикстура 30.10", () => {
  it("обе отметки — наши", () => {
    for (const ts of ["2026-10-30T18:12:06.828Z", "2026-10-30T18:12:19.817Z"]) {
      expect(оплатаНаша({ ts, meta: { свой: false } })).toBe(true);
    }
  });
});
