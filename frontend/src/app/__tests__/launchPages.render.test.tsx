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
  // Подмена отдаёт ТЕЛО, а не только статус. Так теперь работают обе пробы:
  // probeLive различает случаи по телу (один и тот же 404 бывает и живым, и
  // мёртвым), а probeJson читает содержимое — пустой список начал тоже дал бы 200,
  // и обещание «работает» опиралось бы на факт ответа, а не на факт наличия.
  //
  // `configured: true` здесь обязателен: каталог видеомоделей отдаётся статически
  // всегда, и единственный настоящий признак — этот флаг из тела.
  const body = JSON.stringify({
    templates: [{ id: "next-app" }],
    models: [{ id: "video-1" }],
    configured: true,
    error: "not_a_receipt",
    // Четыре настроенных из семи — как на проде 19.08 (там 4 из 17). Числа на
    // странице обязаны считаться отсюда, а не быть зашитыми.
    providers: [
      { id: "anthropic", name: "Claude (Anthropic)", configured: true, free: false },
      { id: "openai", name: "GPT (OpenAI)", configured: true, free: false },
      { id: "gemini", name: "Gemini (Google)", configured: true, free: true },
      { id: "openrouter", name: "OpenRouter", configured: true, free: true },
      { id: "deepseek", name: "DeepSeek", configured: false, free: false },
      { id: "grok", name: "Grok (xAI)", configured: false, free: false },
      { id: "groq", name: "Groq", configured: false, free: true },
    ],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        status: 400,
        ok: false,
        text: () => Promise.resolve(body),
      } as unknown as Response),
    ),
  );
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
    // Прежде здесь стояло `toMatch(/четыре независимых поставщика/)` — то есть тест
    // охранял ЗАШИТОЕ слово, а не свойство. Число теперь считается из ответа, и
    // проверять надо именно это: показано столько, сколько настроено (в подмене 4
    // из 7), и общее число не называется.
    expect(html).toMatch(/4 независимых поставщика/i);
    expect(html).not.toMatch(/7 независимых поставщик/i);
    // Ненастроенные поставщики не должны попасть в перечисление.
    expect(html).not.toMatch(/DeepSeek|Grok|Groq/i);
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

  // Второе слепое пятно того же поля, найдено 20.08.2026 сверкой страницы с API.
  //
  // В тексте страницы DevHub честно сказано: «связать код и медиа в разметке —
  // последний шаг за вами», и отдельным абзацем — что готовую страницу целиком мы
  // не обещаем. А в description для поиска стояло «сценарии сборки ПОД КЛЮЧ», то
  // есть ровно то обещание, от которого страница отказывается. Прежний сторож это
  // пропускал: он искал цены и числа.
  //
  // Граница проверки честная и узкая. РАЗРЕШЕНО «проект собирается с готового
  // начала» — это правда, начал ровно пять и они существуют (проверено
  // /api/devhub/templates: dashboard, express-api, landing, next-app, react-spa).
  // ЗАПРЕЩЕНО обещание, что медиа и код приезжают связанными.
  const TURNKEY = /под\s+ключ|готов\w*\s+страниц\w*\s+целиком|целиком\s+собер/i;

  test("devhub: метаданные не обещают сборку под ключ, от которой отказывается текст", async () => {
    const { metadata } = await import("../devhub/launch/page");
    const meta = metadata as {
      title?: unknown;
      description?: unknown;
      openGraph?: { title?: unknown; description?: unknown };
    };
    const fields = [meta.title, meta.description, meta.openGraph?.title, meta.openGraph?.description]
      .map((v) => String(v ?? ""));
    expect(fields.filter((f) => f.length > 10).length).toBeGreaterThanOrEqual(3);
    for (const f of fields) {
      expect(f, `метаданные обещают больше текста страницы: ${f}`).not.toMatch(TURNKEY);
    }
  });

  test("контроль: правдивое «собирается с готового начала» проверку проходит", () => {
    // Иначе сторож запрещал бы и верное утверждение, а такие сторожа отключают.
    expect("Проект собирается с готового начала — пять начал на выбор").not.toMatch(TURNKEY);
    expect("сценарии сборки под ключ").toMatch(TURNKEY);
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

describe("обещания страницы можно проверить со страницы", () => {
  // Замер 19.08.2026: у посадочной мультичата был ровно ОДИН выход — в сам модуль.
  // При этом страница обещает «чек проверяется по ссылке, без входа и без аккаунта», а
  // пойти и проверить это было негде. Обещание, которое нельзя проверить оттуда, где
  // оно дано, — половина обещания.
  //
  // Оговорка к самому себе: сначала я насчитал НОЛЬ настоящих ссылок и решил, что это
  // тупик. Ноль был артефактом — я печатал первые восемь адресов по алфавиту, а
  // «/multichat-engine» сортируется после «/manifest». Ссылка была. Урок тот же:
  // обрезанная выборка прочитана как целое.
  test("multichat: со страницы можно уйти в модуль И на проверку чека", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = await renderLaunch("multichat-engine", {});
    expect(html).toContain('href="/multichat-engine"');
    expect(html).toContain('href="/multichat-engine/verify"');
  });
});

describe("сценарий не обещает сборку, которой не делает", () => {
  // Замер 19.08.2026 по коду: шаг с кодом идёт ПЕРВЫМ, поэтому о будущих файлах не
  // знает; медиа сохраняется текстовыми обёртками (.url.txt, .mp3.b64), и ни
  // предпросмотр, ни выкатка их не разрешают. То есть сценарий отдаёт части, но не
  // сборку — а страница обещала «доводит до готовой страницы».
  test("devhub: сказано, что файлы приходят отдельными", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = await renderLaunch("devhub", {});
    expect(html).toMatch(/приходят отдельными|связать их в разметке/i);
  });

  test("devhub: слова «готовая страница» как обещания нет", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
    const html = withoutDisclaimer(await renderLaunch("devhub", {}));
    // Отказ «обещать готовую страницу целиком мы не будем» снимается withoutDisclaimer,
    // поэтому здесь остаётся только настоящее обещание, если оно есть.
    expect(html).not.toMatch(/доводит до готовой страницы/i);
  });
});

