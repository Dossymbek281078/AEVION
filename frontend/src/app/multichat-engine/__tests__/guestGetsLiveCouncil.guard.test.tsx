// Гость видит РАБОЧУЮ кнопку консилиума, пока у него есть бесплатная норма.
//
// ЗАМЕР 28.09.2026 живым браузером: у гостя «Спросить консилиум» было
// disabled, работал только пример с записанными заранее ответами. Человек с
// ролика уходил, не попробовав своего вопроса, — при цене $40 в месяц.
//
// Норму считает СЕРВЕР (/api/multichat-guest/allowance): страница только
// спрашивает. Поэтому здесь подменяется ответ сервера, а не внутреннее
// состояние — проверяется то, что увидит человек.
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => false,
  getAuthHeaders: () => ({}),
}));

import { CouncilConsole } from "../CouncilConsole";

function ответыСервера(осталось: number) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("multichat-guest/allowance")) {
      return { ok: true, json: async () => ({ лимит: 2, использовано: 2 - осталось, осталось }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("гость и живой консилиум", () => {
  test("норма есть — кнопка работает, и об этом сказано словами", async () => {
    vi.stubGlobal("fetch", ответыСервера(2));
    render(<CouncilConsole />);
    const кнопка = await screen.findByRole("button", { name: /Спросить консилиум/i });
    await waitFor(() => expect(screen.getByText(/осталось 2/i)).toBeTruthy());
    // Кнопка гаснет и от пустого поля — это правильно и проверяется отдельно.
    // Здесь предмет другой: мешает ли гостю ОТСУТСТВИЕ ВХОДА.
    const поле = document.querySelector("textarea");
    fireEvent.change(поле as HTMLTextAreaElement, { target: { value: "сравни три подхода к найму" } });
    await waitFor(() => expect((кнопка as HTMLButtonElement).disabled,
      "гостю с нормой и с запросом кнопку не дали").toBe(false));
  });

  test("норма кончилась — зовём войти, а не молча гасим кнопку", async () => {
    vi.stubGlobal("fetch", ответыСервера(0));
    render(<CouncilConsole />);
    await waitFor(() => expect(screen.getByText(/войдите по почте/i)).toBeTruthy());
  });
});
