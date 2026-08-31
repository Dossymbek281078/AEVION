// Офлайн-проверка объявляла пакет подлинным, не выполнив НИ ОДНОЙ
// криптографической проверки.
//
// Вердикт считался так (verifyBundle.ts):
//
//   if (allChecks.some(fail)) fail
//   else if (allChecks.every(skip)) fail
//   else pass
//
// а в `allChecks` входит `bundleShape` — «узнали формат пакета», который
// ставится в pass БЕЗУСЛОВНО. Значит достаточно узнать формат, чтобы
// `every(skip)` стало ложным и вердикт вышел «pass»: страница показывает
// «✅ Bundle verified offline» и рядом обещает «If the math passes, the
// certificate is authentic» — при том, что математика не считалась вовсе.
//
// Это ядро продукта: «доказательство переживёт AEVION» держится на том, что
// офлайн-проверка честна. Ложное «подлинно» здесь дороже любого падения.
import { describe, it, expect } from "vitest";
import { verifyAevionBundle } from "../verifyBundle";

/**
 * Пакет, который может собрать КТО УГОДНО: своё содержимое и честно
 * посчитанный SHA-256 от него. Подписей нет вовсе.
 *
 * Хеш содержимого самосогласован — он доказывает, что содержимое не менялось
 * ПОСЛЕ того, как хеш посчитали, но НЕ доказывает, что его заверял AEVION.
 * Заверение даёт подпись, а её здесь нет.
 */
async function selfMadeBundle(): Promise<any> {
  const inputs = {
    title: "Моя работа",
    description: "Текст, который я придумал сам",
    kind: "text",
    country: null,
    city: null,
  };
  const canonical = {
    description: inputs.description,
    kind: inputs.kind,
    title: inputs.title,
    country: null,
    city: null,
  };
  // Тот же порядок ключей, что у проверяющего: сортировка по имени.
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(canonical).sort()) sorted[k] = (canonical as any)[k];
  const bytes = new TextEncoder().encode(JSON.stringify(sorted));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const value = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    version: "2",
    certificate: {},
    proofs: { contentHash: { canonicalInputs: inputs, value } },
  };
}

describe("вердикт офлайн-проверки требует НАСТОЯЩЕЙ проверки", () => {
  it("самодельный пакет без подписей не может быть «verified»", async () => {
    const r = await verifyAevionBundle(await selfMadeBundle());
    // Контроль: хеш ДОЛЖЕН сойтись (иначе тест проверял бы не то), а подписей
    // нет вовсе — именно эту комбинацию и может собрать посторонний.
    expect(r.contentHash.status, "хеш не сошёлся — тест собран неверно").toBe("pass");
    expect(
      [r.aevionSignature.status, r.authorCosignature.status],
      "контроль: подписей в пакете нет",
    ).toEqual(["skip", "skip"]);
    expect(
      r.overall,
      "самодельный пакет объявлен подлинным: сошёлся только его собственный хеш",
    ).not.toBe("pass");
  });

  it("узнавание формата само по себе не вердикт", async () => {
    const r = await verifyAevionBundle(await selfMadeBundle());
    expect(r.bundleShape.status, "форму узнали — это ожидаемо").toBe("pass");
    expect(r.overall, "но одного узнавания формы мало").not.toBe("pass");
  });
});

