import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Подпись «числа посчитаны браузером» проверяется ПОВЕДЕНИЕМ.
 *
 * ПОВОД (29.08.2026, ворота 4). Когда бэкенд не отвечает на построение
 * маршрута, страница не пустеет: она считает маршрут прямо в браузере и
 * показывает расстояние, высоту и время. До сегодня они выглядели РОВНО
 * как серверные. Признак источника добавлен, но охранял его только
 * статический сторож — «кто трогает distKm, задаёт и local». Он не
 * отвечает на главный вопрос: УВИДИТ ли человек подпись.
 *
 * Здесь город грузится успешно, а маршрут падает — то есть ровно тот
 * случай, ради которого подпись заведена.
 *
 * Фикстура города СНЯТА С ЖИВОГО БЭКЕНДА и ужата (сетка 8×6, две
 * площадки, два здания), а не сочинена: форму такого объекта руками не
 * угадать, а неверная фикстура даёт зелёный тест на сломанной странице.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

/** Город отвечает, маршрут — нет. Всё остальное отдаёт пустое, но валидное. */
function mountWithDeadRoute() {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/qskyway/route")) {
      return Promise.reject(new Error("route unavailable"));
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

// Подпись на трёх языках: локаль провайдера в тесте не задана, и первая
// версия соседней проверки покраснела именно на этом.
const LOCAL_ROUTE_TEXTS = [
  "computed in your browser",
  "посчитан прямо в браузере",
  "браузерде есептелді",
];

describe("местный маршрут не выдаётся за серверный", () => {
  test("маршрут не построился на сервере — человек видит, что числа местные", async () => {
    const r = mountWithDeadRoute();

    await waitFor(
      () => {
        const text = r.container.textContent ?? "";
        expect(
          LOCAL_ROUTE_TEXTS.some((t) => text.includes(t)),
          "маршрут посчитан браузером, а страница молчит об этом — числа читаются как серверные",
        ).toBe(true);
      },
      { timeout: 10000 },
    );
  }, 30000);

  test("кнопка «новый полёт» нажимается и не ломает страницу", async () => {
    // Ворота 2 дословно: кнопка должна быть НАЖАТА, а не просто иметь
    // обработчик. До сегодня страницу не открывал ни один тест.
    const r = mountWithDeadRoute();
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(2), { timeout: 10000 });

    const buttons = Array.from(r.container.querySelectorAll("button"));
    const before = buttons.length;
    fireEvent.click(buttons[0]);

    await waitFor(
      () => expect(r.container.querySelectorAll("button").length).toBeGreaterThanOrEqual(before),
      { timeout: 5000 },
    );
    const text = r.container.textContent ?? "";
    expect(text.length, "после нажатия страница опустела").toBeGreaterThan(50);
  }, 30000);
});
