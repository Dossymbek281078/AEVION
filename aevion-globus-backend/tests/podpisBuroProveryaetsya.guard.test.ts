import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  razobratKlyuch,
  sostoyanieKlyucha,
  podpisat,
  proverit,
  ПЕРЕМЕННАЯ_КЛЮЧА,
  АЛГОРИТМ,
  АЛГОРИТМ_ДЕМО,
} from "../src/lib/bureauNotaryKey";

/**
 * 🔴 ПОДПИСЬ БЮРО ОБЯЗАНА ПРОВЕРЯТЬСЯ — ИНАЧЕ ЭТО НЕ ДОКАЗАТЕЛЬСТВО.
 *
 * Замер 12.10.2026: открытый ключ платформы не публиковался нигде, а
 * проверяльщика подписи нотариуса не было вовсе. Включить ключ значило
 * написать в сертификате «ed25519» — слово, которое не может проверить никто,
 * включая нас. Бюро продаётся за доказуемость, поэтому подпись и проверка
 * едут одной волной, и этот сторож держит именно ПРОВЕРЯЕМОСТЬ.
 */
function параКлючей() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    закрытый: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    открытый: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

const было = process.env[ПЕРЕМЕННАЯ_КЛЮЧА];
beforeEach(() => { delete process.env[ПЕРЕМЕННАЯ_КЛЮЧА]; });
afterEach(() => { if (было === undefined) delete process.env[ПЕРЕМЕННАЯ_КЛЮЧА]; else process.env[ПЕРЕМЕННАЯ_КЛЮЧА] = было; });

describe("разбор ключа", () => {
  it("🔴 три исхода, а не два — знаменатель 3 из 3", () => {
    const { закрытый } = параКлючей();
    // 1) переменной нет → честный демо-режим
    expect(razobratKlyuch(undefined).режим).toBe("demo");
    expect(razobratKlyuch("   ").режим).toBe("demo");
    // 2) ключ годный → ed25519, и есть что публиковать
    const г = razobratKlyuch(закрытый);
    expect(г.режим).toBe("ed25519");
    expect(г.otkrytyKlyuchPem, "нечего публиковать — проверить подпись будет нечем").toContain("BEGIN PUBLIC KEY");
    expect(г.idKlyucha, "опознаватель ключа не вычислен").toMatch(/^[0-9a-f]{16}$/);
    // 3) 🔴 ключ задан, но негодный → «сломан», А НЕ тихий демо-режим.
    // Тихо свести к демо значило бы: человек ключ задать ХОТЕЛ, а мы молча
    // подписываем демонстрационным HMAC — настройка выглядит работающей.
    const п = razobratKlyuch("-----BEGIN PRIVATE KEY-----\nне ключ\n-----END PRIVATE KEY-----");
    expect(п.режим).toBe("сломан");
    expect(п.pochemu, "причина поломки не названа").toBeTruthy();
    expect(п.otkrytyKlyuchPem).toBeNull();
  });

  it("🔴 ключ ДРУГОГО алгоритма не выдаётся за ed25519", () => {
    const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
      .privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const с = razobratKlyuch(rsa);
    expect(с.режим, "RSA-ключ принят как ed25519").toBe("сломан");
    expect(String(с.pochemu)).toContain("rsa");
  });

  it("опознаватель ключа РАЗНЫЙ у разных ключей и постоянный у одного", () => {
    // Иначе проверка не переживёт смену ключа: старые подписи станут
    // «неверными», хотя они верны своим ключом.
    const a = параКлючей(), b = параКлючей();
    const ia = razobratKlyuch(a.закрытый).idKlyucha;
    expect(ia).toBe(razobratKlyuch(a.закрытый).idKlyucha);
    expect(ia).not.toBe(razobratKlyuch(b.закрытый).idKlyucha);
  });
});

