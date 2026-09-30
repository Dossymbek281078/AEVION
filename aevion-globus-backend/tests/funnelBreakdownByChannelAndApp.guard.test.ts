import { describe, it, expect } from "vitest";
import { разрезВоронки } from "../src/routes/events";

/**
 * РАЗРЕЗ ВОРОНКИ ПО КАНАЛУ И ПРИЛОЖЕНИЮ.
 *
 * Повод 29.09.2026. Сводка /funnel отдавала четыре числа и разбивку по дням —
 * и дважды за день это стоило разбора: окно роликов не могло сказать, привели
 * ли 144 просмотра хоть один визит, а окно кассы выясняло перепиской, чьи пять
 * начал оплаты (оказалось — пробы окна цен). Метка канала в событиях есть,
 * наружу не выходила.
 *
 * Проверяется ТА ЖЕ функция, что работает на проде, а не её копия в тесте:
 * копия расходится с оригиналом молча.
 */

const событие = (
  type: string,
  meta?: Record<string, string | number | boolean | null>,
  path?: string,
  sid?: string,
) => ({ type, meta, path, sid });

describe("разрез воронки", () => {
  it("считает шаги по каналам", () => {
    const r = разрезВоронки([
      событие("page_view", { channel: "youtube" }, "/"),
      событие("page_view", { channel: "youtube" }, "/pricing"),
      событие("page_view", { channel: "product-hunt" }, "/pricing"),
      событие("checkout_start", { channel: "youtube", app: "multichat" }),
      событие("checkout_success", { channel: "youtube", app: "multichat" }),
    ]);
    // 🔴 30.09.2026 смысл `paid` ИСПРАВЛЕН, и ожидание пришлось поправить.
    // Раньше он считал `checkout_success` — событие загрузки страницы «спасибо».
    // Разрез отдавал на проде «direct: paid 3» при нуле подтверждённых оплат в
    // итоге, то есть отвечал ложью на главный вопрос. Теперь `paid` — это
    // подтверждение КАССЫ, а открытия страницы возврата живут полем
    // `thankYouOpened`, как и в итоге.
    expect(r.byChannel["youtube"]).toEqual({
      visits: 2,
      pricing: 1,
      checkoutStart: 1,
      checkoutStartOurs: 0,
      thankYouOpened: 1,
      paid: 0,
      paidOurs: 0,
    });
    expect(r.byChannel["product-hunt"]).toEqual({
      visits: 1,
      pricing: 1,
      checkoutStart: 0,
      checkoutStartOurs: 0,
      thankYouOpened: 0,
      paid: 0,
      paidOurs: 0,
    });
  });

  it("«без метки» и «метка неизвестна» — РАЗНЫЕ ответы", () => {
    // Их слияние прячет целые площадки: ровно так Product Hunt весь день
    // выглядел прямыми заходами.
    const r = разрезВоронки([
      событие("page_view", {}, "/"),
      событие("page_view", { channel: "unknown" }, "/"),
    ]);
    expect(r.byChannel["direct"].visits).toBe(1);
    expect(r.byChannel["unknown"].visits).toBe(1);
  });

  it("покупка плана не пропадает: считается под ключом plan", () => {
    const r = разрезВоронки([
      событие("checkout_start", { channel: "direct" }),
      // Оплата теперь приходит событием подтверждения кассы, а не загрузкой
      // страницы. Имя приложения приносит сам вебхук (meta.app), иначе разрез
      // сложил бы ВСЕ оплаты в «plan» и на вопрос «что покупают» отвечал бы
      // «план», что бы ни купили.
      событие("payment_confirmed", { channel: "direct", app: "qskyway" }),
    ]);
    expect(r.byApp["plan"]).toEqual({ checkoutStart: 1, paid: 0 });
    expect(r.byApp["qskyway"]).toEqual({ checkoutStart: 0, paid: 1 });
  });

  it("сумма по каналам сходится с суммой по приложениям", () => {
    const события = [
      событие("checkout_start", { channel: "yt", app: "multichat" }),
      событие("checkout_start", { channel: "ph", app: "devhub" }),
      событие("checkout_success", { channel: "ph", app: "devhub" }),
    ];
    const r = разрезВоронки(события);
    const поКаналам = Object.values(r.byChannel).reduce((a, b) => a + b.checkoutStart, 0);
    const поПриложениям = Object.values(r.byApp).reduce((a, b) => a + b.checkoutStart, 0);
    expect(поКаналам, "разрезы разошлись — одно и то же событие посчитано по-разному").toBe(поПриложениям);
  });

  it("КОНТРОЛЬ: имя канала из адреса не открывает наследство", () => {
    // Ключ приходит из адреса, который открыл посторонний. У обычного объекта
    // byChannel["constructor"] вернул бы функцию, число ушло бы в наследство, и
    // в отчёте его просто не стало бы, а сумма выглядела бы целой.
    const r = разрезВоронки([
      событие("page_view", { channel: "constructor" }, "/"),
      событие("page_view", { channel: "__proto__" }, "/"),
    ]);
    expect(r.byChannel["constructor"].visits).toBe(1);
    expect(r.byChannel["__proto__"].visits).toBe(1);
    expect(Object.keys(r.byChannel).sort()).toEqual(["__proto__", "constructor"]);
  });

  it("КОНТРОЛЬ: пустой вход даёт пустой разрез, а не выдуманные ключи", () => {
    const r = разрезВоронки([]);
    expect(Object.keys(r.byChannel)).toEqual([]);
    expect(Object.keys(r.byApp)).toEqual([]);
  });
  it("подметка поста даёт разрез по постам, не ломая канал", () => {
    // 🔴 Замер 30.09.2026: Instagram — единственный канал, приводящий людей до
    // цен, трафик идёт рывками (постами), а метка у всех ссылок одна — `?c=ig`.
    // Поэтому «какой пост сработал» ответить было нечем.
    //
    // Проверяем ОБА требования сразу: пост появился отдельным разрезом И канал
    // остался прежним. Если бы пост подмешался к имени канала, каждый пост стал
    // бы «новым каналом», и сравнить Instagram с YouTube было бы нечем.
    const r = разрезВоронки([
      событие("page_view", { channel: "instagram", post: "kartinka3" }, "/"),
      событие("page_view", { channel: "instagram", post: "kartinka3" }, "/pricing"),
      событие("page_view", { channel: "instagram", post: "video7" }, "/pricing"),
      событие("page_view", { channel: "instagram" }, "/pricing"),
    ]);

    expect(r.byChannel["instagram"].pricing, "канал обязан сложить все посты вместе").toBe(3);
    expect(Object.keys(r.byChannel).sort(), "пост превратился в отдельный канал").toEqual(["instagram"]);
    expect(r.byPost["instagram/kartinka3"]).toEqual({ visits: 2, pricing: 1, checkoutStart: 0, paid: 0 });
    expect(r.byPost["instagram/video7"]).toEqual({ visits: 1, pricing: 1, checkoutStart: 0, paid: 0 });
    expect(
      r.byPost["instagram/undefined"],
      "заход без подметки попал в выдуманный пост",
    ).toBeUndefined();
  });

  it("КОНТРОЛЬ: один пост в двух каналах не складывается в одно число", () => {
    const r = разрезВоронки([
      событие("page_view", { channel: "instagram", post: "obshchiy" }, "/pricing"),
      событие("page_view", { channel: "youtube", post: "obshchiy" }, "/pricing"),
    ]);
    expect(r.byPost["instagram/obshchiy"].pricing).toBe(1);
    expect(r.byPost["youtube/obshchiy"].pricing).toBe(1);
  });
  it("страницы входа: считается ПЕРВАЯ страница сессии, запрос и идентификаторы убраны", () => {
    // 🔴 Замер 30.09.2026: Instagram привёл 12 человек до цен, а на какие страницы
    // они пришли — ответа не было (детализация только в закрытых ручках, 401).
    // Людей приводит ПЕРВАЯ страница; остальные они смотрят уже внутри.
    const r = разрезВоронки([
      событие("page_view", { channel: "instagram" }, "/qskyway?c=ig-post1", "s1"),
      событие("page_view", { channel: "instagram" }, "/pricing", "s1"),
      событие("page_view", { channel: "instagram" }, "/pricing", "s2"),
      событие("page_view", { channel: "youtube" }, "/devhub/9f8e7d6c5b4a3210", "s3"),
      событие("checkout_start", { channel: "instagram" }, undefined, "s2"),
    ]);

    expect(
      r.byEntryPage["instagram|/qskyway"],
      "запрос не отброшен или взята не первая страница",
    ).toEqual({ сессий: 1, доЦен: 1, началиОплату: 0 });
    expect(r.byEntryPage["instagram|/pricing"]).toEqual({ сессий: 1, доЦен: 1, началиОплату: 1 });
    expect(
      r.byEntryPage["youtube|/devhub/:id"],
      "идентификатор уехал в отчёт как есть",
    ).toEqual({ сессий: 1, доЦен: 0, началиОплату: 0 });
  });

  it("КОНТРОЛЬ: предел действует ВНУТРИ канала, хвост у каждого свой", () => {
    // 🔴 Замер 30.09.2026 сразу после выкатки: предел был один на все каналы, и у
    // Instagram в разрезе осталась ровно ОДНА страница входа — остальные его
    // страницы провалились в общий хвост вместе с чужими. На вопрос «куда
    // приходят люди с ЭТОГО канала» такой разрез отвечает только про самый
    // крупный канал. Теперь предел на канал, и хвост подписан каналом.
    const события = [];
    // Один канал с большим числом страниц — его хвост должен быть своим.
    for (let i = 0; i < 20; i += 1) {
      события.push(событие("page_view", { channel: "instagram" }, `/stranica${i}`, `ig${i}`));
    }
    // И маленький канал: одна страница, он НЕ должен потеряться из-за соседа.
    события.push(событие("page_view", { channel: "youtube" }, "/go", "yt1"));

    const r = разрезВоронки(события);
    const ключи = Object.keys(r.byEntryPage);

    expect(
      ключи.some((k) => k === "youtube|/go"),
      `маленький канал потерялся: ${ключи.join(", ")}`,
    ).toBe(true);
    expect(ключи, "хвост не подписан каналом").toContain("instagram|прочие");
    expect(ключи, "остался общий хвост на все каналы").not.toContain("прочие");

    const игКлючи = ключи.filter((k) => k.startsWith("instagram|"));
    expect(игКлючи.length, `у канала ${игКлючи.length} ключей — предел не действует`).toBeLessThanOrEqual(9);

    const игСессий = Object.entries(r.byEntryPage)
      .filter(([k]) => k.startsWith("instagram|"))
      .reduce((а, [, т]) => а + т.сессий, 0);
    expect(игСессий, "при сворачивании хвоста потерялись сессии канала").toBe(20);
  });
});
