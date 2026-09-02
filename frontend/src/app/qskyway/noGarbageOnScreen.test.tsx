import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * На экран не должно попадать то, чего в исходнике нет.
 *
 * ПОВОД (29.08.2026). Сторож `noRussianOutsideI18n` проверяет ИСХОДНИК и
 * сделан хорошо. Но целый класс он увидеть не может: `undefined`, `NaN`,
 * `[object Object]` в исходнике не написаны — они появляются при
 * ИСПОЛНЕНИИ, из пустого поля ответа или из деления на ноль. Найти их
 * можно только у отрисованной страницы.
 *
 * Проверяем не вкус, а бесспорное: такие строки не может оправдать ни
 * один замысел. Спорное (жаргон, тон, язык) сюда не тащу — от проверок,
 * краснеющих на вкусовщине, отписываются.
 *
 * ⚠️ Смотрим ШИРЕ видимого текста: подписи для читалок (`aria-label`),
 * всплывающие подсказки (`title`), подсказки полей (`placeholder`) и
 * `alt`. Именно там 28.08 пряталось то, что сторож «по тексту между
 * тегами» не находил, — включая описание страницы для поисковика.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function mount() {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    // ПОРЯДОК РЕШАЕТ: «/cities» содержит «/city», и проверка на «/city»,
    // стоящая первой, перехватывает ЗАПРОС СПИСКА тоже. 02.09.2026 из-за этого
    // выбор города не отрисовывался ни в одном тесте модуля.
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
    if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
    return jsonOk({});
  }) as unknown as typeof fetch;
  return render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
}

/** Весь текст, который может дойти до человека — включая читалку экрана. */
function everythingAPersonCanGet(root: HTMLElement): string[] {
  const out: string[] = [root.textContent ?? ""];
  for (const attr of ["title", "aria-label", "placeholder", "alt"]) {
    root.querySelectorAll("[" + attr + "]").forEach((el) => {
      out.push(el.getAttribute(attr) ?? "");
    });
  }
  return out.filter((s) => s.length > 0);
}

const NEVER_ON_SCREEN = ["undefined", "NaN", "[object Object]", "null null"];

describe("страница не показывает служебный мусор", () => {
  test("ни undefined, ни NaN, ни [object Object] — включая подписи и подсказки", async () => {
    const r = mount();
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const chunks = everythingAPersonCanGet(r.container);

    // Отрицательный контроль: если собрать текст не удалось, проверка
    // пуста и при этом зелёная — тот же класс, что «no tests».
    expect(chunks.length, "не собрано ни одного куска текста — сканер смотрит не туда").toBeGreaterThan(1);
    expect(chunks.join(" ").length, "текста на странице подозрительно мало").toBeGreaterThan(200);

    for (const bad of NEVER_ON_SCREEN) {
      const hit = chunks.find((c) => c.includes(bad));
      expect(
        hit,
        "на экран попало служебное «" + bad + "»: " + (hit ?? "").slice(0, 120),
      ).toBeUndefined();
    }
  }, 30000);

  test("подписи для читалки существуют, а не только видимый текст", async () => {
    // Без этого проверка выше могла бы пройти на странице, где подписей
    // нет вовсе: пусто — значит и мусора нет.
    const r = mount();
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const labelled = r.container.querySelectorAll("[title], [aria-label]").length;
    expect(labelled, "у страницы нет ни одной подписи для читалки — проверять нечего").toBeGreaterThan(0);
  }, 30000);
});
