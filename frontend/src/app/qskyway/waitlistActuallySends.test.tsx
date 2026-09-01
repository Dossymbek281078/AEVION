import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Форма приёма адресов действительно отправляет адрес — и с меткой источника.
 *
 * ПОВОД (31.08). Я написал основателю, что форма «пишет в базу, адрес не
 * теряется». Проверено при этом было НЕ то: я убедился, что ручка
 * существует и путь совпадает. Что МОЯ страница шлёт туда же и с меткой
 * `source`, не проверял ничем — то есть утверждение было выведено, а не
 * измерено.
 *
 * Метка важна отдельно от факта отправки: без неё нельзя ответить, какой
 * модуль привёл человека, и весь приём сливается в один список.
 *
 * Проверяем в процессе, а не на проде: обход интерфейса по-настоящему
 * пишет в боевую базу — 28.08 я так завёл две настоящие брони.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

describe("приём адресов на странице модуля", () => {
  test("отправляет адрес на ручку подписки с меткой источника", async () => {
    const calls: { url: string; body: string }[] = [];

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("waitlist")) {
        calls.push({ url, body: String(init.body ?? "") });
        return jsonOk({ ok: true });
      }
      if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
      if (url.includes("/api/qskyway/cities")) {
        return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
      }
      if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
      return jsonOk({});
    }) as unknown as typeof fetch;

    const r = render(
      <I18nProvider>
        <Client />
      </I18nProvider>,
    );
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const field = r.container.querySelector('input[type="email"]') as HTMLInputElement | null;
    expect(field, "поля для адреса на странице нет — приём адресов не работает").toBeTruthy();

    fireEvent.change(field as HTMLInputElement, { target: { value: "probe@example.com" } });
    const form = (field as HTMLInputElement).closest("form");
    expect(form, "поле есть, но не внутри формы — отправить нечем").toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(calls.length, "адрес никуда не ушёл").toBeGreaterThan(0), { timeout: 8000 });

    const sent = calls[0];
    expect(sent.url, "адрес ушёл не на ручку подписки: " + sent.url).toContain("/api/constitution/waitlist/subscribe");
    expect(sent.body, "в теле нет самого адреса").toContain("probe@example.com");
    expect(
      sent.body,
      "нет метки источника: нельзя будет ответить, какой модуль привёл человека",
    ).toContain("qskyway");
  }, 30000);
});
