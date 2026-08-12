// Консилиум — рабочая консоль модуля. Проверяется не «отрисовалось», а то,
// за что человек платит: что на экране стоит результат ЕГО запроса.
//
// Опасное место здесь одно и оно тихое. Гость сначала жмёт «Показать на
// примере» — на экране появляются заранее заданные ответы с честной пометкой
// «это пример». Потом он входит и задаёт свой вопрос. Запрос уходит, пометка
// снимается сразу, а прошлые результаты остаются висеть. Если запрос не
// прошёл, человек видит ответы ПРИМЕРА без единого признака того, что они не
// его: строка ошибки внизу мелкая, а сверху — полноценная карта разногласий.
//
// То же самое между двумя своими вопросами: в поле новый вопрос, на экране
// ответы на старый.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
  getAuthHeaders: () => ({ Authorization: "Bearer test.jwt" }),
}));

import { CouncilConsole } from "./CouncilConsole";

const DISSENT = {
  agents: 3,
  answered: 3,
  agreement: 0.42,
  outlier: { agentId: "skeptic", distance: 0.6 },
  numericConflicts: [],
  hedges: [],
  verdict: "split" as const,
  note: "Агенты разошлись по числам.",
  checks: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
});

/** Пример загружается через публичный /dissent/preview — он всегда отвечает. */
function stubFetch(handler: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => handler(String(url), init)) as unknown as typeof fetch,
  );
}

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("Консилиум: чужой результат на экране", () => {
  test("провалившийся свой запрос не оставляет ответы примера как свои", async () => {
    stubFetch((url) => {
      if (url.includes("/dissent/preview")) return okJson({ dissent: DISSENT });
      // Свой запрос не проходит — так выглядит недоступный бэкенд.
      throw new Error("network down");
    });

    render(<CouncilConsole />);

    fireEvent.click(screen.getByText("Показать на примере"));
    // Ответ примера на экране — с этого места и начинается опасность.
    expect(await screen.findByText(/выборки не хватит/)).toBeTruthy();

    const textarea = screen.getByPlaceholderText(/стоит ли запускать платный тариф/i);
    fireEvent.change(textarea, { target: { value: "Мой собственный вопрос про найм" } });
    fireEvent.click(screen.getByText("Спросить консилиум"));

    // Ошибка показана — и ответов примера на экране больше нет: иначе человек
    // читает чужой текст как ответ на свой вопрос.
    await waitFor(() => expect(screen.getByText(/network down|запрос не прошёл/)).toBeTruthy());
    expect(screen.queryByText(/выборки не хватит/)).toBeNull();
    expect(screen.queryByText(/Агенты разошлись/)).toBeNull();
  });

  test("второй вопрос не показывает ответы на первый, пока агенты думают", async () => {
    let release: (() => void) | null = null;
    stubFetch((url) => {
      if (url.includes("/conversations") && !url.includes("dispatch")) {
        return okJson({ id: "conv_1" });
      }
      if (url.includes("dispatch")) {
        // Первый ответ отдаём сразу, второй держим — проверяем именно
        // состояние «агенты отвечают».
        if (!release) {
          return okJson({
            results: [{ agentId: "analyst", ok: true, reply: "Ответ на ПЕРВЫЙ вопрос" }],
            dissent: DISSENT,
          });
        }
        return new Promise(() => {}); // не разрешается никогда
      }
      return okJson({});
    });

    render(<CouncilConsole />);

    const textarea = screen.getByPlaceholderText(/стоит ли запускать платный тариф/i);
    fireEvent.change(textarea, { target: { value: "Первый вопрос про найм" } });
    fireEvent.click(screen.getByText("Спросить консилиум"));
    expect(await screen.findByText(/Ответ на ПЕРВЫЙ вопрос/)).toBeTruthy();

    release = () => {};
    fireEvent.change(textarea, { target: { value: "Второй вопрос про цену" } });
    fireEvent.click(screen.getByText("Спросить консилиум"));

    // Пока идёт второй запрос, на экране не должно быть ответа на первый:
    // в поле уже другой вопрос, и связь между ними теряется.
    await waitFor(() => expect(screen.getByText("Агенты отвечают…")).toBeTruthy());
    expect(screen.queryByText(/Ответ на ПЕРВЫЙ вопрос/)).toBeNull();
  });
});
