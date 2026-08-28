import { describe, test, expect } from "vitest";
import { verifyAnchoredTrustScore } from "../src/lib/trustAnchor";

/**
 * Отказ не имеет права выглядеть ожиданием.
 *
 * ПОВОД. 29.08.2026, замер на ПРОДЕ: `POST /airspace/anchor/verify` с пустым
 * телом отвечал 200 и `"status":"pending"`. В OpenTimestamps `pending` значит
 * «доказательство подано, ждём подтверждения Bitcoin» — а здесь не подавали
 * ничего. Тихого успеха не было (`verified:false`, `fullyProven:false`), но
 * потребитель, читающий одно поле `status`, показал бы человеку «ожидает
 * подтверждения» там, где верный ответ — «вы не прислали доказательство».
 *
 * Причина была в одной строке: у `otsFail` — пути ОТКАЗА — значением по
 * умолчанию стоял `"pending"`. То есть все три отказа докладывали ожидание.
 *
 * Для продукта, который продаёт доказуемость, это дороже обычной неточности:
 * поле состояния врёт правдоподобно и именно в ту сторону, которая выгодна нам.
 */
describe("проверка якоря: отказ называет себя отказом", () => {
  const BAD_INPUTS: Array<[string, unknown]> = [
    ["пустое тело", {}],
    ["доказательства нет вовсе", { snapshot: { attestation: { contentHash: "ab".repeat(32) } } }],
    // ⚠️ Вход подобран так, чтобы РАЗЛИЧАТЬ пути. Первая версия брала
    // "!!!не base64!!!" — он декодируется в ноль байт и попадает в соседнюю
    // проверку «декодировалось в ничто», дающую тот же статус. Мутация это
    // показала: выключение проверки формата ничего не меняло, то есть тест
    // охранял не её. Здесь символы годные ЕСТЬ, поэтому без проверки формата
    // мусор уехал бы вглубь и получил "invalid" вместо честного отказа.
    ["не base64, но декодируемое", { otsProofB64: "AAAA!!!!", snapshot: { attestation: { contentHash: "ab".repeat(32) } } }],
    ["у снимка нет хеша", { otsProofB64: "AAAA", snapshot: { attestation: {} } }],
  ];

  for (const [name, body] of BAD_INPUTS) {
    test(name + " -> статус НЕ pending", async () => {
      const r = await verifyAnchoredTrustScore(body);
      // Главное утверждение: ожиданием это называть нельзя.
      expect(r.ots.status, "отказ доложен как ожидание подтверждения").not.toBe("pending");
      expect(r.ots.status).toBe("not-submitted");
      // И отказ обязан остаться отказом по существу.
      expect(r.ots.verified).toBe(false);
      expect(r.fullyProven).toBe(false);
      // Причина должна быть названа, иначе статус бесполезен.
      expect(typeof r.ots.error === "string" && r.ots.error.length > 0,
        "отказ без названной причины").toBe(true);
    });
  }

  test("доказательство ПРАВИЛЬНОГО формата, но негодное -> invalid, а не pending", async () => {
    // Самый дорогой случай, и мои первые входы его НЕ доставали: они отсекались
    // раньше, до самой проверки. Здесь base64 настоящий и декодируется в байты,
    // просто это не .ots-доказательство. Раньше статус считался ТОЛЬКО по высоте
    // блока — высоты нет, значит "pending", то есть «ждём подтверждения Bitcoin»
    // про доказательство, которое проверку провалило.
    const notAProof = Buffer.from("это не .ots, но base64 честный").toString("base64");
    const r = await verifyAnchoredTrustScore({
      otsProofB64: notAProof,
      snapshot: { attestation: { contentHash: "ab".repeat(32) } },
    });
    expect(r.ots.verified).toBe(false);
    expect(r.ots.status, "провал проверки доложен как ожидание подтверждения").not.toBe("pending");
    expect(r.ots.status).toBe("invalid");
    expect(r.fullyProven).toBe(false);
  });

  test("ни один негодный вход не даёт bitcoin-confirmed", async () => {
    // Отдельно от предыдущего: там проверяется «не ожидание», здесь — что
    // отказ не выдаёт себя за ДОКАЗАННОЕ. Это разные ошибки и разная цена.
    for (const [, body] of BAD_INPUTS) {
      const r = await verifyAnchoredTrustScore(body);
      expect(r.ots.status).not.toBe("bitcoin-confirmed");
      expect(r.ots.bitcoinBlockHeight).toBeNull();
    }
  });
});
