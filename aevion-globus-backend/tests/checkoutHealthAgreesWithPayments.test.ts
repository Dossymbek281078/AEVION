import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { TERM_TIERS, STANDALONE_APPS } from "../src/data/pricing";
import { продаётсяОтдельно } from "../src/data/moduleAccess";
import request from "supertest";
import express from "express";
import { checkoutRouter } from "../src/routes/checkout";
import { paymentsRouter } from "../src/routes/payments";

/**
 * Сторож: две ручки состояния не имеют права спорить о том, кто
 * принимает деньги.
 *
 * Повод. 29.08.2026 на проде `/api/pricing/checkout/healthz` отвечал
 * `primaryProvider: "lemonsqueezy"`, а `/api/payments/health` в тот же
 * миг — `gumroad: { primary: true }` и про LemonSqueezy не знал вовсе.
 * Причина: у второй ручки `primary` стояло КОНСТАНТОЙ. Поле выглядело
 * замером, а было литералом, и после перехода на LemonSqueezy начало
 * лгать.
 *
 * Опаснее всего тут не сама ложь, а то, что спорят ДВА НАШИХ
 * СОБСТВЕННЫХ ответа об одном и том же. Человек, разбирающийся с
 * деньгами, поверит тому, который короче и увереннее.
 *
 * Проверяем ПОВЕДЕНИЕ при обоих состояниях настроек, а не текст:
 * тест, закреплённый на одном провайдере, устареет при следующем
 * переезде и будет охранять вчерашнюю правду.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  a.use("/api/payments", paymentsRouter);
  return a;
}

const КЛЮЧИ = ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_WEBHOOK_SECRET", "LEMON_SQUEEZY_VARIANT_LITE_MONTHLY"] as const;
let было: Record<string, string | undefined> = {};

beforeEach(() => {
  было = {};
  for (const k of КЛЮЧИ) было[k] = process.env[k];
});
afterEach(() => {
  for (const k of КЛЮЧИ) {
    if (было[k] === undefined) delete process.env[k];
    else process.env[k] = было[k] as string;
  }
});

/** Кого называет основным каждая из ручек. */
async function ктоОсновной() {
  const a = app();
  const c = await request(a).get("/api/pricing/checkout/healthz");
  const p = await request(a).get("/api/payments/health");
  expect(c.status).toBe(200);
  expect(p.status).toBe(200);
  const поPayments = Object.entries(p.body as Record<string, { primary?: boolean }>)
    .filter(([, v]) => v && typeof v === "object" && v.primary === true)
    .map(([k]) => k);
  return { поCheckout: c.body.primaryProvider as string, поPayments };
}

