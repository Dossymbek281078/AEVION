import { describe, it, expect } from "vitest";
import { verdictOf } from "../verify/verdict";

/**
 * Вердикт публичной проверки чека не должен называть подделку подлинной.
 *
 * Найдено 28.07 прогоном на настоящей ручке `/api/multichat/receipt/verify`:
 * чек, сочинённый с нуля (выдуманный conversationId, выдуманные хеши ответов),
 * получает `hashMatches: true`. Это не дефект хеширования — хеш считается от
 * того же файла, который проверяют, поэтому у любой самосогласованной подделки
 * он сходится по определению. Ручку даже не надо обманывать: она сама отдаёт
 * `computedHash`, который остаётся подставить в поле `hash`.
 *
 * Дефект был в подаче: заголовок красился по одному `hashMatches` и гласил
 * «содержимое не изменено». Худший случай — подделка ПОДПИСАННОГО чека с
 * пересчитанным хешем: крупный зелёный заголовок «содержимое не изменено» и
 * мелкая строка «Подпись: НЕ действительна» под ним. Пользователь читает
 * заголовок.
 *
 * Почему это важнее обычного UI-огреха: предъявляемость чека — единственное,
 * чем консилиум AEVION отличается от Perplexity Model Council (см. память
 * project_competitive_honest_2026_07_28). Проверка, зеленеющая на подделке,
 * обнуляет ровно этот пункт.
 */

const base = {
  computedHash: "a".repeat(64),
  signatureNote: null,
  spec: { canonicalization: "RFC8785", digest: "sha256", signature: "ed25519" },
};

describe("вердикт проверки чека", () => {
  it("зелёный ТОЛЬКО при действительной подписи", () => {
    const v = verdictOf({ ...base, hashMatches: true, signature: "valid" });
    expect(v.tone).toBe("good");
    expect(v.title).toMatch(/подлинн/i);
  });

  it("сочинённый чек без подписи НЕ зелёный, хотя хеш сходится", () => {
    const v = verdictOf({ ...base, hashMatches: true, signature: "absent" });
    expect(v.tone).not.toBe("good");
    // Пользователю должно быть сказано, что подделать такой чек может кто угодно,
    // а не только что «хеш сошёлся».
    expect(v.title).toMatch(/происхождение не подтверждено/i);
    expect(v.detail).toMatch(/кто угодно/i);
  });

  it("подделка подписанного чека с пересчитанным хешем — красная, а не зелёная", () => {
    // Самый опасный случай: hashMatches истинно, потому что подделыватель
    // пересчитал хеш, и только подпись выдаёт подмену.
    const v = verdictOf({ ...base, hashMatches: true, signature: "invalid" });
    expect(v.tone).toBe("bad");
    expect(v.title).toMatch(/недействительна/i);
  });

  it("нерешаемый ключ не выдаётся за подтверждение", () => {
    const v = verdictOf({ ...base, hashMatches: true, signature: "unverifiable" });
    expect(v.tone).toBe("warn");
    expect(v.title).toMatch(/не подтверждено/i);
  });

  it("несовпадение хеша перекрывает любую подпись", () => {
    for (const signature of ["valid", "invalid", "absent", "unverifiable"] as const) {
      const v = verdictOf({ ...base, hashMatches: false, signature });
      expect(v.tone, `подпись=${signature}`).toBe("bad");
    }
  });

  it("ни один вердикт не утверждает «содержимое не изменено» без действительной подписи", () => {
    // Формулировка из прежней версии страницы: она и была неверной.
    for (const signature of ["absent", "invalid", "unverifiable"] as const) {
      const v = verdictOf({ ...base, hashMatches: true, signature });
      expect(`${v.title} ${v.detail}`, `подпись=${signature}`).not.toMatch(
        /содержимое не изменено/i,
      );
    }
  });
});
