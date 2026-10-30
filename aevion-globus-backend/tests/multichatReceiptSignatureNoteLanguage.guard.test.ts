/**
 * Пометка подписи чека — на языке экрана (замер 30.10.2026: на /en под отчётом стояло «чек не подписан…»).
 * Пометки в хеш чека не входят, поэтому язык не может сдвинуть ни хеш, ни подпись.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const RECEIPT = {
  version: 1 as const,
  conversationId: "c-1",
  askedAt: "2026-10-30T10:00:00.000Z",
  promptHash: "a".repeat(64),
  promptChars: 42,
  panel: [{ agentId: "analyst", ok: true, replyHash: "b".repeat(64), replyChars: 100 }],
  dissent: { verdict: "split", agreement: 0.4, numericConflicts: 1, outlier: null, hedged: [] },
};

const KEY = crypto.generateKeyPairSync("ed25519");
const RAW_PUB = KEY.publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");

const реестр = vi.hoisted(() => ({ активный: null as unknown, сбой: false }));
vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  resolveEd25519: vi.fn(async () => ({ publicKeyHex: RAW_PUB })),
  getActiveEd25519: vi.fn(async () => {
    if (реестр.сбой) throw new Error("SASL: db down");
    return реестр.активный;
  }),
}));

const кириллица = (s: string | null) => /[А-Яа-яЁё]/.test(s ?? "");

beforeEach(() => {
  реестр.активный = null;
  реестр.сбой = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("signReceipt: пометка по lang", () => {
  test("ключа нет: ru по умолчанию, en без кириллицы, хеш одинаковый", async () => {
    const { signReceipt } = await import("../src/services/multichat/receipt");
    const ru = await signReceipt(RECEIPT as never);
    const en = await signReceipt(RECEIPT as never, "en");
    expect(ru.signatureNote).toMatch(/^активный ed25519-ключ не настроен/);
    expect(en.signatureNote).toMatch(/no active ed25519 key/);
    expect(кириллица(en.signatureNote), String(en.signatureNote)).toBe(false);
    expect(en.hash, "язык сдвинул хеш чека").toBe(ru.hash);
  });

  test("реестр ключей упал: en без кириллицы и без деталей БД", async () => {
    реестр.сбой = true;
    const { signReceipt } = await import("../src/services/multichat/receipt");
    const en = await signReceipt(RECEIPT as never, "en");
    expect(en.signatureNote).toMatch(/key registry unavailable/);
    expect(en.signatureNote).not.toMatch(/SASL|db down/);
    expect(кириллица(en.signatureNote)).toBe(false);
    expect((await signReceipt(RECEIPT as never)).signatureNote).toMatch(/^реестр ключей недоступен/);
  });
});

describe("verifyReceipt: пометка по lang", () => {
  test("без подписи: ru по умолчанию, en по-английски", async () => {
    const { verifyReceipt } = await import("../src/services/multichat/receipt");
    expect((await verifyReceipt({ receipt: RECEIPT as never })).signatureNote).toMatch(/^чек не подписан, и хеш/);
    const en = await verifyReceipt({ receipt: RECEIPT as never }, "en");
    expect(en.signatureNote).toMatch(/unsigned and no hash was attached/);
    expect(кириллица(en.signatureNote)).toBe(false);
  });

  test("неизвестный алгоритм: en без кириллицы", async () => {
    const { verifyReceipt } = await import("../src/services/multichat/receipt");
    const en = await verifyReceipt({ receipt: RECEIPT as never, signature: { algo: "rsa", kid: "k", value: "00" } }, "en");
    expect(en.signatureNote).toMatch(/unknown signature algorithm: rsa/);
    expect(кириллица(en.signatureNote)).toBe(false);
  });
});
