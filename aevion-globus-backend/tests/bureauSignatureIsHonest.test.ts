import { describe, test, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { signNotarization } from "../src/routes/bureau";

/**
 * Сертификат обязан называть, ЧЕМ он подписан.
 *
 * До 19.08.2026 подпись нотаризации считалась так:
 *
 *     crypto.createHmac("sha256", notary.publicKeyEd25519 || "demo-key")
 *
 * то есть ключом служил ПУБЛИЧНЫЙ ключ нотариуса. Пересчитать значение мог кто
 * угодно — certId, contentHash и открытый ключ суть открытые данные. Свойства
 * «подписать мог только держатель закрытого ключа» не было вовсе.
 *
 * Хуже самого дефекта было то, что такая подпись НЕОТЛИЧИМА от настоящей для
 * того, кто читает сертификат. Поэтому первый тест здесь — не про криптографию,
 * а про честность: режим всегда назван своим именем.
 */

const KEY = "BUREAU_NOTARY_SIGNING_KEY";
let saved: string | undefined;

beforeEach(() => {
  saved = process.env[KEY];
  delete process.env[KEY];
});
afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
});

describe("подпись нотаризации называет себя", () => {
  test("без ключа режим честно помечен демонстрационным", () => {
    const r = signNotarization("cert-1:hash-1", "pubkey-of-notary");
    expect(r.algorithm).toBe("demo-hmac-sha256");
  });

  test("демо-режим и правда воспроизводим посторонним — поэтому и помечен", () => {
    // Не «проверка ради проверки»: этот тест фиксирует ПРИЧИНУ пометки. Если
    // однажды демо-режим станет невоспроизводимым, пометку можно будет
    // пересмотреть, и тест об этом напомнит, покраснев.
    const pub = "pubkey-of-notary";
    const mine = signNotarization("cert-1:hash-1", pub);
    const forgedByAnyone = crypto
      .createHmac("sha256", pub)
      .update("cert-1:hash-1")
      .digest("hex");
    expect(mine.signature).toBe(forgedByAnyone);
  });

  test("с закрытым ключом подпись становится настоящей Ed25519", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    process.env[KEY] = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();

    const payload = "cert-2:hash-2";
    const r = signNotarization(payload, "pubkey-of-notary");
    expect(r.algorithm).toBe("ed25519");

    // Главное свойство: проверяется ОТКРЫТЫМ ключом, а подделать без закрытого
    // нельзя. Ради этого всё и затевалось.
    const ok = crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      publicKey,
      Buffer.from(r.signature, "base64"),
    );
    expect(ok).toBe(true);
  });

  test("настоящая подпись не проходит проверку чужим ключом", () => {
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const { publicKey: strangerKey } = crypto.generateKeyPairSync("ed25519");
    process.env[KEY] = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();

    const payload = "cert-3:hash-3";
    const r = signNotarization(payload, null);
    const ok = crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      strangerKey,
      Buffer.from(r.signature, "base64"),
    );
    expect(ok).toBe(false);
  });

  test("подпись привязана к содержимому: другой payload — другая подпись", () => {
    const a = signNotarization("cert-4:hash-A", null);
    const b = signNotarization("cert-4:hash-B", null);
    expect(a.signature).not.toBe(b.signature);
  });
});
