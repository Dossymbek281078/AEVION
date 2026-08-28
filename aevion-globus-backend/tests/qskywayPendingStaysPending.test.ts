import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Честное ожидание обязано остаться ожиданием.
 *
 * ПОВОД — не найденный дефект, а МОЙ СОБСТВЕННЫЙ, едва не отправленный.
 * Починяя «отказ выдаёт себя за ожидание», я написал `!v.ok ? "invalid"`.
 * Это неверно: `verifyProof` отдаёт `ok:false` в ДВУХ разных случаях —
 *
 *   привязки к блоку ещё нет  -> честное ожидание, повторить позже
 *   исключение при сверке     -> доказательство негодно, ждать бессмысленно
 *
 * то есть моя правка назвала бы недействительным законно ожидающее
 * доказательство. Починка ошибки в одну сторону вносила ошибку в другую.
 *
 * Различитель теперь идёт из источника (`reason`), а этот тест держит именно
 * ту ветку, которую я чуть не сломал: её не покрывал никто, потому что
 * настоящее «ожидающее» доказательство в тесте не построить — нужна подмена.
 */
vi.mock("../src/lib/opentimestamps/anchor", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/opentimestamps/anchor")>();
  return {
    ...real,
    upgradeProof: vi.fn(async () => ({ upgraded: false, otsProof: null })),
    verifyProof: vi.fn(async () => ({
      ok: false,
      bitcoinBlockHeight: null,
      attestations: ["PendingAttestation"],
      error: "no Bitcoin attestation yet (still pending)",
      reason: "awaiting-bitcoin" as const,
    })),
  };
});

const { verifyAnchoredAirspace } = await import("../src/routes/qskyway.airspace.anchor");

const OK_BODY = {
  city: "nyc",
  contentHash: "ab".repeat(32),
  otsProofB64: Buffer.from("любые байты, сверку подменяем").toString("base64"),
};

describe("ожидающее доказательство не объявляется недействительным", () => {
  beforeEach(() => vi.clearAllMocks());

  test("статус остаётся pending, а НЕ invalid", async () => {
    const r = await verifyAnchoredAirspace(OK_BODY);
    expect(r.ots.status, "честное ожидание названо недействительным").not.toBe("invalid");
    expect(r.ots.status).toBe("pending");
  });

  test("совет человеку — подождать, а не «ждать бессмысленно»", async () => {
    const r = await verifyAnchoredAirspace(OK_BODY);
    // Ровно та ветка, где у меня остались ДВЕ ветви вместо трёх и ожидание
    // уезжало в «Доказано». Проверяем обе половины.
    expect(String(r.note).includes("Доказано"), "ожидание названо доказанным").toBe(false);
    expect(String(r.noteEn).toLowerCase().includes("proven"), "pending called proven").toBe(false);
    expect(String(r.noteEn).toLowerCase().includes("will not help"),
      "ожидающему сказано, что ждать бессмысленно").toBe(false);
  });

  test("и доказанным это тоже не считается", async () => {
    const r = await verifyAnchoredAirspace(OK_BODY);
    expect(r.fullyProven).toBe(false);
    expect(r.ots.verified).toBe(false);
  });
});
