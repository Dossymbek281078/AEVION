/**
 * Полоса статистики ShadowNet против КОНВЕРТА в ответе ручки.
 *
 * ЗАЧЕМ. 28.08.2026 сторож ошибок браузера нашёл на живом проде падение:
 * `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`.
 * Причина — ручка отдаёт `{"success":true,"data":{...}}`, а компонент клал в
 * состояние КОНВЕРТ целиком, поэтому `stats.totalPosts` был `undefined`.
 *
 * Падение ловил error boundary страницы, то есть снаружи оно выглядело как
 * «полоса просто не показывается». Ни один тест этого не видел: тестов у
 * компонентов ShadowNet не было вовсе.
 *
 * Проверяем ОБА уклада ответа: с конвертом и без. Второй — не прихоть: если
 * ручку однажды упростят, компонент не должен сломаться обратно.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import StatsStrip from "../StatsStrip";

const ДАННЫЕ = { totalPosts: 36, totalSizeBytes: 720, uniqueAliases: 12, topThreatModel: null };

function ответ(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

describe("StatsStrip", () => {
  it("разворачивает конверт {success,data} — тот уклад, что на проде", async () => {
    vi.mocked(fetch).mockReturnValue(ответ({ success: true, data: ДАННЫЕ }));
    render(<StatsStrip />);
    await waitFor(() => expect(screen.getByText("36")).toBeTruthy());
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("понимает и ответ БЕЗ конверта", async () => {
    vi.mocked(fetch).mockReturnValue(ответ(ДАННЫЕ));
    render(<StatsStrip />);
    await waitFor(() => expect(screen.getByText("36")).toBeTruthy());
  });

  it("на ответе без чисел не падает, а показывает нули", async () => {
    // Контроль против возврата дефекта: раньше здесь был бы TypeError.
    vi.mocked(fetch).mockReturnValue(ответ({ success: true, data: {} }));
    render(<StatsStrip />);
    await waitFor(() => expect(screen.getAllByText("0").length).toBeGreaterThan(0));
  });

  it("на отказе ручки говорит «недоступно», а не падает", async () => {
    vi.mocked(fetch).mockReturnValue(ответ({ error: "nope" }, false, 500));
    render(<StatsStrip />);
    await waitFor(() => expect(screen.getByText("Stats unavailable")).toBeTruthy());
  });
});
