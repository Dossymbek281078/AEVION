import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Ворота запуска 2 дословно: «каждая кнопка нажата человеком или браузером».
 *
 * ПОВОД (29.08.2026). Обработчики есть у всех одиннадцати — это проверено
 * перечислением. Но перечисление отвечает на вопрос «написан ли код», а
 * ворота спрашивают «работает ли он». До сегодня страницу не открывал ни
 * один тест, то есть НИ ОДНА кнопка не была нажата ничем, кроме человека
 * вручную и по случаю.
 *
 * Здесь нажимаются ВСЕ кнопки, которые видны на живой странице, и от
 * каждой требуется минимум: не уронить страницу и не оставить пустой
 * экран. Это низкая планка намеренно — она ловит класс «кнопка есть, а
 * за ней исключение», который иначе находит только посетитель.
 *
 * Отдельно проверяется бронь: единственное действие, оставляющее след, и
 * единственное, где человеку показывают квитанцию.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const SLOT_OK = {
  ok: true,
  slot: { id: "slot-1", routeId: "r", t0: "2033-01-01T00:00:00.000Z", t1: "2033-01-01T00:10:00.000Z", holder: "Aero Taxi KZ", receipt: "abc123" },
  note: "демонстрационная бронь",
  noteEn: "demo booking",
};

function mount(routeAlive: boolean) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/qskyway/slots")) return jsonOk(SLOT_OK);
    if (url.includes("/api/qskyway/route")) {
      return routeAlive ? jsonOk({}) : Promise.reject(new Error("route unavailable"));
    }
    if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    return jsonOk({});
  }) as unknown as typeof fetch;

  return render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
}

describe("каждая видимая кнопка нажимается", () => {
  test("ни одна не роняет страницу и не оставляет пустой экран", async () => {
    const r = mount(false);
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const total = r.container.querySelectorAll("button").length;
    let pressed = 0;
    for (let i = 0; i < total; i++) {
      // Список берём заново на каждом шаге: нажатие меняет разметку, и
      // сохранённые узлы устаревают — классическая причина ложного
      // падения, которую легко принять за дефект страницы.
      const live = Array.from(r.container.querySelectorAll("button"));
      const b = live[i];
      if (!b || (b as HTMLButtonElement).disabled) continue;
      fireEvent.click(b);
      pressed++;
      expect(
        (r.container.textContent ?? "").length,
        "после нажатия кнопки №" + (i + 1) + " страница опустела",
      ).toBeGreaterThan(50);
    }

    // Считаем НАЖАТЫЕ, а не длину списка: пустой цикл выглядит так же
    // зелено, как настоящий обход.
    expect(pressed, "не нажато ни одной кнопки — проверка была пустой").toBeGreaterThan(3);
  }, 40000);

  test("бронь показывает человеку квитанцию, а не тишину", async () => {
    const r = mount(false);
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const book = Array.from(r.container.querySelectorAll("button")).find((b) =>
      /слот|slot|demo|демо/i.test(b.textContent ?? ""),
    );
    expect(book, "кнопки брони на странице не нашлось").toBeTruthy();
    fireEvent.click(book as HTMLElement);

    await waitFor(
      () => expect(r.container.textContent ?? "").toContain("slot-1"),
      { timeout: 8000 },
    );
  }, 30000);
});