describe("две ручки состояния согласны о том, кто принимает деньги", () => {
  test("LemonSqueezy настроен И умеет выдавать — обе называют его", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    // Секрет вебхука здесь обязателен: «основной» отвечает на вопрос, кто
    // ДОВЕДЁТ покупку, а не кто возьмёт деньги. Без него основным обязан
    // стать Gumroad — это проверяет соседний тест ниже.
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "тест-секрет";
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("lemonsqueezy");
    expect(поPayments).toEqual(["lemonsqueezy"]);
  });

  test("ключ есть, а секрета вебхука нет — основным обязан стать Gumroad", async () => {
    // Ровно тот случай, ради которого правка. Раньше основным оставался
    // LemonSqueezy: деньги брались, вебхук отвечал 200 и молча игнорировал
    // событие, выдачи не происходило. У Gumroad секрет необязателен, и
    // выдача работает — значит покупателя надо вести туда.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    // 🔴 05.10.2026: у Gumroad здесь ТЕПЕРЬ есть товар, и это не косметика. Замысел
    // теста верен («LS не доведёт покупку — ведём в Gumroad»), но допущение было
    // ложным: на проде у Gumroad не настроено НИ ОДНОЙ позиции (замер: 0 из 30).
    // Касса без товаров продать не может, поэтому «основной» её называть нельзя —
    // теперь это отдельный исход «none», и для него есть свой случай ниже.
    process.env.GUMROAD_DEFAULT_PERMALINK = "aevion";
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("gumroad");
    expect(поPayments).toEqual(["gumroad"]);
  });

  test("PayBox: задан только продавец — обе ручки говорят «не настроен»", async () => {
    // PayBox нужны И продавец, И PAYBOX_SECRET: без секрета нельзя ни
    // подписать запрос, ни проверить ответ, и модуль это знает
    // (isPayboxConfigured требует оба). checkout/healthz звал эту функцию, а
    // /api/payments/health пересобирал готовность по одному продавцу.
    //
    // Сегодня обе отвечают «нет», и разница невидима. Она проявилась бы
    // ровно в день, когда данные PayBox заданы наполовину, — то есть когда
    // основатель начнёт настраивать кассу для тенге.
    process.env.PAYBOX_MERCHANT_ID = "merchant-1";
    delete process.env.PAYBOX_SECRET;
    const a = app();
    const c = await request(a).get("/api/pricing/checkout/healthz");
    const pmt = await request(a).get("/api/payments/health");
    expect(c.body.providers.paybox.configured).toBe(false);
    expect(pmt.body.paybox.configured).toBe(false);
  });

  test("LemonSqueezy НЕ настроен — обе называют Gumroad", async () => {
    delete process.env.LEMON_SQUEEZY_API_KEY;
    delete process.env.LEMON_SQUEEZY_STORE_ID;
    process.env.GUMROAD_DEFAULT_PERMALINK = "aevion"; // см. пояснение выше: без товара касса не продаёт
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout).toBe("gumroad");
    expect(поPayments).toEqual(["gumroad"]);
  });

  test("ни одна касса не может продать — обе отвечают «none», а не называют мёртвую", async () => {
    // Состояние прода на 05.10: у Lemon Squeezy нет секрета вебхука ИЛИ ключей, у
    // Gumroad нет ни одного товара. Прежде обе ручки называли основной Gumroad —
    // то есть кассу, которая не продаёт ничего, и это читали и люди, и код.
    delete process.env.LEMON_SQUEEZY_API_KEY;
    delete process.env.LEMON_SQUEEZY_STORE_ID;
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    delete process.env.GUMROAD_DEFAULT_PERMALINK;
    const { поCheckout, поPayments } = await ктоОсновной();
    expect(поCheckout, "основной названа касса без товаров").toBe("none");
    expect(поPayments, "отчёт называет основной мёртвую кассу").toEqual([]);
  });

  test("healthz говорит не только «можно взять деньги», но и «дойдёт ли выдача»", async () => {
    // Секрет вебхука решает, дойдёт ли покупка до выдачи: без него
    // обработчик отвечает провайдеру ok и молча игнорирует событие,
    // провайдер считает доставку успешной и НЕ повторяет. Деньги
    // списаны, купленное не выдано, снаружи всё зелено.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";

    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    const без = await request(app()).get("/api/pricing/checkout/healthz");
    expect(без.body.providers.lemonsqueezy.webhookConfigured).toBe(false);
    // и при этом «можно взять деньги» остаётся правдой — то есть без
    // отдельного поля разница была бы невидима
    expect(без.body.providers.lemonsqueezy.configured).toBe(true);

    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "тест-секрет";
    const с = await request(app()).get("/api/pricing/checkout/healthz");
    expect(с.body.providers.lemonsqueezy.webhookConfigured).toBe(true);
  });

  test("healthz говорит, что реально МОЖНО КУПИТЬ, а не только «настроен»", async () => {
    // `configured` отвечает «есть ключ и магазин». Начать покупку нельзя
    // без ВАРИАНТА товара — отдельная переменная на каждый тариф. Два
    // разных вопроса под одним словом; проверяем именно РАЗНИЦУ.
    process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
    process.env.LEMON_SQUEEZY_STORE_ID = "1234";
    delete process.env.LEMON_SQUEEZY_VARIANT_LITE;

    const без = await request(app()).get("/api/pricing/checkout/healthz");
    const s1 = без.body.providers.lemonsqueezy.sellable;
    expect(s1).toBeTruthy();
    expect(s1.missing).toContain("tier_lite");
    // и при этом «настроен» остаётся true — без отдельного поля разница
    // была бы невидима
    expect(без.body.providers.lemonsqueezy.configured).toBe(true);

    process.env.LEMON_SQUEEZY_VARIANT_LITE = "12345";
    const с = await request(app()).get("/api/pricing/checkout/healthz");
    const s2 = с.body.providers.lemonsqueezy.sellable;
    expect(s2.configured).toContain("tier_lite");
    expect(s2.missing).not.toContain("tier_lite");
    // 🔴 20.09.2026: было зашито 30 — размер каталога на 15.09. В этот день
    // добавили QRight, QSign, QSkyway и Startup Exchange, стало 50, и проверка
    // покраснела, ничего не защитив: она держала снимок размера, а не условие.
    // Условие такое: ручка знает про ВСЕ позиции лестницы — ни одна не потеряна
    // между каталогом и кассой. Сверяем с источником, из которого строятся ссылки.
    // Прежние tier_*_monthly в список продаваемого по-прежнему не входят.
    //
    // 🔴 05.10.2026: приложения, СНЯТЫЕ с отдельной продажи (продаётсяОтдельно=
    // false), healthz теперь исключает из ОБОИХ списков — иначе витрина зажигала
    // живую кнопку «Buy» в мёртвую кассу (checkout.ts, фильтр по продаётсяОтдельно;
    // сторож storefrontSellableHidesRemovedApps). Поэтому вселенная позиций — это
    // тарифы плюс приложения, которые ЕЩЁ продаются отдельно, и считаем её тем же
    // предикатом, что и касса, а не снимком числа. Guard по-прежнему ловит
    // НЕнамеренную потерю среди продаваемого.
    const продаваемыхОтдельно = STANDALONE_APPS.filter((a) => продаётсяОтдельно(a.moduleId)).length;
    const всегоПозиций = TERM_TIERS.length * (1 + продаваемыхОтдельно);
    expect(s2.configured.length + s2.missing.length, "ручка знает не про все продаваемые позиции каталога").toBe(всегоПозиций);
    expect([...s2.configured, ...s2.missing]).not.toContain("tier_lite_monthly");
    delete process.env.LEMON_SQUEEZY_VARIANT_LITE;

    // Значения переменных — идентификаторы товара в чужой панели, их в
    // ответе быть не должно: возвращаем только имена ссылок.
    expect(JSON.stringify(s2)).not.toContain("12345");
  });

  test("двух основных не бывает; ноль бывает — когда продать некому", async () => {
    // 🔴 05.10.2026 требование уточнено. Было «ровно один — не ноль и не два», и это
    // закрепляло допущение, что рабочая касса есть всегда. На проде её может не быть:
    // у Lemon Squeezy нет секрета вебхука, у Gumroad не настроено ни одного товара
    // (замер: 0 из 30). Требование «ровно один» заставляло код называть основной
    // мёртвую кассу — то есть врать и людям в отчётах, и себе в маршрутизации.
    //
    // Что осталось неизменным и важно: ДВУХ основных не бывает никогда.
    for (const настроен of [true, false]) {
      if (настроен) {
        process.env.LEMON_SQUEEZY_API_KEY = "тест-ключ";
        process.env.LEMON_SQUEEZY_STORE_ID = "1234";
        process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "тест-секрет";
      } else {
        delete process.env.LEMON_SQUEEZY_API_KEY;
        delete process.env.LEMON_SQUEEZY_STORE_ID;
        delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
        delete process.env.GUMROAD_DEFAULT_PERMALINK;
      }
      const { поPayments } = await ктоОсновной();
      expect(
        поPayments.length,
        `двое основных при настройках «${настроен ? "LS готов" : "никто не продаёт"}»: ${поPayments.join(", ")}`,
      ).toBeLessThanOrEqual(1);
      // И положительная сторона: когда касса ЕСТЬ, она обязана быть названа.
      if (настроен) expect(поPayments).toEqual(["lemonsqueezy"]);
      else expect(поPayments, "продать некому — основной быть не должно").toEqual([]);
    }
  });
});
