import { describe, expect, test, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

import { canonicalHash } from "../src/lib/qsignV2/canonicalize";

// У модуля чека (src/services/multichat/receipt.ts) не было НИ ОДНОГО теста — ни в
// этой ветке, ни в шести чужих, где этот файл правят. Проверено: единственные два
// теста, упоминающие «multichat/receipt», — мои же, и в них только АДРЕС ручки, а не
// логика. При этом:
//
//   * ручка POST /api/multichat/receipt/verify ПУБЛИЧНАЯ и без авторизации — так
//     задумано, предъявляют чек тому, у кого нет аккаунта;
//   * посадачная обещает «чек, который проверяется по ссылке»;
//   * внутри канонизация RFC8785, sha256 и подпись ed25519 — код, где тихая
//     правка ломает проверку ВСЕХ ранее выданных чеков, и заметить это нечем.
//
// Канонизация как примитив покрыта отдельно (qsignV2.canonicalize.test.ts). Здесь —
// composition: что именно возвращает verifyReceipt в каждом исходе.

const RECEIPT = {
  version: 1 as const,
  conversationId: "c-1",
  askedAt: "2026-08-19T10:00:00.000Z",
  promptHash: "a".repeat(64),
  promptChars: 42,
  panel: [
    { agentId: "analyst", ok: true, replyHash: "b".repeat(64), replyChars: 100 },
    { agentId: "critic", ok: true, replyHash: "c".repeat(64), replyChars: 120 },
  ],
  dissent: { verdict: "split", agreement: 0.4, numericConflicts: 1, outlier: "critic", hedged: [] },
};

/** Тот же чек, но ключи объектов вставлены в другом порядке. */
const RECEIPT_REORDERED = {
  dissent: { hedged: [], outlier: "critic", numericConflicts: 1, agreement: 0.4, verdict: "split" },
  panel: [
    { replyChars: 100, replyHash: "b".repeat(64), ok: true, agentId: "analyst" },
    { replyChars: 120, replyHash: "c".repeat(64), ok: true, agentId: "critic" },
  ],
  promptChars: 42,
  promptHash: "a".repeat(64),
  askedAt: "2026-08-19T10:00:00.000Z",
  conversationId: "c-1",
  version: 1 as const,
};

const KEY = crypto.generateKeyPairSync("ed25519");
const RAW_PUB = KEY.publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");

vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  resolveEd25519: vi.fn(async (kid: string) => {
    if (kid === "нет-такого") throw new Error("ключ не найден");
    return { publicKeyHex: RAW_PUB };
  }),
  getActiveEd25519: vi.fn(async () => null),
}));

async function verify(input: Parameters<typeof import("../src/services/multichat/receipt").verifyReceipt>[0]) {
  const { verifyReceipt } = await import("../src/services/multichat/receipt");
  return verifyReceipt(input);
}

beforeEach(() => vi.clearAllMocks());

describe("хеш чека", () => {
  test("верный хеш подтверждается", async () => {
    const { hash } = canonicalHash(RECEIPT);
    const out = await verify({ receipt: RECEIPT as never, hash });
    expect(out.hashMatches).toBe(true);
    expect(out.computedHash).toBe(hash);
  });

  test("подменённое содержимое не подтверждается", async () => {
    // Отрицательный контроль: без него «верный подтверждается» мог бы означать,
    // что функция подтверждает всё подряд.
    const { hash } = canonicalHash(RECEIPT);
    const tampered = { ...RECEIPT, promptChars: 43 };
    const out = await verify({ receipt: tampered as never, hash });
    expect(out.hashMatches).toBe(false);
  });

  test("порядок ключей НЕ меняет хеш — в этом весь смысл канонизации", async () => {
    // Главное свойство: чек, пересобранный другим клиентом или пересохранённый
    // редактором, обязан проверяться. Сломай канонизацию — и все ранее выданные
    // чеки перестанут подтверждаться, а заметить это будет нечем.
    expect(canonicalHash(RECEIPT_REORDERED).hash).toBe(canonicalHash(RECEIPT).hash);
    const out = await verify({ receipt: RECEIPT_REORDERED as never, hash: canonicalHash(RECEIPT).hash });
    expect(out.hashMatches).toBe(true);
  });

  test("спецификация отдаётся наружу — её обещает страница проверки", async () => {
    const out = await verify({ receipt: RECEIPT as never });
    expect(out.spec.digest).toBe("sha256");
    expect(out.spec.signature).toBe("ed25519");
    expect(out.spec.canonicalization.length).toBeGreaterThan(3);
  });
});

describe("подпись", () => {
  const sign = (value: unknown) => {
    const { canonical } = canonicalHash(value);
    return crypto.sign(null, Buffer.from(canonical, "utf8"), KEY.privateKey).toString("hex");
  };

  test("подписи нет — так и сказано, а хеш всё равно проверен", async () => {
    const { hash } = canonicalHash(RECEIPT);
    const out = await verify({ receipt: RECEIPT as never, hash });
    expect(out.signature).toBe("absent");
    expect(out.hashMatches).toBe(true);
  });

  test("настоящая подпись признаётся действительной", async () => {
    const out = await verify({
      receipt: RECEIPT as never,
      signature: { algo: "ed25519", kid: "k1", value: sign(RECEIPT) },
    });
    expect(out.signature).toBe("valid");
  });

  test("подпись от ДРУГОГО содержимого — недействительна", async () => {
    const out = await verify({
      receipt: RECEIPT as never,
      signature: { algo: "ed25519", kid: "k1", value: sign({ ...RECEIPT, promptChars: 99 }) },
    });
    expect(out.signature).toBe("invalid");
  });

  test("подпись проверяется по КАНОНИЧЕСКОЙ форме: другой порядок ключей её не ломает", async () => {
    const out = await verify({
      receipt: RECEIPT_REORDERED as never,
      signature: { algo: "ed25519", kid: "k1", value: sign(RECEIPT) },
    });
    expect(out.signature).toBe("valid");
  });

  test("чужой алгоритм — «непроверяемо», а не «недействительно»", async () => {
    // Разница существенная: «недействительно» означает подделку, а незнакомый
    // алгоритм означает лишь, что мы не умеем. Путать их — вводить в заблуждение.
    const out = await verify({
      receipt: RECEIPT as never,
      signature: { algo: "rsa-pss", kid: "k1", value: "00" },
    });
    expect(out.signature).toBe("unverifiable");
    expect(out.signatureNote).toMatch(/алгоритм/i);
  });

  test("ключ не разрешается — «непроверяемо», и хеш всё равно проверен", async () => {
    const { hash } = canonicalHash(RECEIPT);
    const out = await verify({
      receipt: RECEIPT as never,
      hash,
      signature: { algo: "ed25519", kid: "нет-такого", value: sign(RECEIPT) },
    });
    expect(out.signature).toBe("unverifiable");
    expect(out.hashMatches).toBe(true);
  });
});
