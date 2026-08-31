import { describe, expect, test, beforeAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Исчерпание суточной квоты писем перестаёт быть невидимым — 20.08.2026.
//
// У Brevo на текущем плане потолок 300 писем в сутки. Публичная подписка шлёт письмо
// на каждый запрос, и предела «10 в минуту на адрес» хватало, чтобы выбрать квоту с
// одного адреса за полчаса. После этого подтверждения не приходят НИКОМУ, а снаружи
// это выглядит как «письма задерживаются».
//
// Здесь СЧЁТЧИК И ТРЕВОГА, а не запрет: запрет никого не спасает — упёрлись мы сами
// или посторонний, подписчик всё равно без письма. Спасает то, что об исчерпании
// узнают до того, как воронка тихо умрёт.

beforeEach(() => {
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_DAILY_SOFT_CAP = "30"; // маленькая квота, чтобы порог достигался быстро
  process.env.PG_POOL_CONN_MS = "150";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ messageId: "<m>" }), text: async () => "" }) as unknown as Response),
  );
});
afterEach(() => vi.unstubAllGlobals());

/**
 * Прогрев модулей ОДИН раз, вне бюджета отдельного теста.
 *
 * Замер 31.08.2026: изолированно файл проходит за 2 секунды, а под нагрузкой
 * (четыре файла разом, десятки процессов node от соседних окон) падал по
 * таймауту 30 с на строке `await import("../src/routes/devhub")`. Тест при
 * этом исправен и предмет исправен: платит первый, кто дошёл до импорта, а
 * граф у devhub большой.
 *
 * ⚠️ Лечение НЕ в поднятии testTimeout. Его здесь уже поднимали — было 10 с,
 * стало 30, и под нагрузкой снова не хватило. Так можно двигать порог
 * бесконечно, потому что чинится следствие. Модули кешируются, поэтому
 * достаточно оплатить загрузку заранее и один раз: дальше `await import`
 * внутри тестов достаёт из кеша мгновенно, и переписывать десять тестов не
 * нужно.
 *
 * Свой запас времени у beforeAll намеренно большой: это не проверка, а
 * подготовка, и красным должен становиться настоящий отказ, а не очередь на
 * загруженной машине.
 */
beforeAll(async () => {
  // Прогрев модулей ОДИН раз, вне бюджета отдельного теста.
  //
  // Замер 31.08.2026: изолированно файл проходит за 2 секунды, а под нагрузкой
  // (четыре файла разом, десятки процессов node от соседних окон) падал по
  // таймауту 30 с на `await import("../src/routes/devhub")`. Тест исправен и
  // предмет исправен: платит первый, кто дошёл до импорта, а граф у devhub
  // большой. Лечение НЕ в поднятии testTimeout — его здесь уже поднимали с 10
  // до 30, и снова не хватило. Модули кешируются, поэтому достаточно оплатить
  // загрузку заранее и один раз. После правки: 5 и 4 секунды вместо 34.
  //
  // Окружение здесь НЕ задаётся намеренно. Первая версия задавала: тогда
  // `brevoQuota` замораживал потолок при загрузке, и прогрев до beforeEach
  // ломал три теста. Это починено в самом модуле — потолок читается при
  // вызове (см. `dailySoftCap`), и порядок импорта больше ничего не решает.
  // Сторож `brevoQuotaReadsEnvLazily` не даст вернуть заморозку молча.
  await Promise.all([
    import("../src/routes/devhub"),
    import("../src/routes/constitutionWaitlist"),
    import("../src/lib/constitutionBrevo"),
    import("../src/lib/brevoQuota"),
  ]);
}, 180_000);

