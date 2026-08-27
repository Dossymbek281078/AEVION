// Страница действительно ЧИТАЕТ вердикт, а не считает его заново рядом.
//
// Логику вердикта проверяет integrityVerdict.test.ts — там 17 тестов и
// мутационная матрица. Здесь один вопрос, которого чистые тесты не касаются:
// доехал ли вердикт до экрана. Класс известный — «правда останавливается на
// границе»: поле в ответе есть, расчёт верен, а страница показывает своё.

import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "AEV-TEST-0001" }),
}));

import VerifyPage from "./page";

/** Ответ ручки /api/pipeline/verify/:certId в форме, которую отдаёт прод. */
function reply(over: {
  integrityVerified?: boolean;
  contentHashValid?: boolean;
  cosignPresent?: boolean;
}) {
  return {
    valid: true,
    verified: true,
    ...(over.integrityVerified === undefined
      ? {}
      : { integrityVerified: over.integrityVerified }),
    verifiedAt: "2026-08-27T10:00:00.000Z",
    certificate: {
      id: "AEV-TEST-0001",
      objectId: "obj-1",
      title: "Степной рассвет",
      kind: "photo",
      description: "фотография",
      author: "Автор",
      contentHash: "a".repeat(64),
      signatureHmac: "b".repeat(64),
      algorithm: "SHA-256",
      protectedAt: "2026-04-01T10:00:00.000Z",
      status: "active",
    },
    integrity: {
      contentHashValid: over.contentHashValid ?? true,
      signatureHmacValid: true,
      signatureHmacReason: "OK",
      qsignKeyVersion: 2,
      currentKeyVersion: 2,
      keyRotatedSinceSigning: false,
      quantumShieldStatus: "active",
      shieldLegacy: false,
      shards: 3,
      threshold: 2,
      authorCosign: over.cosignPresent
        ? { present: true, valid: true, fingerprint: "ab12cd34" }
        : { present: false },
    },
    legalBasis: {
      framework: "Berne",
      type: "copyright",
      international: [],
      digitalSignature: [],
      disclaimer: "—",
    },
    stats: { verifiedCount: 1, lastVerifiedAt: "2026-08-27T10:00:00.000Z" },
  };
}

function stubFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("вердикт доезжает до баннера", () => {
  test("контроль: всё сошлось — баннер обещает совпадение всех слоёв", async () => {
    stubFetch(reply({ integrityVerified: true, cosignPresent: true }));
    render(<VerifyPage />);
    await waitFor(() =>
      expect(screen.getByText("Certificate Verified")).toBeTruthy(),
    );
    expect(
      screen.getByText(/every cryptographic layer matches/i),
    ).toBeTruthy();
  });

  test("апрельский сертификат: подтверждён, но без обещания «все слои»", async () => {
    // Соподписи автора у него нет — слоя не существовало в момент выдачи.
    stubFetch(reply({ integrityVerified: true, cosignPresent: false }));
    render(<VerifyPage />);
    await waitFor(() =>
      expect(screen.getByText("Certificate Verified")).toBeTruthy(),
    );
    expect(screen.queryByText(/every cryptographic layer matches/i)).toBeNull();
    expect(screen.getByText(/did not exist yet/i)).toBeTruthy();
  });

  test("хеш не сошёлся — предупреждение, а не зелёный баннер", async () => {
    stubFetch(
      reply({ integrityVerified: false, contentHashValid: false, cosignPresent: true }),
    );
    render(<VerifyPage />);
    await waitFor(() =>
      expect(screen.getByText("Verification Warning")).toBeTruthy(),
    );
    expect(screen.queryByText(/every cryptographic layer matches/i)).toBeNull();
    expect(screen.getByText("Hash mismatch")).toBeTruthy();
  });

  test("сервер не подтвердил целостность — баннер не обещает больше него", async () => {
    // Все плитки зелёные, но сервер говорит «нет». Расхождение показывается
    // предупреждением, а не молча решается в пользу красивого ответа.
    stubFetch(reply({ integrityVerified: false, cosignPresent: true }));
    render(<VerifyPage />);
    await waitFor(() =>
      expect(screen.getByText("Verification Warning")).toBeTruthy(),
    );
  });
});