describe("неподтверждённая дата запуска не попадает на страницу", () => {
  // Первая версия обеих посадочных объявляла дату — в заголовке, в OG-карточке и
  // обратным отсчётом «через N дн.». Опоры вне моей собственной работы у этих дат
  // не нашлось, и я их убрал. А тесты тогда были ЗЕЛЁНЫМИ: ни один не смотрел на
  // заголовок, поэтому выдуманная дата уехала бы к людям, оставившим адрес.
  //
  // Ратчет простой: названия месяцев на этих двух страницах запрещены.
  //
  // Обновлено 30.08.2026. Подтверждённых дат теперь ДВЕ, обе из документа
  // основателя (00-НАЧНИ-ОТСЮДА6-08-30-ПЛАН-даты-запуска-новые.md):
  // 10 сентября — DevHub, мультичат, QRight, QSign, биржа, QSkyway, бюро и
  // тестовые шахматы; 30 сентября — шахматы полностью. Обе живут на своих
  // посадочных, не на этих двух страницах, поэтому запрет остаётся в силе.
  //
  // Прежняя редакция говорила «одна дата, 30 августа у шахмат» — она устарела
  // 29.08, когда основатель перенёс запуск. Комментарий, называющий дату,
  // протухает вместе с ней: правится вместе с решением, а не когда заметят.
  const MONTHS = /(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i;

  test("прибор ловит месяц, если он там есть", () => {
    // Отрицательный контроль: без него «месяцев нет» могло бы означать, что
    // регулярка не работает вовсе.
    expect(MONTHS.test("открываем 13 сентября")).toBe(true);
    expect(MONTHS.test("напишем в день запуска")).toBe(false);
  });

  // 🔴 ЗДЕСЬ БЫЛО "multichat" — идентификатора с таким именем нет, есть
  // "multichat-engine". Функция сравнивает строку, не находит совпадения и
  // уходит в ветку «иначе», где грузит страницу DEVHUB. То есть две проверки
  // с именем «multichat» дважды смотрели devhub, а посадочная multichat-engine
  // на обещание месяца не проверялась ВООБЩЕ.
  //
  // Нашлось замером 04.09.2026: тесты исключены из проверки типов
  // (tsconfig), и несовпадение с типом параметра никто не заметил. С
  // включённой проверкой это ошибка TS2345 в одну строку.
  for (const mod of ["devhub", "multichat-engine"] as const) {
    test(`${mod}: в разметке нет обещания месяца`, async () => {
      vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 400, ok: false } as Response)));
      const html = await renderLaunch(mod, {});
      const hit = html.match(MONTHS);
      expect(hit?.[0] ?? null, `${mod}: на странице обещан месяц «${hit?.[0]}»`).toBeNull();
    });

    test(`${mod}: в метаданных и OG нет обещания месяца`, async () => {
      const page =
        // Второе место с тем же несовпадением. Утренняя правка поменяла ЦИКЛ
        // и это сравнение пропустила — то есть проверка метаданных тоже
        // смотрела на devhub дважды. Нашла проверка типов (TS2367:
        // «сравнение бессмысленно»), а не чтение: после правки цикла условие
        // стало заведомо ложным.
        mod === "multichat-engine"
          ? await import("../multichat-engine/launch/page")
          : await import("../devhub/launch/page");
      const m = page.metadata as {
        title?: string;
        description?: string;
        openGraph?: { title?: string; description?: string };
      };
      const fields = [m.title, m.description, m.openGraph?.title, m.openGraph?.description];
      // Проверка покрытия: поля обязаны быть непустыми, иначе тест зелен впустую.
      expect(fields.filter((f) => typeof f === "string" && f.length > 10)).toHaveLength(4);
      for (const f of fields) expect(MONTHS.test(String(f))).toBe(false);
    });
  }
});