describe("подпись и её проверка", () => {
  it("🔴 настоящая подпись проверяется ОПУБЛИКОВАННЫМ открытым ключом", () => {
    const { закрытый } = параКлючей();
    process.env[ПЕРЕМЕННАЯ_КЛЮЧА] = закрытый;
    const с = sostoyanieKlyucha();
    const п = podpisat("cert-1:abc123");
    expect(п.algorithm).toBe(АЛГОРИТМ);
    expect(п.keyId, "подпись без опознавателя ключа не переживёт смену ключа").toBe(с.idKlyucha);
    // Главное свойство всей волны: третья сторона может проверить сама.
    const пр = proverit({ payload: "cert-1:abc123", signature: п.signature, algorithm: п.algorithm, otkrytyKlyuchPem: с.otkrytyKlyuchPem });
    expect(пр.ok, `проверка не сошлась: ${пр.pochemu}`).toBe(true);
  });

  it("🔴 ПОДМЕНА не проходит — знаменатель 4 из 4", () => {
    const { закрытый } = параКлючей();
    process.env[ПЕРЕМЕННАЯ_КЛЮЧА] = закрытый;
    const с = sostoyanieKlyucha();
    const п = podpisat("cert-1:abc123");
    const чужой = параКлючей().открытый;
    const подмены: Array<[string, { payload: string; signature: string; algorithm: string; otkrytyKlyuchPem: string | null }]> = [
      ["другое содержимое", { payload: "cert-1:ПОДМЕНЕНО", signature: п.signature, algorithm: п.algorithm, otkrytyKlyuchPem: с.otkrytyKlyuchPem }],
      ["другая подпись", { payload: "cert-1:abc123", signature: podpisat("другое").signature, algorithm: п.algorithm, otkrytyKlyuchPem: с.otkrytyKlyuchPem }],
      ["чужой открытый ключ", { payload: "cert-1:abc123", signature: п.signature, algorithm: п.algorithm, otkrytyKlyuchPem: чужой }],
      ["мусор вместо подписи", { payload: "cert-1:abc123", signature: "не подпись", algorithm: п.algorithm, otkrytyKlyuchPem: с.otkrytyKlyuchPem }],
    ];
    for (const [почему, вход] of подмены) {
      expect(proverit(вход).ok, "подмена прошла проверку: " + почему).toBe(false);
    }
    expect(подмены.length, "знаменатель: видов подмены проверено").toBe(4);
  });

  it("🔴 демонстрационная подпись проверку НЕ проходит никогда", () => {
    /*
     * HMAC проверяется знанием секрета — то есть «проверить» его может только
     * тот, кто может его и подделать. Называть это проверкой значит обманывать
     * покупателя ровно в том свойстве, за которое он платит.
     */
    const п = podpisat("cert-1:abc123");
    expect(п.algorithm).toBe(АЛГОРИТМ_ДЕМО);
    expect(п.keyId).toBeNull();
    const { открытый } = параКлючей();
    const пр = proverit({ payload: "cert-1:abc123", signature: п.signature, algorithm: п.algorithm, otkrytyKlyuchPem: открытый });
    expect(пр.ok).toBe(false);
    /*
     * Проверяем и ПРИЧИНУ, а не только исход. Мутация показала, почему:
     * убери явный отказ по алгоритму — демо-подпись всё равно не сойдётся,
     * просто потому что hex не разобрался как base64. Отказ «по случайности»
     * держится до первого совпадения форматов, а звучит так же уверенно.
     */
    expect(String(пр.pochemu), "отказ не назвал причиной алгоритм").toContain(АЛГОРИТМ_ДЕМО);
  });

  it("негодный ключ не превращает подпись в «настоящую»", () => {
    process.env[ПЕРЕМЕННАЯ_КЛЮЧА] = "-----BEGIN PRIVATE KEY-----\nне ключ\n-----END PRIVATE KEY-----";
    expect(sostoyanieKlyucha().режим).toBe("сломан");
    const п = podpisat("cert-1:abc123");
    expect(п.algorithm, "сломанный ключ выдал подпись за настоящую").toBe(АЛГОРИТМ_ДЕМО);
  });
});
