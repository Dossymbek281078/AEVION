import { describe, test, expect } from "vitest";
import { welcomeHtml, welcomeText, type Subscription } from "../src/routes/provisioning";
import { computeFan, FAN_WINDOW_DAYS } from "../src/data/fanDiscounts";
import { getModulePrice } from "../src/data/pricing";

/**
 * Welcome-письмо собирается строковой конкатенацией — если вёрстка или
 * подстановка сломается, узнаем от покупателя, а не от CI. Здесь проверяются
 * инварианты, а не байт-в-байт снапшот: снапшот пришлось бы обновлять на каждую
 * правку копирайта, и он перестал бы что-либо значить.
 */

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_test",
    ts: "2026-07-26T12:00:00.000Z",
    email: "buyer@test.dev",
    tierId: "lite",
    period: "monthly",
    seats: 1,
    modules: ["qsign"],
    trialDays: 0,
    ...over,
  };
}

describe("welcome-письмо", () => {
  test("никаких неразрешённых подстановок ${...} в письме", () => {
    // Классический баг строковых шаблонов: опечатка в имени переменной оставляет
    // литеральный ${...} в письме, которое уже ушло клиенту.
    for (const body of [welcomeHtml(sub()), welcomeText(sub())]) {
      expect(body).not.toMatch(/\$\{/);
    }
  });

  test("покупатель Universe видит «Universe», а не «Lite»", () => {
    // Регрессия 2026-07-26: TIER_DISPLAY.pro стоял "Lite", и подписчик за
    // $249.99/мес получал письмо «Добро пожаловать в AEVION Lite».
    const html = welcomeHtml(sub({ tierId: "pro", modules: [] }));
    expect(html).toContain("Universe");
    expect(html).not.toContain("AEVION Lite!");
  });

  test("веерный блок показывает те же цены, что считает движок", () => {
    const s = sub();
    const html = welcomeHtml(s);
    const fan = computeFan({ tierId: s.tierId, owned: s.modules, lastPurchaseAt: s.ts });
    const top = fan.offers.filter((o) => o.discountPercent > 0).slice(0, 4);
    expect(top.length).toBeGreaterThan(0);
    for (const o of top) {
      expect(html).toContain(o.module);
      expect(html).toContain(`$${o.priceMonthly}`);
      expect(html).toContain(`−${o.discountPercent}%`);
    }
    // Дата закрытия окна — в письме, иначе дедлайн существует только в UI.
    const until = new Date(Date.parse(s.ts) + FAN_WINDOW_DAYS * 86_400_000).toLocaleDateString("ru-RU");
    expect(html).toContain(until);
  });

  test("текстовая версия несёт тот же веер, что HTML", () => {
    const s = sub();
    const text = welcomeText(s);
    const first = computeFan({ tierId: s.tierId, owned: s.modules, lastPurchaseAt: s.ts })
      .offers.filter((o) => o.discountPercent > 0)[0];
    expect(text).toContain(first.module);
    expect(text).toContain(`$${first.priceMonthly}`);
  });

  test("тариф full: предлагать нечего → веерного блока нет вовсе", () => {
    const html = welcomeHtml(sub({ tierId: "full" }));
    expect(html).not.toContain("ВЕЕРНАЯ СКИДКА");
  });

  test("окно закрыто → веерного блока нет (никаких «скидка была»)", () => {
    const html = welcomeHtml(sub({ ts: "2026-01-01T00:00:00.000Z" }));
    expect(html).not.toContain("ВЕЕРНАЯ СКИДКА");
  });

  test("веер письма учитывает поштучные покупки (не только подписку)", () => {
    // Покупки одиночных приложений живут в таблице AppSubscription, а не в
    // subscription.modules. Пока welcomeHtml читал только подписку, купивший
    // CyberChess отдельно получал письмо БЕЗ веера, хотя веер у него открыт —
    // та же слепота, что была у /fan/me.
    const s = sub({ tierId: "lite", modules: [] });
    const withoutApps = welcomeHtml(s);
    const withApps = welcomeHtml(s, ["cyberchess", "aevion-ip-bureau"]);

    // Без поштучных покупок предлагать нечего (Lite без выбранного модуля).
    expect(withoutApps).not.toContain("ВЕЕРНАЯ СКИДКА");
    // С ними веер появляется, и в нём соседи по контурам обоих модулей.
    expect(withApps).toContain("ВЕЕРНАЯ СКИДКА");
    const fan = computeFan({
      tierId: s.tierId,
      owned: ["cyberchess", "aevion-ip-bureau"],
      lastPurchaseAt: s.ts,
    });
    const top = fan.offers.filter((o) => o.discountPercent > 0).slice(0, 4);
    expect(top.length).toBeGreaterThan(0);
    for (const o of top) expect(withApps).toContain(o.module);
    // Сам купленный модуль себе же не предлагается.
    expect(withApps).not.toContain(">cyberchess<");
  });

  test("в письме нет модуля, который покупатель уже купил", () => {
    const s = sub({ modules: ["qsign", "qright"] });
    const html = welcomeHtml(s);
    // qright куплен — он не должен предлагаться со скидкой в веерной таблице.
    const fanTableStart = html.indexOf("ВЕЕРНАЯ СКИДКА");
    const fanTable = html.slice(fanTableStart, fanTableStart + 1200);
    expect(fanTable).not.toContain(">qright<");
    expect(getModulePrice("qright")).toBeTruthy(); // модуль существует, дело не в опечатке
  });
});
