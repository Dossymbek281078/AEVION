import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Переключение языка обязано менять страницу — и меняет она пока половину.
 *
 * ЗАМЕР 29.08.2026, отрисовкой в обе локали: из 56 самостоятельных строк
 * **28 одинаковы** на русском и английском. Это не «часть строк
 * технические»: подавляющее большинство совпадений — русский текст,
 * который видит АНГЛОЯЗЫЧНЫЙ посетитель.
 *
 * Главный источник — блок сравнения с конкурентами (`CompetitorMatrix` +
 * данные `lib/competitors.ts`). Он ОБЩИЙ: им пользуется ещё `/compare`.
 * Переводить чужой набор данных в одиночку неправильно — это разъедется
 * с их страницей; долг записан и передан оркестратору.
 *
 * ⚠️ Поэтому здесь ХРАПОВИК НА НЕУХУДШЕНИЕ, а не требование нуля.
 * Требовать ноль сегодня — сделать проверку вечно красной, а такие
 * отключают в первый день.
 *
 * Что она ловит по-настоящему: НОВЫЙ одноязычный текст на трёхъязычной
 * странице. Ровно так я сам испортил кнопку приёма адресов в этом же
 * окне — вызов в коде выглядел безупречно, а читалка отвечала по-русски.
 *
 * ⚠️ Ключ локали читается из `localStorage` под именем `aevion_lang_v1`.
 * Первый замер я сделал с выдуманным именем ключа: обе отрисовки вышли
 * английскими, совпало 56 из 56, и это выглядело как катастрофа. Ключ —
 * такой же прибор, как всё остальное.
 */
const LANG_KEY = "aevion_lang_v1";
const IDENTICAL_TODAY = 28;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function mockNetwork() {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
    return jsonOk({});
  }) as unknown as typeof fetch;
}

async function ownTextsIn(lang: string): Promise<string[]> {
  localStorage.setItem(LANG_KEY, lang);
  mockNetwork();
  const r = render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
  await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

  // ⚠️ Дописано 31.08.2026 при сборке к 10.09, и без этого тест сравнивал
  // английский с английским.
  //
  // Словарь у платформы РАЗБИТ по языкам (10.08, ради веса страницы: 1.3 МБ из
  // 2.5 грузились на каждой). Язык посетителя приходит динамическим import(),
  // то есть АСИНХРОННО: у живого человека он догружается и страница
  // перерисовывается, а тест этого не ждал. Ожидание выше выполняется раньше —
  // кнопки появляются на английском ещё до подмены словаря.
  //
  // Ждём не кнопок, а самого перевода: для нелатинских языков — появления их
  // букв. Для en ждать нечего, он идёт первой отрисовкой.
  if (lang === "ru" || lang === "kk") {
    await waitFor(
      () => expect(/[А-Яа-яЁёӘәҚқҢңӨөҰұҮүҺһІі]/.test(r.container.textContent ?? "")).toBe(true),
      { timeout: 10000 },
    );
  }

  const out: string[] = [];
  r.container.querySelectorAll("button, h1, h2, h3, div, span").forEach((el) => {
    // Только СОБСТВЕННЫЙ текст узла: иначе родитель приносит текст детей,
    // и одна непереведённая строка считается пять раз.
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? "").trim())
      .join(" ")
      .trim();
    if (own.length > 12) out.push(own);
  });
  r.unmount();
  return Array.from(new Set(out));
}

describe("страница действительно говорит на выбранном языке", () => {
  test("непереведённого не стало больше", async () => {
    const ru = await ownTextsIn("ru");
    const en = await ownTextsIn("en");

    // Отрицательный контроль: пустые списки дали бы ноль совпадений и
    // зелёный результат при полностью сломанной отрисовке.
    expect(ru.length, "русская отрисовка пуста — мерить нечего").toBeGreaterThan(20);
    expect(en.length, "английская отрисовка пуста — мерить нечего").toBeGreaterThan(20);

    const identical = ru.filter((t) => en.includes(t));
    expect(
      identical.length,
      "одноязычного текста стало больше (" + identical.length + " против " + IDENTICAL_TODAY +
        "): новый текст добавлен мимо словаря. Первые: " + JSON.stringify(identical.slice(0, 3)),
    ).toBeLessThanOrEqual(IDENTICAL_TODAY);
  }, 60000);

  test("половина страницы всё же переводится — иначе замер бессмысленен", async () => {
    // Без этого храповик прошёл бы и на странице, где локаль не работает
    // вовсе: там совпало бы 100 %, но и порог тогда был бы другим.
    const ru = await ownTextsIn("ru");
    const en = await ownTextsIn("en");
    const identical = ru.filter((t) => en.includes(t));
    expect(
      identical.length,
      "совпадает ВСЁ — переключение языка не работает вовсе",
    ).toBeLessThan(ru.length);
  }, 60000);
});
