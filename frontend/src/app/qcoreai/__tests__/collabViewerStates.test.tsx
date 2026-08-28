import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Страница совместного просмотра отрисовывает КАЖДОЕ своё состояние.
 *
 * Её не существовало до 28.08.2026: кнопка «поделиться» отдавала ссылку сюда,
 * а прод отвечал 404. Теперь адрес есть, и сторож ссылок это проверяет — но
 * «адрес существует» и «человек увидел осмысленный экран» разные вещи.
 *
 * Проверяем именно то, что видит ПОЛУЧАТЕЛЬ ссылки, а не автор:
 *
 *   ссылка жива     -> заголовок сессии и запросы;
 *   ссылка отозвана -> прямое объяснение и следующий шаг, а не пустота;
 *   связи нет       -> отказ показан отказом, а не вечным «открываем…».
 *
 * Последние два дороже первого. Пустой экран человек читает как «здесь ничего
 * нет» и уходит; ошибка без следующего шага заставляет его гадать. Ровно этот
 * класс — молчаливый отказ, выглядящий успехом — чинили этой же ночью в шести
 * модулях, и повторять его на новой странице было бы обидно.
 */

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "t0ken" }) }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import CollabViewerPage from "../collab/[token]/page";

const snapshot = {
  session: { id: "s1", title: "Разбор архитектуры", createdAt: "2026-08-28T09:00:00.000Z" },
  runs: [
    { id: "r1", userInput: "Сравни два подхода к оплате", status: "done", createdAt: "2026-08-28T09:05:00.000Z" },
  ],
  viewers: 3,
};

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("страница совместного просмотра показывает каждое состояние", () => {
  test("живая ссылка: видно заголовок, запрос и счётчик просмотров", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => snapshot,
    });
    render(<CollabViewerPage />);
    await waitFor(() => expect(screen.getByText("Разбор архитектуры")).toBeTruthy());
    expect(screen.getByText(/Сравни два подхода к оплате/)).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  test("отозванная ссылка: объяснение и следующий шаг, а не пустой экран", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 404, json: async () => ({}),
    });
    render(<CollabViewerPage />);
    await waitFor(() => expect(screen.getByText(/больше не действует/i)).toBeTruthy());
    // Следующий шаг обязателен: без него человек знает, что сломано, и не
    // знает, что делать. Ссылка на модуль — минимальный честный выход.
    // Именно кнопка-выход, а не ссылка «назад» в шапке: их две, и «есть хоть
    // какая-то ссылка на QCoreAI» проходило бы и без следующего шага.
    expect(screen.getByRole("link", { name: /Открыть QCoreAI/i })).toBeTruthy();
  });

  test("нет связи: отказ показан отказом, а не вечным «открываем…»", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));
    render(<CollabViewerPage />);
    await waitFor(() => expect(screen.getByText(/Нет связи с сервером/i)).toBeTruthy());
    expect(screen.queryByText(/Открываем/i)).toBeNull();
  });

  test("сессия без запросов: сказано прямо, что их нет", async () => {
    // Законная пустота. Если не сказать о ней словами, она неотличима от
    // поломки — и человек решит, что ссылка битая.
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ...snapshot, runs: [] }),
    });
    render(<CollabViewerPage />);
    await waitFor(() => expect(screen.getByText(/пока нет ни одного запроса/i)).toBeTruthy());
  });

  test("токен уходит в адрес запроса", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => snapshot,
    });
    render(<CollabViewerPage />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const url = String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("/api/qcoreai/collab/t0ken");
  });
});