// Плитка якоря — ТОЛЬКО проверка наличия: код прямо говорит «presence check
// only» и смотрит на поле `status`, а не на байты доказательства
// (`proofBase64`, они в пакете есть). Значит самодельный пакет может объявить
// себя заякоренным одной строкой.
//
// Тест закрепляет не «так должно быть», а то, ЧТО ИМЕННО мы утверждаем: если
// однажды байты начнут проверять по-настоящему, он покраснеет и заставит
// переписать формулировки на странице — а они сегодня обещают ровно столько,
// сколько проверка даёт.
describe("заверение платформы — единственный ключ не из пакета", () => {
  it("подпись чужим ключом не проходит", async () => {
    const b = await selfMadeBundle();
    const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const raw = "ab".repeat(32);
    const sig = await crypto.subtle.sign(
      { name: "Ed25519" },
      (kp as CryptoKeyPair).privateKey,
      new TextEncoder().encode(raw),
    );
    b.proofs.aevionEd25519 = { publicKeyRawHex: raw, signature: "00", signedPayload: "x" };
    b.proofs.platformAttestation = {
      kid: "qsign-ed25519-v1",
      signature: Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, "0")).join(""),
    };
    const r = await verifyAevionBundle(b);
    expect(
      r.platformAttestation.status,
      "подпись посторонним ключом принята за заверение платформы",
    ).toBe("fail");
    expect(r.overall).toBe("fail");
  });

  it("свой ключ, положенный В ЗАВЕРЕНИЕ, не принимается", async () => {
    // Главный смысл закрепления: ключ берётся ИЗ ВЕРИФИКАТОРА, а не из файла.
    // Подделыватель кладёт рядом свою открытую часть в надежде, что сверят
    // ею же. Без этого случая проверка не отличала бы закреплённый ключ от
    // приехавшего в пакете (проверено мутацией — она проходила).
    const b = await selfMadeBundle();
    const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const rawSpki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
    const theirRawHex = Array.from(rawSpki.slice(-32))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const certKeyHex = "ab".repeat(32);
    const sig = await crypto.subtle.sign(
      { name: "Ed25519" },
      kp.privateKey,
      new TextEncoder().encode(certKeyHex),
    );
    b.proofs.aevionEd25519 = { publicKeyRawHex: certKeyHex, signature: "00", signedPayload: "x" };
    b.proofs.platformAttestation = {
      kid: "qsign-ed25519-v1",
      publicKeyRawHex: theirRawHex, // ← ключ подделывателя, положенный в файл
      signature: Array.from(new Uint8Array(sig))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
    };
    const r = await verifyAevionBundle(b);
    expect(
      r.platformAttestation.status,
      "ключ взят из пакета, а не из верификатора — закрепление не работает",
    ).toBe("fail");
  });

  it("незнакомый kid — отказ, а не пропуск", async () => {
    const b = await selfMadeBundle();
    b.proofs.aevionEd25519 = { publicKeyRawHex: "cd".repeat(32), signature: "00", signedPayload: "x" };
    b.proofs.platformAttestation = { kid: "qsign-ed25519-v99", signature: "ef".repeat(64) };
    const r = await verifyAevionBundle(b);
    expect(
      r.platformAttestation.status,
      "подпись, которую нечем сверить, пропущена как безобидная",
    ).toBe("fail");
  });

  it("заверения нет — пропуск, и он объясняет почему это важно", async () => {
    const r = await verifyAevionBundle(await selfMadeBundle());
    expect(r.platformAttestation.status).toBe("skip");
    expect(String(r.platformAttestation.detail)).toMatch(/internal consistency/i);
  });
});
describe("граница проверки якоря названа честно", () => {
  it("чужое доказательство НЕ принимается", async () => {
    // Раньше плитка зеленела по одному полю `status`, и к пакету можно было
    // приложить любое доказательство. Теперь сверяется дайджест внутри байтов.
    const b = await selfMadeBundle();
    b.proofs.openTimestamps = {
      status: "bitcoin-confirmed",
      bitcoinBlockHeight: 999999,
      proofBase64: otsProofFor("ff".repeat(32)), // доказательство о ДРУГОМ документе
    };
    const r = await verifyAevionBundle(b);
    expect(
      r.bitcoinAnchor.status,
      "чужое доказательство выдано за якорь этого сертификата",
    ).toBe("fail");
  });

  it("своё доказательство принимается и текст называет, что осталось непроверенным", async () => {
    const b = await selfMadeBundle();
    b.proofs.openTimestamps = {
      status: "bitcoin-confirmed",
      bitcoinBlockHeight: 912345,
      proofBase64: otsProofFor(b.proofs.contentHash.value),
    };
    const r = await verifyAevionBundle(b);
    expect(r.bitcoinAnchor.status).toBe("pass");
    expect(String(r.bitcoinAnchor.detail)).toMatch(/commits to this document/i);
    // Честность важнее похвалы: включение в блок мы НЕ проверяем, и это должно
    // быть сказано прямо, иначе зелёная плитка обещает больше, чем даёт.
    expect(String(r.bitcoinAnchor.detail)).toMatch(/OpenTimestamps client/i);
  });

  it("доказательство дошло только до календаря — не засчитываем", async () => {
    // Пакет заявляет подтверждение биткойном, байты говорят иначе. Верить
    // надо байтам: поле пишем мы, а метку ставит календарь OpenTimestamps.
    const b = await selfMadeBundle();
    b.proofs.openTimestamps = {
      status: "bitcoin-confirmed",
      bitcoinBlockHeight: 912345,
      proofBase64: otsProofFor(b.proofs.contentHash.value, false),
    };
    const r = await verifyAevionBundle(b);
    expect(
      r.bitcoinAnchor.status,
      "заявление о блоке засчитано, хотя доказательство до блока не дошло",
    ).toBe("skip");
    expect(String(r.bitcoinAnchor.detail)).toMatch(/only a calendar attestation/i);
  });

  it("байтов нет вовсе — плитка зелёная, но говорит об этом", async () => {
    const b = await selfMadeBundle();
    b.proofs.openTimestamps = { status: "bitcoin-confirmed", bitcoinBlockHeight: 1 };
    const r = await verifyAevionBundle(b);
    expect(r.bitcoinAnchor.status).toBe("pass");
    expect(String(r.bitcoinAnchor.detail)).toMatch(/No \.ots proof bytes/i);
  });
});

/**
 * Собирает доказательство OpenTimestamps, фиксирующее заданный дайджест.
 * `withBitcoin` дописывает метку подтверждения биткойном — без неё
 * доказательство считается дошедшим только до календаря.
 */
function otsProofFor(hexDigest: string, withBitcoin = true): string {
  const magic = "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294";
  const BITCOIN_TAG = "0588960d73d71901";
  const hex = magic + "01" + "08" + hexDigest + (withBitcoin ? BITCOIN_TAG : "");
  const bytes = hex.match(/.{2}/g)!.map((h) => parseInt(h, 16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
