import { describe, test, expect } from "vitest";
import { verifyAevionBundle, type AevionBundle } from "../verifyBundle";

/**
 * Офлайн-пакет — то, чем сертификат доказывают БЕЗ нас. Его вердикт по якорю
 * читает человек, у которого нашего сайта под рукой нет.
 *
 * Замер 28.08.2026: разбор состояний якоря заканчивался общим `else` со
 * status: "fail". Туда попадало и «не якорили» — то есть апрельскому
 * сертификату, у которого якоря нет и не будет по возрасту, пакет рисовал бы
 * красную плитку «проверка не прошла». Красным нужно называть провал, иначе
 * рядом обесцениваются настоящие красные плитки.
 *
 * Второй случай там же: `bitcoin-confirmed && bitcoinBlockHeight` — при
 * подтверждённом якоре БЕЗ записанной высоты условие не выполнялось, и
 * подтверждение тоже уходило в «fail».
 */

const HASH = "0".repeat(64);

function bundleWithAnchor(ots: AevionBundle["proofs"]["openTimestamps"]): AevionBundle {
  return {
    certificate: {
      id: "cert-anchor-offline",
      title: "Степной рассвет",
      kind: "photo",
      description: "фотография",
      contentHash: HASH,
      status: "active",
    },
    proofs: {
      contentHash: { algo: "SHA-256", value: HASH, canonicalInputs: {} },
      aevionEd25519: null,
      authorCosign: null,
      openTimestamps: ots,
    },
  } as unknown as AevionBundle;
}

const anchor = async (ots: AevionBundle["proofs"]["openTimestamps"]) =>
  (await verifyAevionBundle(bundleWithAnchor(ots))).bitcoinAnchor;

const OTS = (over: Record<string, unknown>) =>
  ({
    status: "pending",
    bitcoinBlockHeight: null,
    stampedAt: null,
    upgradedAt: null,
    proofBase64: null,
    ...over,
  }) as unknown as AevionBundle["proofs"]["openTimestamps"];

describe("офлайн-пакет: отсутствие якоря — не провал проверки", () => {
  test("не якорили — «пропущено», а не «провал»", async () => {
    const a = await anchor(OTS({ status: "not_stamped" }));
    expect(a?.status, "честное «якоря нет» показано как провал проверки").toBe("skip");
    expect(a?.detail).toMatch(/predates|none will appear/i);
  });

  test("подтверждено с номером блока — «пройдено», номер назван", async () => {
    const a = await anchor(OTS({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 }));
    expect(a?.status).toBe("pass");
    expect(a?.detail).toContain("912345");
  });

  test("подтверждено БЕЗ номера блока — всё равно «пройдено»", async () => {
    // Пробел записи не отменяет подтверждения.
    const a = await anchor(OTS({ status: "bitcoin-confirmed", bitcoinBlockHeight: null }));
    expect(a?.status, "подтверждённый якорь без высоты объявлен провалом").toBe("pass");
    expect(a?.detail).not.toMatch(/#null|#undefined/);
  });

  test("готовится — «пропущено»", async () => {
    expect((await anchor(OTS({ status: "pending" })))?.status).toBe("skip");
  });

  test("сорвалось — вот это действительно «провал»", async () => {
    const a = await anchor(OTS({ status: "failed" }));
    expect(a?.status).toBe("fail");
  });

  test("поля вовсе нет — «пропущено» с честной причиной", async () => {
    const a = await anchor(null);
    expect(a?.status).toBe("skip");
  });

  test("четыре состояния дают три РАЗНЫХ вердикта, и только один красный", async () => {
    const got = await Promise.all(
      ["not_stamped", "pending", "bitcoin-confirmed", "failed"].map((s) =>
        anchor(OTS({ status: s, bitcoinBlockHeight: s === "bitcoin-confirmed" ? 1 : null })),
      ),
    );
    const statuses = got.map((g) => g?.status);
    expect(statuses).toEqual(["skip", "skip", "pass", "fail"]);
    expect(statuses.filter((s) => s === "fail").length, "красным помечено больше одного состояния").toBe(1);
  });
});
