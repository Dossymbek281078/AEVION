import { describe, expect, test, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Посадочные запуска рендерятся и не обещают лишнего — 19.08.2026.
//
// ЗАЧЕМ ЭТОТ ТЕСТ. Обе страницы — серверные компоненты, которые при сборке
// опрашивают боевой прод. `tsc` проверяет типы, но не то, что компонент вообще
// отрисуется: ошибка в JSX или упавшая проба проявились бы только на `next build`,
// а он в worktree не воспроизводится (Turbopack падает на junction'ах). Значит без
// такой проверки первым, кто увидит поломку, был бы прод в день запуска.
//
// Здесь страница вызывается как обычная async-функция и рендерится в строку. Это
// возможно потому, что в ней нет клиентских хуков: единственный интерактивный
// узел — <WaitlistCapture>, и он помечен "use client", то есть на сервере
// превращается в заглушку.
//
// ВТОРАЯ ПОЛОВИНА ТЕСТА ВАЖНЕЕ ПЕРВОЙ: он сторожит ОБЕЩАНИЯ. Числа и цены на
// посадочных выверены замером (17 моделей в списке против четырёх настроенных;
// цены нет, потому что модуль нельзя оплатить). Такие формулировки правит любой,
// кто зайдёт «улучшить текст», и вернуть их обратно легче всего именно тут.


/**
 * Текст БЕЗ раздела «Чего мы не обещаем».
 *
 * Первая версия сторожа искала запрещённые формулировки по всей странице и
 * покраснела трижды — на собственных честных отрицаниях: «писать „17 моделей“ мы
 * не будем», «не обещаем выкладку „в один клик“». Раздел отрицаний по определению
 * содержит те самые фразы, которых не должно быть в утверждениях, поэтому
 * проверять надо страницу без него.
 */
function withoutDisclaimer(html: string): string {
  const i = html.indexOf("Чего мы не обещаем");
  if (i < 0) return html;
  const end = html.indexOf("</section>", i);
  return html.slice(0, i) + (end < 0 ? "" : html.slice(end));
}

/**
 * Метка статуса контура — именно она, а не слово в пояснении.
 *
 * `not.toContain("работает")` краснел на строке «Отметка „работает“ ставится не
 * вручную», которая есть на странице всегда. Метка же рендерится содержимым
 * элемента, поэтому ищем её вместе с закрывающим тегом.
 */
function statusMarks(html: string): string[] {
  return [...html.matchAll(/>(работает|проверяется)</g)].map((m) => m[1]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * Прод при сборке отвечает — все пробы живые.
 *
 * Возвращаем 400, а не 200: у наших ручек это осмысленный ответ на заведомо
 * неверный пакет, и заодно проверяется, что страница считает его живым.
 */
function stubProdAlive() {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
}

/** Прод недоступен — пробы падают в catch. Страница обязана отрисоваться всё равно. */
function stubProdDown() {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))));
}

async function renderLaunch(
  mod: "multichat-engine" | "devhub",
  searchParams: { c?: string | string[] } = {},
): Promise<string> {
  const imported =
    mod === "multichat-engine"
      ? await import("../multichat-engine/launch/page")
      : await import("../devhub/launch/page");
  const Page = imported.default as (p: {
    searchParams: Promise<{ c?: string | string[] }>;
  }) => Promise<React.ReactElement>;
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(searchParams) }));
}

describe.each(["multichat-engine", "devhub"] as const)("посадочная /%s/launch", (mod) => {
  test("рендерится, когда прод отвечает", async () => {
    stubProdAlive();
    const html = await renderLaunch(mod);
    expect(html.length).toBeGreaterThan(500);
    // 400 признан живым: все метки статуса — «работает».
    const marks = statusMarks(html);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    expect(marks.every((m) => m === "работает")).toBe(true);
  });

  test("рендерится, даже если прод недоступен при сборке", async () => {
    // Иначе одна сетевая ошибка на сборке убила бы страницу запуска целиком.
    stubProdDown();
    const html = await renderLaunch(mod);
    expect(html.length).toBeGreaterThan(500);
    const marks = statusMarks(html);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    expect(marks.every((m) => m === "проверяется")).toBe(true);
  });

  test("есть приём адресов и раздел «чего не обещаем»", async () => {
    stubProdAlive();
    const html = await renderLaunch(mod);
    expect(html).toMatch(/Чего мы не обещаем/);
    // Метка источника обязана доехать до формы: без неё после запуска не
    // ответить, какая страница привела человека.
    expect(html).toContain(mod === "devhub" ? "devhub" : "multichat");
  });
});

