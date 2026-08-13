import { describe, test, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CouncilConsole } from "../CouncilConsole";
import { setAuthToken, clearAuthToken } from "@/lib/auth";

// Что человек ВИДИТ, когда консилиум не отвечает.
//
// Проверяем не строки функции (это делает failureText.test.ts), а сам экран:
// карточка агента раньше печатала `r.error` как есть, и при исчерпанном пределе
// частоты на русской странице появлялось
// `rate_limit_exceeded: max 30 chat requests per minute per IP` — непонятно и,
// хуже того, неправда по смыслу: предел общий для всех, кто пользуется сервисом
// в эту минуту, а «per IP» читается как «я слишком часто нажимал».
//
// Рендер в jsdom при полном параллельном прогоне выходит за дефолтные 5 с.
vi.setConfig({ testTimeout: 20_000 });

/** Один ответ fetch. */
function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

/** Маршрутизатор-заглушка по URL — форма ровно как у настоящих вызовов. */
function mockFetch(handlers: Array<[RegExp, () => Promise<Response>]>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    for (const [re, fn] of handlers) if (re.test(url)) return fn();
    return json({ error: `не замокан: ${url}` }, 500);
  });
}

beforeEach(() => {
  // Кнопка включается только для вошедшего. Токен кладём ТЕМ ЖЕ сеттером, что и
  // приложение: свой ключ в localStorage — это состояние, которого продукт
  // никогда не создаёт, и тест на нём проходил бы мимо настоящего контракта.
  setAuthToken("jwt-test");
});

afterEach(() => {
  cleanup();
  clearAuthToken();
  vi.unstubAllGlobals();
});

async function ask(): Promise<void> {
  const box = await screen.findByPlaceholderText(/стоит ли запускать/i);
  await userEvent.type(box, "Стоит ли поднимать цену на тариф medium");
  const button = screen.getByRole("button", { name: /спросить|консилиум|запустить/i });
  await waitFor(() => expect(button).not.toBeDisabled());
  await act(async () => {
    await userEvent.click(button);
  });
}

describe("Консилиум — отказ агента на экране", () => {
  test("исчерпанный предел частоты объяснён по-русски и назван общим", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        [/\/conversations$/, () => json({ id: "conv-1" }, 201)],
        [
          /\/dispatch$/,
          () =>
            json({
              conversationId: "conv-1",
              results: [
                {
                  agentId: "analyst",
                  role: "Аналитик — только факты и цифры, без оценок",
                  ok: false,
                  // Ровно то, что отдаёт chatLimiter бэкенда.
                  error: "rate_limit_exceeded: max 30 chat requests per minute per IP",
                },
              ],
            }),
        ],
      ]),
    );

    render(<CouncilConsole />);
    await ask();

    // Человеку — причина по-русски, и предел назван ЛИЧНЫМ: лимитер считает по
    // аккаунту с 13.08.2026, и «виноват кто-то другой» было бы неправдой.
    expect(await screen.findByText(/личный счёт/i)).toBeTruthy();
    // Техническая строка не спрятана — иначе отчёт пользователя бесполезен.
    expect(screen.getByText(/max 30 chat requests per minute per IP/)).toBeTruthy();
    // И в заголовке карточки — роль, а не внутренний id.
    expect(screen.getByText("Аналитик")).toBeTruthy();
    expect(screen.queryByText("analyst")).toBeNull();
  });

  test("отказ всей отправки показывает, через сколько повторить", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        [/\/conversations$/, () => json({ id: "conv-2" }, 201)],
        [/\/dispatch$/, () => json({ error: "Too many requests", retryAfterSec: 17 }, 429)],
      ]),
    );

    render(<CouncilConsole />);
    await ask();

    expect(await screen.findByText(/Повторите через 17 с\./)).toBeTruthy();
  });

  test("скачанный отчёт объясняет отказ так же, как экран", async () => {
    // Отчёт уходит коллеге. Если в нём остаётся английская техническая строка,
    // получатель читает её как вину отправителя — то же, что было на экране.
    vi.stubGlobal(
      "fetch",
      mockFetch([
        [/\/conversations$/, () => json({ id: "conv-4" }, 201)],
        [
          /\/dispatch$/,
          () =>
            json({
              conversationId: "conv-4",
              results: [
                {
                  agentId: "analyst",
                  role: "Аналитик — только факты и цифры, без оценок",
                  ok: false,
                  error: "rate_limit_exceeded: max 30 chat requests per minute per IP",
                },
              ],
            }),
        ],
      ]),
    );

    // Перехватываем содержимое файла, который отдала бы кнопка.
    let written = "";
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (b: Blob) => {
        // Blob.text() асинхронен, а обработчик синхронный — читаем через
        // приватное поле jsdom только если оно есть, иначе через конструктор.
        (b as Blob).text().then((t) => (written = t));
        return "blob:stub";
      },
      revokeObjectURL: () => {},
    });

    render(<CouncilConsole />);
    await ask();

    const reportButton = await screen.findByRole("button", { name: /скачать отчёт/i });
    await act(async () => {
      await userEvent.click(reportButton);
    });
    await waitFor(() => expect(written).not.toBe(""));

    expect(written).toContain("### Аналитик");
    expect(written).not.toContain("### analyst");
    expect(written).toMatch(/личный счёт/);
    // Правда не спрятана и здесь.
    expect(written).toContain("max 30 chat requests per minute per IP");
  });

  test("исчерпанная квота провайдера не обещает, что поможет ожидание", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        [/\/conversations$/, () => json({ id: "conv-3" }, 201)],
        [
          /\/dispatch$/,
          () =>
            json({
              conversationId: "conv-3",
              results: [
                { agentId: "skeptic", role: "Скептик — ищет, где рассуждение ломается", ok: false, error: "provider_quota_exceeded" },
              ],
            }),
        ],
      ]),
    );

    render(<CouncilConsole />);
    await ask();

    expect(await screen.findByText(/Ожидание не поможет/i)).toBeTruthy();
    expect(screen.queryByText(/через минуту/i)).toBeNull();
  });
});
