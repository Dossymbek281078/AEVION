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
    // ПОРЯДОК РЕШАЕТ: «/cities» содержит «/city», и проверка на «/city»,
    // стоящая первой, перехватывает ЗАПРОС СПИСКА тоже. 02.09.2026 из-за этого
    // выбор города не отрисовывался ни в одном тесте модуля.
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
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
    //
    // 31.08.2026: здесь стояло `> 3` при ОДИННАДЦАТИ настоящих нажатиях —
    // запас в семь кнопок. Пропади семь (стали disabled, исчезли из
    // разметки) — сторож промолчал бы, хотя зовётся «каждая кнопка нажата».
    // Имя обещало полноту, утверждение проверяло «цикл не пустой».
    //
    // Направление ВНИЗ: потеря краснит, добавление новых кнопок нет. Точное
    // число наказывало бы за развитие страницы, а это учит отключать сторожа.
    expect(pressed, "нажатых кнопок стало меньше: было 11, стало " + pressed +
      " — кнопки исчезли или стали неактивными").toBeGreaterThanOrEqual(11);
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

describe("кнопки, появляющиеся только после успеха, тоже нажимаются", () => {
  /**
   * ПОВОД (31.08). Проверка выше нажимает все ВИДИМЫЕ кнопки — и я
   * докладывал ворота 2 закрытыми. Замер показал, что это выборка:
   * после построения обоснования появляются ещё две («Download JSON» и
   * «Verify»), а кнопка «построить» исчезает. Их не нажимал никто.
   *
   * «Все видимые» и «все» — разные множества, когда часть интерфейса
   * рождается только после успешного действия.
   */
  test("скачать и проверить обоснование не роняют страницу", async () => {
    const route = {
      path: [{ c: 1, r: 1 }, { c: 6, r: 4 }], alts: [100, 110], distanceKm: 1.2,
      cruiseAltM: 110, etaMinWind: 1, etaMinStill: 1, avgWindMs: 2, windFromDeg: 90, airspace: {},
    };
    const just = {
      document: { from: 0, to: 1, city: "astana", distanceKm: 1.2, cruiseAltM: 110 },
      attestation: { alg: "Ed25519", contentHash: "abc", signature: "sig", publicKey: "pk" },
      scope: "демо", scopeEn: "demo",
    };
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/route/justification/verify")) return jsonOk({ valid: true });
      if (url.includes("/route/justification")) return jsonOk(just);
      if (url.includes("/api/qskyway/route")) return jsonOk(route);
      if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
      if (url.includes("/api/qskyway/cities")) {
        return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
      }
      return jsonOk({});
    }) as unknown as typeof fetch;

    const r = render(
      <I18nProvider>
        <Client />
      </I18nProvider>,
    );
    await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });

    const build = Array.from(r.container.querySelectorAll("button"))
      .find((b) => /justification|обоснован/i.test(b.textContent ?? ""));
    expect(build, "кнопки построения обоснования нет").toBeTruthy();
    fireEvent.click(build as HTMLElement);

    // Ждём именно ПОЯВЛЕНИЯ новых кнопок, а не смены их числа:
    // одна исчезает, две появляются, и счётчик мог бы обмануть.
    await waitFor(
      () => {
        const labels = Array.from(r.container.querySelectorAll("button")).map((b) => b.textContent ?? "");
        expect(labels.some((l) => /download|скачать/i.test(l)), "кнопка скачивания не появилась").toBe(true);
      },
      { timeout: 8000 },
    );

    // Следим за СЛЕДСТВИЕМ, а не за фактом нажатия. Первая версия только
    // жала кнопки и проверяла, что страница не опустела: мутация
    // onClick={() => {}} её НЕ ломала — нажатие было декоративным.
    // Скачивание видно по URL.createObjectURL: его зовёт обработчик.
    const madeBlob: number[] = [];
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => { madeBlob.push(b.size); return "blob:probe"; }) as typeof URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

    let pressed = 0;
    for (const rx of [/download|скачать/i, /verify|провер/i]) {
      const b = Array.from(r.container.querySelectorAll("button")).find((x) => rx.test(x.textContent ?? ""));
      if (!b || (b as HTMLButtonElement).disabled) continue;
      fireEvent.click(b);
      pressed++;
      expect((r.container.textContent ?? "").length, "страница опустела после нажатия").toBeGreaterThan(50);
    }
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;

    expect(pressed, "ни одна из двух кнопок не нажата — проверка пуста").toBe(2);
    expect(madeBlob.length, "нажали «скачать», а файл не собрался").toBeGreaterThan(0);
    expect(madeBlob[0], "файл обоснования пуст").toBeGreaterThan(50);
  }, 40000);
});
