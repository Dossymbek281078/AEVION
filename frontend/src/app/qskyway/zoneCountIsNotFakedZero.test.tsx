import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * «Зон: 0» нельзя говорить, не зная числа зон.
 *
 * ПОВОД (29.08.2026). Счётчик запретных зон подставлял НОЛЬ, если ответ
 * пришёл без списка: `city.nofly?.length ?? 0`. На экране это «зоны (0)» —
 * читается как «ограничений нет, летайте где хотите». Для воздушного
 * пространства это самое опасное, что можно сказать, не имея данных.
 *
 * Подстановка срабатывает редко (бэкенд список шлёт всегда), но
 * направление отказа выбирается по ЦЕНЕ ошибки, а не по её вероятности:
 * пустой прочерк никого не введёт в заблуждение, а ноль введёт.
 *
 * ⚠️ Отличать от ЗАКОННОГО нуля: город, где зон действительно нет, обязан
 * показывать 0. Поэтому проверок две — на отсутствие поля и на пустой
 * список; они должны вести себя ПО-РАЗНОМУ.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function mountWithCity(city: unknown) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/qskyway/city")) return jsonOk(city);
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
    return jsonOk({});
  }) as unknown as typeof fetch;
  return render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
}

describe("счётчик запретных зон не выдаёт незнание за ноль", () => {
  test("ответ без списка зон — на экране прочерк, а не ноль", async () => {
    const withoutNofly = { ...cityMinimal } as Record<string, unknown>;
    delete withoutNofly.nofly;

    const r = mountWithCity(withoutNofly);
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const text = r.container.textContent ?? "";
    // Отрицательный контроль: без него пустая отрисовка прошла бы.
    expect(text.length, "страница ничего не отрисовала").toBeGreaterThan(100);

    expect(
      text.includes("(0)"),
      "при неизвестном числе зон страница говорит «(0)» — это читается как «ограничений нет»",
    ).toBe(false);
  }, 30000);

  test("пустой список зон — законный ноль, он остаётся", async () => {
    // Без этой проверки первую можно было бы выполнить, вообще перестав
    // показывать число: тогда город БЕЗ зон тоже потерял бы свой честный
    // ноль, и правило превратилось бы в «никогда не показывать».
    const emptyNofly = { ...cityMinimal, nofly: [] };

    const r = mountWithCity(emptyNofly);
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    expect(
      (r.container.textContent ?? "").includes("(0)"),
      "город без запретных зон перестал показывать свой честный ноль",
    ).toBe(true);
  }, 30000);
});
