import { describe, expect, it } from "vitest";
import {
  buildIntegrityChecks,
  deriveVerdict,
  verdictCopy,
  type VerdictInput,
} from "./integrityVerdict";

/**
 * Свежий сертификат: всё сошлось, все слои на месте.
 * Каждый тест портит РОВНО ОДНО поле — иначе непонятно, что именно проверено.
 */
function healthy(): VerdictInput {
  return {
    integrityVerified: true,
    certificate: { status: "active" },
    integrity: {
      contentHashValid: true,
      signatureHmacValid: true,
      signatureHmacReason: "OK",
      qsignKeyVersion: 2,
      currentKeyVersion: 2,
      keyRotatedSinceSigning: false,
      quantumShieldStatus: "active",
      shieldLegacy: false,
      shards: 3,
      threshold: 2,
      authorCosign: { present: true, valid: true, fingerprint: "ab12cd34" },
    },
  };
}

/** Апрельская выдача: ничего не сломано, но соподписи автора ещё не было. */
function legacy(): VerdictInput {
  const d = healthy();
  d.integrity.authorCosign = { present: false };
  return d;
}

const verdictOf = (d: VerdictInput) =>
  deriveVerdict(buildIntegrityChecks(d), d.integrityVerified);

describe("контроль: здоровый сертификат проходит", () => {
  it("все плитки зелёные и вердикт verified", () => {
    const checks = buildIntegrityChecks(healthy());
    expect(checks.every((c) => c.status)).toBe(true);
    expect(verdictOf(healthy())).toBe("verified");
  });

  it("плиток семь — перечень не усох незаметно", () => {
    // Список закреплён целиком: пропажа оси иначе прошла бы молча,
    // а «ось, которую не показали» читается человеком как «сошлась».
    expect(buildIntegrityChecks(healthy()).map((c) => c.label)).toEqual([
      "Content Hash",
      "HMAC Signature",
      "HMAC Key Version",
      "Quantum Shield",
      "Secret Sharing",
      "Author Co-Signature",
      "Certificate Status",
    ]);
  });
});

describe("сломанное сейчас — это предупреждение", () => {
  const broken: Array<[string, (d: VerdictInput) => void]> = [
    ["хеш содержимого не сошёлся", (d) => { d.integrity.contentHashValid = false; }],
    ["подпись HMAC не пересчиталась", (d) => {
      d.integrity.signatureHmacValid = false;
      d.integrity.signatureHmacReason = "MISMATCH";
    }],
    ["ошибка при проверке подписи", (d) => {
      d.integrity.signatureHmacValid = false;
      d.integrity.signatureHmacReason = "ERROR";
    }],
    ["щит не активен", (d) => { d.integrity.quantumShieldStatus = "revoked"; }],
    ["сертификат отозван", (d) => { d.certificate.status = "revoked"; }],
    ["соподпись автора ЕСТЬ и не сходится", (d) => {
      d.integrity.authorCosign = { present: true, valid: false, fingerprint: "beef" };
    }],
  ];

  it.each(broken)("%s → warning", (_name, breakIt) => {
    const d = healthy();
    breakIt(d);
    expect(verdictOf(d)).toBe("warning");
  });

  it("подпись не сошлась — баннер НЕ обещает, что сошлись все слои", () => {
    // Именно этот случай страница показывала зелёным до 27.08.2026:
    // allChecksPass смотрел на хеш и щит, подпись в расчёт не входила.
    const d = healthy();
    d.integrity.signatureHmacValid = false;
    d.integrity.signatureHmacReason = "MISMATCH";
    expect(verdictOf(d)).toBe("warning");
    expect(verdictCopy(verdictOf(d)).body).not.toMatch(/every cryptographic layer/i);
  });
});

describe("возраст записи — не поломка", () => {
  it("нет соподписи автора → verified-legacy, а не warning", () => {
    expect(verdictOf(legacy())).toBe("verified-legacy");
  });

  it("нет signedAt → плитки подписи серые, вердикт не падает в warning", () => {
    const d = legacy();
    d.integrity.signatureHmacValid = null;
    d.integrity.signatureHmacReason = "NO_SIGNED_AT";
    const checks = buildIntegrityChecks(d);
    const hmac = checks.filter((c) => c.label.startsWith("HMAC"));
    expect(hmac).toHaveLength(2);
    expect(hmac.every((c) => c.tier === "era")).toBe(true);
    expect(verdictOf(d)).toBe("verified-legacy");
  });

  it("старый щит без настоящего Шамира → возраст, пока щит активен", () => {
    const d = legacy();
    d.integrity.shieldLegacy = true;
    expect(verdictOf(d)).toBe("verified-legacy");
    // Но неактивный щит — это уже сейчас, а не возраст.
    d.integrity.quantumShieldStatus = "revoked";
    expect(verdictOf(d)).toBe("warning");
  });

  it("текст legacy не обещает «все слои», но и не пугает", () => {
    const copy = verdictCopy("verified-legacy");
    expect(copy.body).not.toMatch(/every cryptographic layer/i);
    expect(copy.title).toBe("Certificate Verified");
    expect(copy.icon).not.toBe("⚠️");
  });
});

describe("баннер не имеет права обещать больше сервера", () => {
  it("сервер сказал «целостность не подтверждена» → warning при зелёных плитках", () => {
    const d = healthy();
    d.integrityVerified = false;
    expect(buildIntegrityChecks(d).every((c) => c.status)).toBe(true);
    expect(verdictOf(d)).toBe("warning");
  });

  it("сервер промолчал (старая сборка) — это не отказ", () => {
    const d = healthy();
    delete d.integrityVerified;
    expect(verdictOf(d)).toBe("verified");
  });

  it("сервер сказал «подтверждено» — красная плитка от этого не зеленеет", () => {
    const d = healthy();
    d.integrityVerified = true;
    d.integrity.contentHashValid = false;
    expect(verdictOf(d)).toBe("warning");
  });
});

describe("обещание баннера сходится с плитками — по всем трём вердиктам", () => {
  it("«every cryptographic layer» произносится ТОЛЬКО когда зелены все плитки", () => {
    const cases: Array<[VerdictInput, boolean]> = [
      [healthy(), true],
      [legacy(), false],
      [(() => { const d = healthy(); d.integrity.contentHashValid = false; return d; })(), false],
    ];
    for (const [d, mayPromise] of cases) {
      const checks = buildIntegrityChecks(d);
      const promises = /every cryptographic layer/i.test(
        verdictCopy(deriveVerdict(checks, d.integrityVerified)).body,
      );
      expect(promises).toBe(mayPromise);
      // Инвариант, ради которого всё и переписано: обещание про все слои
      // не может стоять над плиткой, которая не зелёная.
      if (promises) expect(checks.every((c) => c.status)).toBe(true);
    }
  });
});
