import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * «Согласование не нужно» нельзя говорить, не имея оценки площадки.
 *
 * ПОВОД (29.08.2026). Признак `needsAtc` был `boolean`, и отсутствие
 * оценки давало `false`. Предупреждение о согласовании с диспетчером
 * показывается только при `true` — значит оно просто ИСЧЕЗАЛО, а
 * исчезнувшее предупреждение читается как «согласование не требуется».
 *
 * Для авиационного поля это опасная сторона: «нет данных» превращается в
 * разрешительный ответ.
 *
 * Снова сработал признак СОСЕДА: в той же строке `ceilingM: s?.ceilingM ??
 * null` сделано правильно. Одно место, один автор, разное обращение с
 * двумя полями — третий раз за окно, и все три раза это был недосмотр.
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
    // ПОРЯДОК РЕШАЕТ: «/cities» содержит «/city», и проверка на «/city»,
    // стоящая первой, перехватывает ЗАПРОС СПИСКА тоже. 02.09.2026 из-за этого
    // выбор города не отрисовывался ни в одном тесте модуля.
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/city")) return jsonOk(city);
    if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
    return jsonOk({});
  }) as unknown as typeof fetch;
  return render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
}

const UNKNOWN_MESSAGES = [
  "whether ATC coordination is required is unknown",
  "нужно ли согласование с диспетчером, неизвестно",
  "диспетчермен келісу қажет пе, белгісіз",
];

describe("незнание про согласование с диспетчером не выдаётся за «не нужно»", () => {
  test("оценок площадок нет — страница говорит «неизвестно»", async () => {
    const noScores = { ...cityMinimal, vertiportScores: [] };

    const r = mountWithCity(noScores);
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const text = r.container.textContent ?? "";
    // Отрицательный контроль: пустая отрисовка прошла бы утверждение ниже.
    expect(text.length, "страница ничего не отрисовала").toBeGreaterThan(100);

    expect(
      UNKNOWN_MESSAGES.some((m) => text.includes(m)),
      "оценки площадок отсутствуют, а страница молчит про согласование — " +
        "молчание здесь читается как «не требуется»",
    ).toBe(true);
  }, 30000);

  test("оценки есть — строки про неизвестность нет", async () => {
    // Без этой проверки первую можно было бы выполнить, показывая
    // «неизвестно» ВСЕГДА: предупреждение стало бы шумом и его перестали
    // бы читать — ровно то, чем плохи вечно красные сторожа.
    // Оценки должны СОВПАДАТЬ по координатам с площадками. В общей
    // фикстуре они от настоящего города, а площадки я ужимал — и
    // страница честно говорила «неизвестно», потому что оценки для
    // ЭТИХ площадок действительно не было. Красный тест указывал на
    // фикстуру, а не на продукт.
    const pads = (cityMinimal as { vertiports: { c: number; r: number }[] }).vertiports;
    const withScores = {
      ...cityMinimal,
      vertiportScores: pads.map((v) => ({
        c: v.c, r: v.r, suitability: 0.8, class: "candidate",
        openRadiusM: 120, clearanceM: 40, distNoFlyM: 500,
        ceilingM: 120, needsAtcCoordination: false,
      })),
    };

    const r = mountWithCity(withScores);
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const text = r.container.textContent ?? "";
    expect(
      UNKNOWN_MESSAGES.some((m) => text.includes(m)),
      "оценки есть, а страница всё равно говорит «неизвестно»",
    ).toBe(false);
  }, 30000);
});