describe("обещание опирается на содержимое, а не на факт ответа", () => {
  // Суть починки 19.08.2026. Каталог видеомоделей отдаётся СТАТИЧЕСКИ всегда и сам
  // сообщает `configured: !!REPLICATE_API_TOKEN`. Прежняя проба читала только
  // живость, поэтому страница обещала бы «картинки, видео и голос внутри» и без
  // ключа провайдера — на странице, которая клянётся, что отметка ставится по
  // ответу боевого сервера.

  function stubProd(body: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          text: () => Promise.resolve(JSON.stringify(body)),
        } as unknown as Response),
      ),
    );
  }

  test("ключ провайдера не задан — на одну метку «работает» меньше", async () => {
    stubProd({ templates: [{ id: "a" }], models: [{ id: "m" }], configured: true });
    const withKey = statusMarks(await renderLaunch("devhub")).filter((m) => m === "работает").length;

    vi.unstubAllGlobals();
    stubProd({ templates: [{ id: "a" }], models: [{ id: "m" }], configured: false });
    const without = statusMarks(await renderLaunch("devhub")).filter((m) => m === "работает").length;

    // Сравнение, а не абсолютное число: оно не сломается от добавления шага.
    expect(without).toBe(withKey - 1);
  });

  test("пустой список начал — обещание про готовые начала не ставится", async () => {
    stubProd({ templates: [], models: [{ id: "m" }], configured: true });
    const marks = statusMarks(await renderLaunch("devhub")).filter((m) => m === "работает").length;

    vi.unstubAllGlobals();
    stubProd({ templates: [{ id: "a" }], models: [{ id: "m" }], configured: true });
    const full = statusMarks(await renderLaunch("devhub")).filter((m) => m === "работает").length;

    // Пустой список бьёт по двум шагам: начала и сценарии читают одно и то же поле.
    expect(marks).toBeLessThan(full);
  });
});