describe("сторож обещаний: то, что выверено замером, не должно вернуться", () => {
  test("мультичат не обещает 17 моделей и не называет цену", async () => {
    stubProdAlive();
    const html = withoutDisclaimer(await renderLaunch("multichat-engine"));
    // В реестре 17 записей, настроено 4 — «17 моделей» было бы правдой по списку
    // и обманом по делу.
    expect(html).not.toMatch(/17\s*(моделей|models)/i);
    expect(html).toMatch(/четыре независимых поставщика/i);
    // Отдельной подписки в магазине нет: цену называть нельзя.
    expect(html).not.toMatch(/\$\s?\d/);
  });

  test("devhub не называет цену и не хвалится числом проектов", async () => {
    stubProdAlive();
    const html = withoutDisclaimer(await renderLaunch("devhub"));
    // $149 стоит в плане запуска, но в прайсе записи devhub нет вовсе.
    expect(html).not.toMatch(/\$\s?\d/);
    expect(html).not.toMatch(/149/);
    // 17 записей в /projects — это 11 повторов одного «таймера помодоро» и
    // прогоны смоков, 16 из 17 в draft.
    expect(html).not.toMatch(/17\s*(проект|приложен)/i);
  });

  test("devhub не обещает выкладку в один клик", async () => {
    // Публикация есть, но живым прогоном не подтверждена, а на этом пути успех
    // деплоя раньше отмечался до того, как страница начинала отвечать.
    stubProdAlive();
    const full = await renderLaunch("devhub");
    // Обещания нет вне раздела отрицаний...
    expect(withoutDisclaimer(full)).not.toMatch(/в один клик|одним кликом/i);
    // ...а сам отказ на странице есть и должен остаться.
    expect(full).toMatch(/Не обещаем выкладку/);
  });
});

describe("сторож обещаний в МЕТАДАННЫХ — их не видно в разметке", () => {
  // Слепое пятно, найденное мутацией. Я вписал «за 149 долларов» в страницу и
  // сторож остался зелёным: assert показал, что замена попала в
  // metadata.description, а renderToStaticMarkup метаданные не выводит вовсе.
  //
  // Между тем именно они уезжают в репост: title и og:description — это то, что
  // человек видит в мессенджере, ещё не открыв страницу. Обещание там весит не
  // меньше, чем в тексте. У этого класса есть отдельное правило в памяти:
  // «обещания прячутся в метаданных».
  test.each([
    ["multichat-engine", /17\s*(моделей|models)/i],
    ["devhub", /149/],
  ] as const)("%s: цены и завышенных чисел нет ни в одном поле", async (mod, forbidden) => {
    const imported =
      mod === "multichat-engine"
        ? await import("../multichat-engine/launch/page")
        : await import("../devhub/launch/page");
    const meta = imported.metadata as {
      title?: unknown;
      description?: unknown;
      openGraph?: { title?: unknown; description?: unknown };
    };
    const fields = [
      meta.title,
      meta.description,
      meta.openGraph?.title,
      meta.openGraph?.description,
    ].map((v) => String(v ?? ""));

    // Охват: поля обязаны быть непустыми, иначе проверка ничего не значит.
    expect(fields.filter((f) => f.length > 10).length).toBeGreaterThanOrEqual(4);

    for (const f of fields) {
      expect(f, `запрещённое в метаданных: ${f}`).not.toMatch(forbidden);
      expect(f, `цена в метаданных: ${f}`).not.toMatch(/\$\s?\d/);
    }
  });
});

describe("метка канала ?c= — по ней после запуска считают источники", () => {
  // Метка попадает в source формы приёма адресов, а сервер пишет её в колонку
  // рядом с адресом. Если она не доедет, после запуска нельзя будет сказать,
  // какая соцсеть привела людей, — а ради этого посадочные и делались.
  //
  // Значение видно в разметке: WaitlistCapture подставляет source в id поля
  // ввода, поэтому проверяем по нему, а не по внутренностям компонента.
  test.each([
    ["ig", "instagram"],
    ["tt", "tiktok"],
    ["tg", "telegram"],
    ["qr", "qr-code"],
  ] as const)("?c=%s → источник с суффиксом %s", async (code, channel) => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = await renderLaunch("multichat-engine", { c: code });
    expect(html).toContain(`multichat-${channel}`);
  });

  test("неизвестная метка не портит источник, а просто не добавляется", async () => {
    // Иначе мусор из чужой ссылки («?c=..%20drop») попал бы в колонку источника
    // и в выгрузку. channelFrom возвращает null на всё, чего нет в списке.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = await renderLaunch("devhub", { c: "неизвестный-канал" });
    expect(html).toContain("waitlist-email-devhub");
    expect(html).not.toMatch(/devhub-неизвестный/);
  });

  test("метка нечувствительна к регистру и пробелам", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = await renderLaunch("devhub", { c: "  IG " });
    expect(html).toContain("devhub-instagram");
  });

  test("массив в ?c= берётся первым элементом, а не склеивается", async () => {
    // Next отдаёт массив, когда параметр указан дважды: ?c=ig&c=tt.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = await renderLaunch("devhub", { c: ["ig", "tt"] });
    expect(html).toContain("devhub-instagram");
    expect(html).not.toContain("devhub-tiktok");
  });

  test("любой источник укладывается в 60 символов, которые принимает сервер", async () => {
    // Ручка приёма обрезает source до 60 символов (slice(0, 60)). Самая длинная
    // из наших комбинаций должна быть заметно короче, иначе метка приедет
    // обрубленной и группировка в выгрузке сломается.
    const { CHANNELS } = await import("@/lib/products");
    const longest = Object.values(CHANNELS).reduce((a, b) => (b.length > a.length ? b : a));
    for (const mod of ["multichat", "devhub"]) {
      expect(`${mod}-${longest}`.length).toBeLessThan(40);
    }
  });
});
