import { describe, expect, test } from "vitest";

import {
  LAUNCH_MODULES,
  buildLaunchEmail,
  matchesModule,
  planLaunchAnnounce,
} from "../src/lib/launchAnnounce";

// Подготовка рассылки на запуск — 19.08.2026.
//
// Шесть страниц обещают «напишем в день запуска», а механизма рассылки не было
// вовсе. Этот модуль — подготовка: письмо, отбор получателей и сухой прогон.
// Отправки в нём нет намеренно, и первый же тест это фиксирует: разослать письма
// живым людям нельзя повторить «уже правильно», поэтому отправку выполняет
// владелец.
//
// Отбор — самое хрупкое место, потому что метка источника приходит в трёх видах:
// «devhub», «devhub-instagram» и (когда починят перезапись при повторной
// подписке) список через запятую.

describe("отбор получателей по метке источника", () => {
  test("точная метка и метка с каналом подходят", () => {
    expect(matchesModule("devhub", "devhub")).toBe(true);
    expect(matchesModule("devhub-instagram", "devhub")).toBe(true);
    expect(matchesModule("multichat-qr-code", "multichat")).toBe(true);
  });

  test("чужая метка не подходит, даже если слово встречается внутри", () => {
    // Сравнение строгое по началу, а не подстрокой: иначе «devhub» притянул бы
    // любую метку, где это слово встретилось.
    expect(matchesModule("olddevhub", "devhub")).toBe(false);
    expect(matchesModule("cyberchess", "devhub")).toBe(false);
    expect(matchesModule("multichat", "devhub")).toBe(false);
  });

  test("склеенный список источников — оба интереса учтены", () => {
    // Так метка будет выглядеть после починки перезаписи: человек, оставивший
    // адрес и на шахматах, и на DevHub, обязан попасть в ОБЕ рассылки. Сейчас
    // источник перезаписывается последним, и этот случай — задел на починку.
    const both = "cyberchess-instagram,devhub";
    expect(matchesModule(both, "cyberchess")).toBe(true);
    expect(matchesModule(both, "devhub")).toBe(true);
    expect(matchesModule(both, "multichat")).toBe(false);
  });

  test("регистр и пробелы не мешают, пустая метка не подходит никуда", () => {
    expect(matchesModule("  DevHub-Instagram ", "devhub")).toBe(true);
    expect(matchesModule("", "devhub")).toBe(false);
    expect(matchesModule("unknown", "devhub")).toBe(false);
  });
});

describe("сухой прогон — кто получил бы письмо", () => {
  const rows = [
    { email: "a@primer.ru", source: "devhub" },
    { email: "b@primer.ru", source: "devhub-instagram" },
    { email: "c@primer.ru", source: "cyberchess" },
    { email: "A@primer.ru", source: "devhub-telegram" }, // тот же человек другим регистром
    { email: "d@primer.ru", source: "" },
    { email: "e@primer.ru", source: "cyberchess,devhub" },
  ];

  test("отобраны только подписчики этого модуля", () => {
    const plan = planLaunchAnnounce("devhub", rows);
    expect(plan.recipients).toEqual(["a@primer.ru", "b@primer.ru", "e@primer.ru"]);
  });

  test("один человек — одно письмо, даже если подписался дважды", () => {
    // «A@primer.ru» и «a@primer.ru» — один адрес: два письма подряд читаются как
    // сбой у нас, а не как внимание.
    const plan = planLaunchAnnounce("devhub", rows);
    expect(plan.recipients.filter((r) => r.startsWith("a@")).length).toBe(1);
  });

  test("видно, сколько записей просмотрено — иначе пустой список двусмыслен", () => {
    // «Никто не подписан» и «список не прочитан» дают одинаковый нуль
    // получателей, а решения разные.
    const plan = planLaunchAnnounce("multichat", rows);
    expect(plan.recipients).toEqual([]);
    expect(plan.scanned).toBe(rows.length);
    expect(plan.preview).toBeNull();
  });

  test("ни одного письма не отправлено — это записано в самом отчёте", () => {
    const plan = planLaunchAnnounce("devhub", rows);
    expect(plan.sent).toBe(0);
  });
});

describe("текст письма — обещает только то, что открылось", () => {
  test.each(Object.keys(LAUNCH_MODULES))("%s: название, дата, ссылка и отписка на месте", (slug) => {
    const mail = buildLaunchEmail(slug, "kto@primer.ru");
    const m = LAUNCH_MODULES[slug];

    expect(mail.subject).toContain(m.name);
    expect(mail.subject).toContain(m.date);
    expect(mail.htmlContent).toContain(`https://aevion.app${m.page}`);
    // Отписка обязательна в каждом письме — иначе рассылка становится спамом
    // юридически, а не только по ощущению.
    expect(mail.htmlContent).toMatch(/unsubscribe\?email=/);
    expect(mail.textContent).toMatch(/Отписаться/);
    // Адрес в ссылке отписки экранирован: почта с плюсом или кириллицей не
    // должна ломать ссылку.
    const withPlus = buildLaunchEmail(slug, "kto+tag@primer.ru");
    expect(withPlus.htmlContent).toContain("kto%2Btag%40primer.ru");
  });

  test.each(Object.keys(LAUNCH_MODULES))("%s: ни цены, ни скидки в письме", (slug) => {
    // Цена либо не назначена (мультичат), либо отсутствует в прайсе вовсе
    // (DevHub: $149 стоит только в плане запуска). Обещать в письме то, что
    // нельзя оплатить, — худший вид обещания: человек уже впустил нас в почту.
    const mail = buildLaunchEmail(slug, "kto@primer.ru");
    const all = `${mail.subject} ${mail.htmlContent} ${mail.textContent ?? ""}`;
    expect(all).not.toMatch(/\$\s?\d/);
    expect(all).not.toMatch(/скидк/i);
    expect(all).not.toMatch(/\d+\s?%/);
  });

  test("метки письма позволяют потом отличить рассылку запуска от прочих", () => {
    const mail = buildLaunchEmail("devhub", "kto@primer.ru");
    expect(mail.tags).toContain("launch");
    expect(mail.tags).toContain("launch-devhub");
  });

  test("неизвестный модуль — отказ, а не письмо ни о чём", () => {
    expect(() => buildLaunchEmail("нет-такого", "kto@primer.ru")).toThrow(/неизвестный модуль/);
    expect(() => planLaunchAnnounce("нет-такого", [])).toThrow(/неизвестный модуль/);
  });
});

describe("даты запуска взяты из одного места", () => {
  test("все пять модулей описаны и даты непустые", () => {
    // Если модуль появится в плане запуска, но не здесь, рассылка о нём просто
    // не уйдёт — тихо. Пусть отсутствие будет видно счётом.
    const slugs = Object.keys(LAUNCH_MODULES);
    expect(slugs.length).toBeGreaterThanOrEqual(5);
    for (const s of slugs) {
      expect(LAUNCH_MODULES[s].date.length).toBeGreaterThan(3);
      expect(LAUNCH_MODULES[s].page.startsWith("/")).toBe(true);
      expect(LAUNCH_MODULES[s].opens.length).toBeGreaterThan(10);
    }
  });
});