describe("счётчик писем и тревога", () => {
  test("счётчик ПОДКЛЮЧЁН к настоящей отправке, а не просто написан", async () => {
    // Главная проверка файла. Написанный и никем не вызванный счётчик — это класс
    // «код обещает то, чего не делает», и он у нас уже случался.
    const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    const { __emailCounter, __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    expect(__emailCounter().count).toBe(0);
    await sendWaitlistConfirm("kto@primer.test", "devhub");
    expect(__emailCounter().count, "отправка прошла, а счётчик не сдвинулся — он не подключён").toBe(1);
  });

  test("тревога поднимается на 2/3 квоты и ровно ОДИН раз", async () => {
    const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    const { __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 21; i++) await sendWaitlistConfirm(`k${i}@primer.test`, "devhub");
    const quota = warn.mock.calls.filter((c) => String(c[0]).includes("из 30"));
    expect(quota.length, "тревоги о квоте нет вовсе").toBeGreaterThanOrEqual(1);
    // 2/3 от 30 = 20; на 21 отправке порог 27 (9/10) ещё не достигнут.
    expect(quota.length, "тревога повторяется на каждой отправке — её перестанут читать").toBe(1);
    warn.mockRestore();
  });

  test("до порога тревоги нет — иначе канал зашумлён с первого дня", async () => {
    const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    const { __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) await sendWaitlistConfirm(`m${i}@primer.test`, "devhub");
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("из 30")).length).toBe(0);
    warn.mockRestore();
  });

  test("подписка через роут тоже двигает счётчик", async () => {
    // Сквозная проверка: путь, которым идёт человек, а не прямой вызов функции.
    const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
    const { __emailCounter, __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const app = express();
    app.use(express.json());
    app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
    await request(app)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email: "skvoz@primer.test", source: "devhub" });
    const started = Date.now();
    while (__emailCounter().count === 0 && Date.now() - started < 3000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(__emailCounter().count, "подписка прошла, письма не посчитано").toBe(1);
  });
});

describe("тревога не называет одного поставщика, считая нескольких", () => {
  test("в тексте нет бренда провайдера, пока в счёт входят оба", async () => {
    // Замер 31.08.2026. Счётчик считает ВСЕ исходящие письма платформы: два
    // пути идут через Brevo, пять — через Resend. Текст тревоги при этом
    // говорил «[Brevo] суточный потолок достигнут», то есть называл квоту
    // одного поставщика, а суммировал обоих. Человек, прочитав такое,
    // пойдёт смотреть панель Brevo и увидит там другое число.
    //
    // Это тот же класс, что поле состояния с именем шире того, о чём оно
    // отвечает: сообщение звучит конкретнее, чем есть на самом деле, и
    // уводит в сторону тем увереннее, чем оно точнее сформулировано.
    //
    // Проверяется ТЕКСТ, который увидит человек, а не устройство счётчика:
    // считать одним потолком — осознанный размен, называть его чужим именем —
    // нет.
    const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    const { __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 21; i++) await sendWaitlistConfirm(`b${i}@primer.test`, "devhub");
    const quota = warn.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("из 30"));
    expect(quota.length, "тревога не сработала — проверять нечего").toBe(1);
    for (const brand of ["Brevo", "Resend", "SendinBlue", "Sendinblue"]) {
      expect(
        quota[0].includes(brand),
        `тревога называет поставщика «${brand}», хотя в счёт входят несколько`,
      ).toBe(false);
    }
    warn.mockRestore();
  });
});

