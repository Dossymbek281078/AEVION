// Проверка чека: три вердикта, а не два.
//
// Ручка принимает и целиком скачанный файл `{receipt, hash, signature}`, и
// голый чек. На голом сравнивать не с чем — и страница переводила это в
// заголовок «Хеш НЕ сходится — содержимое изменено». То есть человеку,
// принёсшему подлинный документ в заявленном же формате, инструмент проверки
// говорил, что документ подделан.
//
// Для проверяющего инструмента это худший вид ошибки: он не молчит и не
// сомневается, он оговаривает — а у оговорённого нет способа возразить.
// Поэтому три состояния зафиксированы тестом.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import VerifyReceiptPage from "./page";

const SPEC = { canonicalization: "RFC8785", digest: "sha256", signature: "ed25519" };
const HASH = "a".repeat(64);

function mockVerify(hashMatches: boolean | null) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      hashMatches,
      computedHash: HASH,
      signature: "absent",
      signatureNote: hashMatches === null ? "хеш к нему не приложен" : "чек не подписан",
      spec: SPEC,
    }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

async function submitReceipt() {
  const area = screen.getByPlaceholderText(/Перетащите файл чека/);
  fireEvent.change(area, { target: { value: JSON.stringify({ panel: [], cost: {} }) } });
  fireEvent.click(screen.getByText("Проверить"));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Проверка чека — вердикты", () => {
  test("хеш сходится — говорим, что содержимое не изменено", async () => {
    mockVerify(true);
    render(<VerifyReceiptPage />);
    await submitReceipt();

    expect(await screen.findByText(/Хеш сходится/)).toBeTruthy();
    expect(screen.queryByText(/содержимое изменено/)).toBeNull();
  });

  test("хеш не сходится — прямо говорим о подмене", async () => {
    mockVerify(false);
    render(<VerifyReceiptPage />);
    await submitReceipt();

    expect(await screen.findByText(/Хеш НЕ сходится/)).toBeTruthy();
  });

  test("хеша нет — НЕ обвиняем, а объясняем, что сравнивать не с чем", async () => {
    mockVerify(null);
    render(<VerifyReceiptPage />);
    await submitReceipt();

    expect(await screen.findByText(/Хеш не приложен/)).toBeTruthy();
    // Ключевое: ни слова про изменённое содержимое. Именно это раньше и
    // выводилось подлинному чеку.
    expect(screen.queryByText(/содержимое изменено/)).toBeNull();
    expect(screen.queryByText(/Хеш НЕ сходится/)).toBeNull();
  });

  test("во всех трёх случаях показан пересчитанный хеш — человеку есть что сверить", async () => {
    for (const state of [true, false, null] as Array<boolean | null>) {
      mockVerify(state);
      const { unmount } = render(<VerifyReceiptPage />);
      await submitReceipt();
      expect(await screen.findByText(new RegExp(HASH))).toBeTruthy();
      unmount();
    }
  });
});
