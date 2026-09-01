// Седьмая поверхность: публичная страница автора. Он показывает её миру
// наравне со страницей самой работы, а про якорь она не говорила ничего.
//
// Проверяется именно РЕНДЕР: чистый модуль пометки уже покрыт своими тестами,
// а здесь один вопрос — доехало ли поле до экрана. Класс известный: правда
// останавливается на границе API.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "dosymbek" }),
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau/author/dosymbek",
}));

import AuthorPage from "../[slug]/page";

function profile(anchor: unknown) {
  return {
    slug: "dosymbek",
    name: "Досымбек",
    stats: {
      certificates: 1,
      verifications: 2,
      countries: ["KZ"],
      firstProtectedAt: "2026-08-01T00:00:00.000Z",
      lastProtectedAt: "2026-08-01T00:00:00.000Z",
      byKind: [{ kind: "photo", count: 1 }],
    },
    certificates: [
      {
        id: "cert-author-0001",
        objectId: "cert-author-0001",
        title: "Степной рассвет",
        kind: "photo",
        description: "фотография",
        authorName: "Досымбек",
        country: "KZ",
        city: "Астана",
        contentHash: "d".repeat(64),
        protectedAt: "2026-08-01T00:00:00.000Z",
        verifiedCount: 2,
        ...(anchor === undefined ? {} : { bitcoinAnchor: anchor }),
      },
    ],
  };
}

function stub(anchor: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => profile(anchor) })) as unknown as typeof fetch,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("состояние якоря видно на странице автора", () => {
  test("подтверждённый якорь — виден номер блока", async () => {
    stub({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 });
    render(<AuthorPage />);
    await waitFor(() => expect(screen.queryByText(/912345/)).not.toBeNull());
  });

  test("«готовится» и «не будет» показаны по-разному", async () => {
    stub({ status: "pending", bitcoinBlockHeight: null });
    const { unmount } = render(<AuthorPage />);
    await waitFor(() => expect(screen.queryByText(/anchoring/i)).not.toBeNull());
    expect(screen.queryByText(/no Bitcoin anchor/i)).toBeNull();
    unmount();

    stub({ status: "not_stamped", bitcoinBlockHeight: null });
    render(<AuthorPage />);
    await waitFor(() => expect(screen.queryByText(/no Bitcoin anchor/i)).not.toBeNull());
  });

  test("бэкенд поля не прислал — пометки «без якоря» НЕТ", async () => {
    // До выкатки поля нет у всех работ. Пометка «no Bitcoin anchor» на всей
    // странице автора была бы ложью от собственной неосведомлённости.
    stub(undefined);
    render(<AuthorPage />);
    await screen.findByText("Степной рассвет");
    expect(screen.queryByText(/no Bitcoin anchor/i)).toBeNull();
    expect(screen.queryByText(/anchoring/i)).toBeNull();
  });
});
