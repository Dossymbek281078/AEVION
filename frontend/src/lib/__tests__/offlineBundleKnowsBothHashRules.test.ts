// Офлайн-проверка — ВТОРАЯ поверхность обещания «проверяемо, даже если
// AEVION исчезнет». До 27.08.2026 она знала только нынешнее правило хеша,
// поэтому четыре сертификата из пяти в публичном реестре в автономном пакете
// читались как подделка — тот же дефект, что был на сервере, но чинить его
// пришлось бы отдельно, потому что кода у них общего нет.
//
// Здесь проверяется ровно один слой — хеш. Остальные проверки пакета
// (подписи, метка времени) в этих данных отсутствуют и дают "skip".

import { describe, expect, it } from "vitest";
import { verifyAevionBundle, type AevionBundle } from "../verifyBundle";

const FIELDS = {
  title: "Степной рассвет",
  description: "фотография, снята на рассвете",
  kind: "photo",
  country: "KZ" as string | null,
  city: "Алматы" as string | null,
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Нынешнее правило: NFC, сортировка ключей, пять полей. */
const hashV2 = () =>
  sha256Hex(
    JSON.stringify({
      city: FIELDS.city,
      country: FIELDS.country,
      description: FIELDS.description,
      kind: FIELDS.kind,
      title: FIELDS.title,
    }),
  );

/** Правило до канонизации: обычный JSON.stringify трёх полей. */
const hashV1 = () =>
  sha256Hex(
    JSON.stringify({
      title: FIELDS.title,
      description: FIELDS.description,
      kind: FIELDS.kind,
    }),
  );

function bundle(storedHash: string): AevionBundle {
  return {
    certificate: {
      id: "cert-offline-test",
      title: FIELDS.title,
      kind: FIELDS.kind,
      description: FIELDS.description,
      contentHash: storedHash,
      status: "active",
    },
    proofs: {
      contentHash: {
        algo: "SHA-256",
        value: storedHash,
        canonicalInputs: { ...FIELDS },
      },
      aevionEd25519: null,
      authorCosign: null,
      openTimestamps: null,
    },
  } as AevionBundle;
}

describe("автономный пакет знает оба правила хеша", () => {
  it("контроль: два правила дают РАЗНЫЕ значения", async () => {
    // Иначе весь набор ниже бессмыслен: «сошлось по v1» ничего не означало бы.
    expect(await hashV1()).not.toBe(await hashV2());
  });

  it("сертификат нынешней выдачи проходит", async () => {
    const r = await verifyAevionBundle(bundle(await hashV2()));
    expect(r.contentHash.status).toBe("pass");
    // И не приписывает ему старое правило.
    expect(r.contentHash.detail).not.toMatch(/v1 rule/);
  });

  it("сертификат прежней выдачи проходит — и ограничение названо", async () => {
    const r = await verifyAevionBundle(bundle(await hashV1()));
    expect(r.contentHash.status).toBe("pass");
    expect(r.contentHash.detail).toMatch(/v1 rule/);
    // Главное в этой строке: чего правило НЕ покрывало.
    expect(r.contentHash.detail).toMatch(/not covered by this hash/);
  });

  it("подделка не проходит ни одним правилом", async () => {
    const b = bundle(await hashV2());
    b.proofs.contentHash.canonicalInputs.title = "Чужое название";
    b.certificate.title = "Чужое название";
    const r = await verifyAevionBundle(b);
    expect(r.contentHash.status).toBe("fail");
  });

  it("правка города у сертификата НЫНЕШНЕЙ выдачи ловится", async () => {
    const b = bundle(await hashV2());
    b.proofs.contentHash.canonicalInputs.city = "Астана";
    const r = await verifyAevionBundle(b);
    expect(r.contentHash.status).toBe("fail");
  });

  it("⚠️ правка города у сертификата ПРЕЖНЕЙ выдачи не ловится — и потому названа", async () => {
    // Не дефект проверки, а свойство правила v1. Тест закрепляет и то, что
    // проверка всё равно проходит, и то, что человеку об этом сказано:
    // принять старое правило молча значило бы обещать несуществующую защиту.
    const b = bundle(await hashV1());
    b.proofs.contentHash.canonicalInputs.city = "Астана";
    const r = await verifyAevionBundle(b);
    expect(r.contentHash.status).toBe("pass");
    expect(r.contentHash.detail).toMatch(/country and city/);
  });
});
