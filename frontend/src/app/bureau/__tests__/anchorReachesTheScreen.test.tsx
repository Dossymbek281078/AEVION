// Поле в ответе есть, а на экране его нет — отдельный класс ошибки, и он тише
// отсутствующего поля: тест чистой функции зелёный, ответ API правильный, а
// человек по-прежнему ничего не видит. Поэтому здесь проверяется РЕНДЕР.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./../page";

const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

const CERT = (anchor: unknown) => ({
  id: "cert-screen-0001",
  title: "Степной рассвет",
  kind: "photo",
  author: "Досымбек",
  location: "Астана, KZ",
  contentHash: "b".repeat(64),
  fileHash: null,
  algorithm: "sha256",
  protectedAt: "2026-08-01T00:00:00.000Z",
  verifiedCount: 2,
  shieldId: null,
  verifyUrl: "https://aevion.app/verify/cert-screen-0001",
  ...(anchor === undefined ? {} : { bitcoinAnchor: anchor }),
});

function stubRegistry(anchor: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/pipeline/certificates")) {
        return { ok: true, status: 200, json: async () => ({ certificates: [CERT(anchor)], total: 1 }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("состояние якоря доезжает до экрана реестра", () => {
  test("подтверждённый якорь виден с номером блока", async () => {
    stubRegistry({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 });
    renderPage();
    await waitFor(() => expect(screen.queryByText(/912345/)).not.toBeNull());
  });

  test("«готовится» и «не будет» видны по-разному", async () => {
    stubRegistry({ status: "pending", bitcoinBlockHeight: null });
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.queryByText(/anchoring/i)).not.toBeNull());
    expect(screen.queryByText(/no Bitcoin anchor/i)).toBeNull();
    unmount();

    stubRegistry({ status: "not_stamped", bitcoinBlockHeight: null });
    renderPage();
    await waitFor(() => expect(screen.queryByText(/no Bitcoin anchor/i)).not.toBeNull());
  });

  test("бэкенд поля не прислал — на экране НЕТ пометки «без якоря»", async () => {
    // Пока бэкенд не выкачен, поля нет у всех записей. Пометка «no Bitcoin
    // anchor» на всей витрине была бы ложью от собственной неосведомлённости.
    stubRegistry(undefined);
    renderPage();
    await screen.findByText("Степной рассвет");
    expect(screen.queryByText(/no Bitcoin anchor/i)).toBeNull();
    expect(screen.queryByText(/anchoring/i)).toBeNull();
    expect(screen.queryByText(/Bitcoin #/i)).toBeNull();
  });
});
