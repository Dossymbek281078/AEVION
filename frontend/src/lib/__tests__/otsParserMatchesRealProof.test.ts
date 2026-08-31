// Контроль на НАСТОЯЩЕМ доказательстве, снятом с прода 29.08.2026
// (сертификат cert-c597672d2aab5cd1). Синтетика проверяет мой разбор против
// моей же сборки — то есть договорённость с самим собой. Живые байты
// проверяют её против того, что реально выпускает OpenTimestamps.
import { describe, it, expect } from "vitest";
import { verifyAevionBundle } from "../verifyBundle";

const REAL_PROOF_B64 = "AE9wZW5UaW1lc3RhbXBzAABQcm9vZgC/ieLohOiSlAEIxq5rEgdouW+Vs8Jns907xMHQCEqJDLJvQN1aW1O2IqDwENkEts31dLsyhawUFmd670AI//AIlJjALtpJ3gsI8BAH8NpPqCFcoXict+n+qSa5CPAgh/atEqc2Feokhemo67+jssf+VstvU0rZ6Cj+BSDHsCAI8CAXZLvjKWYCR8tRymc5TouwsUl4/73f0yj8kJOIzU5InAjxBGqQeR/wCChzObOLLzf7AIPf4w0u+QyOLi1odHRwczovL2FsaWNlLmJ0Yy5jYWxlbmRhci5vcGVudGltZXN0YW1wcy5vcmf/8Ag+ff1wF14PwwjwINTzpvsNf2TVwKfjaitDhUMkyrJr6jBRST9sgBr5naaaCPAQMhe6koUz9K3WEPHj2XYbkQjxILG9nK9847mZG2IoNlDdCLP2YjiF426Hv9YIC3Bc4NIVCPEEapB5HvAIK9KnNst1HhwAg9/jDS75DI4sK2h0dHBzOi8vYm9iLmJ0Yy5jYWxlbmRhci5vcGVudGltZXN0YW1wcy5vcmf/8BCnH67zyjiviKV5Rbn/IoCqCPAglcOIcIaxKMdEj0YWCrHzcb+xQngguqd+xCX5CDpKviAI8CAup87VJGtnijC88QpG4lElXONUqdYStEEk5XQgT7YMVwjxBGqQeR/wCEgC7/tnF9GzAIPf4w0u+QyOKShodHRwczovL2Zpbm5leS5jYWxlbmRhci5ldGVybml0eXdhbGwuY29t8BA8qCAZYZHzFB+eIoHwLUW8CPEEapB5HvAICMY74aGOCvEAg9/jDS75DI4jImh0dHBzOi8vYnRjLmNhbGVuZGFyLmNhdGFsbGF4eS5jb20=";
const REAL_CONTENT_HASH = "c6ae6b120768b96f95b3c267b3dd3bc4c1d0084a890cb26f40dd5a5b53b622a0";

describe("разбор доказательства сходится с живыми байтами", () => {
  it("настоящее доказательство признаётся относящимся к своему документу", async () => {
    const r = await verifyAevionBundle({
      version: "2",
      certificate: {},
      proofs: {
        contentHash: { value: REAL_CONTENT_HASH, canonicalInputs: {} },
        openTimestamps: {
          status: "bitcoin-confirmed",
          bitcoinBlockHeight: 912345,
          proofBase64: REAL_PROOF_B64,
        },
      },
    } as never);
    // Настоящее доказательство этого сертификата ещё НЕ дошло до блока: в нём
    // метка календаря, биткойновой нет (проверено на байтах).
    //
    // ⚠️ Точности ради: на проде у этого сертификата статус ТОЖЕ `pending`,
    // никакого расхождения там нет. Заявление `bitcoin-confirmed` подставлено
    // ЗДЕСЬ, чтобы проверить поведение при расхождении. Живые байты ценны тем,
    // что они настоящие, — а не тем, что прод якобы врёт.
    expect(r.bitcoinAnchor.status).toBe("skip");
    expect(String(r.bitcoinAnchor.detail)).toMatch(/only a calendar attestation/i);
  });

  it("то же доказательство при ДРУГОМ хеше отвергается", async () => {
    const r = await verifyAevionBundle({
      version: "2",
      certificate: {},
      proofs: {
        contentHash: { value: "ff".repeat(32), canonicalInputs: {} },
        openTimestamps: {
          status: "bitcoin-confirmed",
          proofBase64: REAL_PROOF_B64,
        },
      },
    } as never);
    expect(r.bitcoinAnchor.status).toBe("fail");
  });
});
