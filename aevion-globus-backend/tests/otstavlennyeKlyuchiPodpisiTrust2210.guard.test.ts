import { describe, test, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";

/*
 * 🔴 22.10.2026, утечка переменных Railway: закрытые ключи Ed25519 платформы (AEVION_TRUST_SIGN_SK /
 * QSKYWAY_SIGN_SK) подлежат замене. До этой правки verifySignedTrustScore сравнивал открытый ключ документа
 * только с живым ключом: после ротации каждый выданный ранее документ отвечал бы isPlatformKey: false —
 * «чужая подпись», что неправда. Теперь прежние ОТКРЫТЫЕ ключи перечислены в AEVION_RETIRED_SIGN_PKS
 * ("<spki-b64>@YYYY-MM-DD"), вердикт различает active / retired / foreign и называет дату отставки.
 *
 * Ключи грузятся при импорте модуля, поэтому окружение ставится ДО динамического import.
 */

const живой = crypto.generateKeyPairSync("ed25519");
const отставленный = crypto.generateKeyPairSync("ed25519");
const чужой = crypto.generateKeyPairSync("ed25519");
const pkcs8 = (k: crypto.KeyObject) => k.export({ type: "pkcs8", format: "der" }).toString("base64");
const spki = (k: crypto.KeyObject) => k.export({ type: "spki", format: "der" }).toString("base64");
const отпечаток = (k: crypto.KeyObject) =>
  crypto.createHash("sha256").update(k.export({ type: "spki", format: "der" })).digest("hex").slice(0, 16);

type Mod = typeof import("../src/lib/trustSignature");
let mod: Mod;

beforeAll(async () => {
  process.env.AEVION_TRUST_SIGN_SK = pkcs8(живой.privateKey);
  delete process.env.QSKYWAY_SIGN_SK;
  // одна годная запись, одна без даты (должна быть пропущена, а не уронить разбор)
  process.env.AEVION_RETIRED_SIGN_PKS = `${spki(отставленный.publicKey)}@2026-10-22, ${spki(чужой.publicKey)}`;
  mod = await import("../src/lib/trustSignature");
});

afterAll(() => {
  delete process.env.AEVION_TRUST_SIGN_SK;
  delete process.env.AEVION_RETIRED_SIGN_PKS;
});

/** Переподписать готовый документ другим ключом — так выглядит бумага, выданная до ротации. */
function переподписать(doc: ReturnType<Mod["signedTrustScore"]>, sk: crypto.KeyObject, pk: crypto.KeyObject) {
  const signature = crypto.sign(null, Buffer.from(doc.attestation.contentHash, "hex"), sk).toString("base64");
  return { ...doc, attestation: { ...doc.attestation, signature, publicKey: spki(pk), keyFingerprint: отпечаток(pk) } };
}

describe("ротация ключа подписи Trust Score: прежний ключ проверяется, но назван отставленным", () => {
  test("живой ключ: valid, isPlatformKey, keyStatus active, без даты отставки", () => {
    const doc = mod.signedTrustScore("2026-10-22T10:00:00.000Z");
    expect(doc.attestation.ephemeral).toBe(false);
    const v = mod.verifySignedTrustScore(doc);
    expect(v.valid).toBe(true);
    expect(v.isPlatformKey).toBe(true);
    expect(v.keyStatus).toBe("active");
    expect(v.retiredAt).toBeUndefined();
    expect(v.keyNote).toBeUndefined();
  });

  test("🔴 документ, подписанный отставленным ключом: valid, isPlatformKey, keyStatus retired + дата + оговорка", () => {
    const doc = переподписать(mod.signedTrustScore("2026-10-01T10:00:00.000Z"), отставленный.privateKey, отставленный.publicKey);
    const v = mod.verifySignedTrustScore(doc);
    expect(v.hashValid).toBe(true);
    expect(v.signatureValid).toBe(true);
    expect(v.valid).toBe(true);
    expect(v.isPlatformKey, "подпись прежним ключом платформы — это подпись платформы").toBe(true);
    expect(v.keyStatus).toBe("retired");
    expect(v.retiredAt).toBe("2026-10-22");
    expect(v.keyNote).toContain("2026-10-22");
  });

  test("КОНТРОЛЬ: чужой ключ (запись без даты отброшена) — подпись сходится со своим ключом, но это не платформа", () => {
    const doc = переподписать(mod.signedTrustScore("2026-10-01T10:00:00.000Z"), чужой.privateKey, чужой.publicKey);
    const v = mod.verifySignedTrustScore(doc);
    expect(v.signatureValid).toBe(true);
    expect(v.isPlatformKey).toBe(false);
    expect(v.keyStatus).toBe("foreign");
    expect(v.retiredAt).toBeUndefined();
  });

  test("КОНТРОЛЬ: подпорченная подпись отставленным ключом — signatureValid false, retired не присваивается", () => {
    const doc = переподписать(mod.signedTrustScore("2026-10-01T10:00:00.000Z"), отставленный.privateKey, отставленный.publicKey);
    const испорчен = { ...doc, attestation: { ...doc.attestation, signature: Buffer.from(doc.attestation.signature, "base64").map((b, i) => (i === 3 ? b ^ 0xff : b)).toString("base64") } };
    const v = mod.verifySignedTrustScore(испорчен);
    expect(v.signatureValid).toBe(false);
    expect(v.valid).toBe(false);
    // ключ в документе — отставленный ключ платформы, и это по-прежнему правда о ключе, не о подписи
    expect(v.keyStatus).toBe("retired");
  });

  test("публикация ключа: рядом с живым ключом перечислены отставленные с отпечатком и датой; закрытых частей нет", () => {
    const k = mod.trustSigningKey();
    expect(k.publicKey).toBe(spki(живой.publicKey));
    expect(k.retired).toHaveLength(1);
    expect(k.retired[0]).toEqual({ publicKey: spki(отставленный.publicKey), keyFingerprint: отпечаток(отставленный.publicKey), retiredAt: "2026-10-22" });
    expect(JSON.stringify(k)).not.toContain(pkcs8(живой.privateKey).slice(0, 24));
  });
});