describe("охват счётчика: письма DevHub идут в ту же квоту", () => {
  // Найдено сразу после первой версии счётчика: DevHub шлёт письма ПРЯМО в API
  // Brevo, минуя lib/constitutionBrevo. Значит счётчик видел только один из двух
  // путей и занижал расход — тревога пришла бы поздно. Это класс «сторож занижал
  // свой охват»: он не врал о себе, он просто не знал, что смотрит в половину.
  //
  // Проверяем ПОВЕДЕНИЕМ, а не наличием строки: греп по noteEmailSent сказал бы
  // «вызов есть» и на пути, который никогда не выполняется.
  test("POST /media/email увеличивает общий счётчик", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const { devhubRouter } = await import("../src/routes/devhub");
    const { __emailCounter, __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use("/api/devhub", devhubRouter);
    const r = await request(app)
      .post("/api/devhub/media/email")
      .set("X-Forwarded-For", "10.9.9.9")
      .send({ to: "kto@primer.test", subject: "тема", htmlBody: "<p>тело</p>" });
    // Транспорт подменён в beforeEach — наружу ничего не ушло.
    expect([200, 201], `ручка ответила ${r.status}: ${JSON.stringify(r.body).slice(0, 120)}`).toContain(r.status);
    expect(__emailCounter().count, "письмо DevHub не попало в общую квоту").toBe(1);
  });

  test("SMS в квоту писем НЕ идёт — у него своя", async () => {
    // Обратная граница. Смешать две квоты означало бы врать обоими числами:
    // тревога о письмах приходила бы от чужого расхода, а SMS остался бы без учёта.
    process.env.BREVO_API_KEY = "test-key";
    const { devhubRouter } = await import("../src/routes/devhub");
    const { __emailCounter, __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use("/api/devhub", devhubRouter);
    await request(app)
      .post("/api/devhub/media/sms")
      .set("X-Forwarded-For", "10.9.9.10")
      .send({ recipient: "+79001234567", content: "текст" });
    expect(__emailCounter().count).toBe(0);
  });
});

describe("охват: второй письменный путь DevHub тоже в квоте", () => {
  // Мутация показала, что первая версия проверок охвата покрывала ОДИН из двух
  // письменных путей: снятие вызова у /media/email краснело, у отправки шаблона —
  // нет. То есть про второй путь я знал бы только из кода, а это не проверка.
  test("POST /media/email-template-send увеличивает общий счётчик", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const { devhubRouter } = await import("../src/routes/devhub");
    const { __emailCounter, __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use("/api/devhub", devhubRouter);
    const r = await request(app)
      .post("/api/devhub/media/email-template-send")
      .set("X-Forwarded-For", "10.9.9.11")
      .send({ templateId: 7, to: "kto@primer.test", params: { name: "Кто" } });
    expect([200, 201], `ручка ответила ${r.status}: ${JSON.stringify(r.body).slice(0, 120)}`).toContain(r.status);
    expect(__emailCounter().count, "письмо по шаблону не попало в общую квоту").toBe(1);
  });
});

describe("тревога называет себя предупреждением, а не аварией", () => {
  // Уходит через captureException, поэтому в Sentry ляжет ошибкой, а утренняя
  // сводка считает ошибками прода письма с темой «проект - ТипОшибки». Значит
  // человек увидит это в списке аварий. Выбор осознанный (видимость важнее
  // ярлыка — captureMessage мог вообще не дать письма), но тогда сообщение
  // ОБЯЗАНО само говорить, чем оно является. Иначе предупреждение о квоте
  // читается как падение прода.
  test("в тексте есть признак «не авария» и оба числа", async () => {
    const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    const { __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 21; i++) await sendWaitlistConfirm(`w${i}@primer.test`, "devhub");
    const quota = warn.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("из 30"));
    expect(quota.length).toBe(1);
    expect(quota[0], "тревога не говорит, что это не авария").toMatch(/не авария/i);
    expect(quota[0], "в тревоге нет обоих чисел — сколько ушло и каков потолок").toMatch(/20|21/);
    warn.mockRestore();
  });
});

describe("само исчерпание квоты тоже слышно", () => {
  test("на 100% потолка приходит отдельный сигнал со словом ИСЧЕРПАНО", async () => {
    // Раньше последний сигнал был на 9/10, и исчерпание проходило молча:
    // письма переставали доходить, а снаружи это выглядит как «почта
    // задерживается», то есть как ничто.
    const { vi } = await import("vitest");
    const { noteEmailSent, __resetEmailCounter } = await import("../src/lib/brevoQuota");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cap = Number(process.env.BREVO_DAILY_SOFT_CAP) || 300;
    for (let i = 0; i < cap; i++) noteEmailSent();
    const said = warn.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(said, "исчерпание прошло молча").toContain("ИСЧЕРПАНО");
    warn.mockRestore();
    __resetEmailCounter();
  });

  test("доставка НЕ меняется: счётчик по-прежнему только считает", async () => {
    // Потолок мягкий и переопределяется переменной. Жёсткий стоп мог бы
    // оборвать письма раньше настоящего лимита провайдера.
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "brevoQuota.ts"),
      "utf8",
    );
    expect(src).not.toContain("throw new Error(\"quota");
    expect(src).toContain("Доставку здесь НЕ меняем");
  });
});
