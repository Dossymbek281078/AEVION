/**
 * QEvents — интерфейс не должен выдавать бронь за оплату, а отказ — за тишину.
 *
 * Что проверяется и почему именно тестом. 28.07.2026 в модуле нашлись два
 * дефекта интерфейса: цена платного события показывалась голой суммой рядом с
 * кнопкой записи (человек решал, что заплатил), а любая неудача RSVP молча
 * возвращала кнопку в исходное состояние — включая ответ 409 «мест нет», где
 * сервер прямо предлагает лист ожидания. Проверить это глазами не получилось:
 * в базе нет ни одного события, а заводить его в чужом дев-бэкенде нельзя.
 * Тест надёжнее и не зависит от чьих-то данных.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Тяжёлое окружение страницы к делу не относится — заменяем заглушками.
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p, getApiBase: () => "" }));

const PAID_EVENT = {
  id: "ev-1",
  organizerId: "org-1",
  title: "Платная встреча",
  description: "",
  category: "tech",
  location: "Астана",
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  endAt: new Date(Date.now() + 90_000_000).toISOString(),
  capacity: 100,
  attendeeCount: 100,
  price: 50,
  coverUrl: null,
  createdAt: new Date().toISOString(),
};

vi.mock("@/lib/aevionCatalog", () => ({
  catalog: {
    qevents: {
      list: async () => ({ events: [PAID_EVENT] }),
      icsUrl: (id: string) => `/ics/${id}`,
    },
  },
  authedCatalog: () => ({ qevents: { list: async () => ({ events: [PAID_EVENT] }) } }),
}));

// eslint-disable-next-line import/first
import QEventsPage from "./page";

/** Токен нужен, чтобы кнопка записи вообще отрисовалась. */
function signInAs(sub: string) {
  const payload = btoa(JSON.stringify({ sub }));
  localStorage.setItem("aevion_token", `h.${payload}.s`);
}

beforeEach(() => {
  signInAs("user-1");
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("платное событие честно говорит про оплату", () => {
  test("рядом с суммой стоит «у организатора», а не голая цена", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    render(<QEventsPage />);
    expect(await screen.findByText(/у организатора/)).toBeTruthy();
  });

  test("голой суммы без пояснения на карточке нет", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    render(<QEventsPage />);
    await screen.findByText(/у организатора/);
    // Именно «$50» отдельным узлом — то, что было до правки.
    expect(screen.queryByText("$50")).toBeNull();
  });
});

describe("отказ записи не остаётся незамеченным", () => {
  test("на полном событии показывается отказ и предложение листа ожидания", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Event is full", waitlistAvailable: true }), { status: 409 })),
    );
    render(<QEventsPage />);
    const rsvp = await screen.findByRole("button", { name: /RSVP/i });
    await userEvent.click(rsvp);

    expect(await screen.findByText(/Мест не осталось/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /лист ожидания/i })).toBeTruthy();
  });

  test("сетевой сбой тоже виден человеку, а не проглатывается", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("нет сети"); }));
    render(<QEventsPage />);
    const rsvp = await screen.findByRole("button", { name: /RSVP/i });
    await userEvent.click(rsvp);
    expect(await screen.findByText(/Нет связи с сервером/)).toBeTruthy();
  });

  test("истёкшая сессия называется своим именем", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    render(<QEventsPage />);
    const rsvp = await screen.findByRole("button", { name: /RSVP/i });
    await userEvent.click(rsvp);
    expect(await screen.findByText(/Сессия истекла/)).toBeTruthy();
  });

  test("успешная запись платного события напоминает, что оплаты не было", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "going", attendeeCount: 100 }), { status: 200 })),
    );
    render(<QEventsPage />);
    const rsvp = await screen.findByRole("button", { name: /RSVP/i });
    await userEvent.click(rsvp);
    await waitFor(() => expect(screen.getByText(/не оплачено/)).toBeTruthy());
  });
});
