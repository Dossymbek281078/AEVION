/*
 * Снятое с продажи НЕЛЬЗЯ купить: ни кнопкой на витрине, ни запросом в кассу.
 *
 * 🔴 Повод, замер 01.10.2026 на живой кассе. У qright, qsign, qskyway и
 * startup_exchange нет своего товара в LemonSqueezy, покупка шла вариантом
 * ПЛАНЕТЫ с нашей ценой, и человек читал на странице оплаты:
 *     AEVION QRight Lite — 1 месяц (AEVION Planet — Lite (1 mo))
 *     24,00 $     $400.00 billed every month
 * Контроль того же дня: DevHub со своим товаром даёт «200,00 $ / $200.00
 * billed every month» — числа совпадают, планета не упомянута.
 *
 * Сторож делает ЗАПРОСЫ к ручкам из того же модуля, что в проде, и смотрит
 * ТЕЛО ответа: проверять свою копию правила бессмысленно — она совпадёт с
 * собой при любой ошибке.
 */
import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { pricingRouter } from "../src/routes/pricing";
import { checkoutRouter } from "../src/routes/checkout";
import { ДОСТУП_МОДУЛЕЙ, продаётсяОтдельно } from "../src/data/moduleAccess";
import { STANDALONE_APPS } from "../src/data/pricing";

/** Снятые 01.10 — по слагам кассы, как их присылает витрина в поле `app`. */
const СНЯТЫЕ_СЛАГИ = ["qright", "qsign", "qskyway", "startup_exchange"];
/** Оставшиеся со своими товарами — контроль в обратную сторону. */
const ПРОДАЮТСЯ_СЛАГИ = ["devhub", "multichat", "cyberchess", "ip_bureau", "qventure"];

/*
 * 🔴 Монтируем ОБА роутера, и путь кассы — ровно тот, что в проде
 * (`src/index.ts`: `app.use("/api/pricing/checkout", checkoutRouter)`).
 *
 * Первая версия этого сторожа монтировала только `pricingRouter` и проверяла
 * «касса ответила 4xx». Она была ЗЕЛЁНОЙ — но по другой причине: ручки просто
 * не было, и приходил `404 {}`. Контроль это и показал: 404 приходил и на
 * devhub, и на multichat, и на ВЫДУМАННОЕ имя. То есть сторож подтверждал
 * собственную слепоту. Поэтому ниже у каждого утверждения стоит контроль на
 * продаваемом: ответы обязаны РАЗЛИЧАТЬСЯ.
 */
function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/checkout", checkoutRouter);
  app.use("/api/pricing", pricingRouter);
  return app;
}

describe("снятое с продажи не купить ни кнопкой, ни запросом", () => {
  it("контроль набора: слаги взяты из прайса, а не придуманы", () => {
    // Без этого тест мог бы проверять несуществующие имена и быть зелёным.
    const вПрайсе = new Set(STANDALONE_APPS.map((a) => a.slug));
    for (const s of [...СНЯТЫЕ_СЛАГИ, ...ПРОДАЮТСЯ_СЛАГИ]) {
      expect(вПрайсе.has(s), `слага ${s} нет в прайсе — проверка смотрит в пустоту`).toBe(true);
    }
    expect(СНЯТЫЕ_СЛАГИ.length + ПРОДАЮТСЯ_СЛАГИ.length).toBe(STANDALONE_APPS.length);
  });

  it("ВИТРИНА: снятых нет в выдаче /api/pricing, оставшиеся есть", async () => {
    const r = await request(приложение()).get("/api/pricing");
    expect(r.status).toBe(200);
    const слаги: string[] = (r.body.standaloneApps ?? []).map((a: { slug: string }) => a.slug);

    expect(слаги.length, "ручка не отдала ни одного приложения — проверять нечего").toBe(5);
    for (const s of СНЯТЫЕ_СЛАГИ) {
      expect(слаги, `${s} снят с продажи, а витрина его показывает — кнопка «Купить» жива`).not.toContain(s);
    }
    // Контроль: иначе тест прошёл бы и на пустой выдаче.
    for (const s of ПРОДАЮТСЯ_СЛАГИ) {
      expect(слаги, `${s} продаётся, а витрина его потеряла`).toContain(s);
    }
  });

  it("КАССА: на снятое приходит отказ, а не вариант планеты", async () => {
    /*
     * Форма тела — ровно та, что посылает витрина (frontend/src/app/pricing:
     * `{ tierId, app, seats, currency }`). Посылать `appId` нельзя: запрос
     * вырождается в покупку планеты, и получится ложное «всё плохо у всех» —
     * на этом я уже ошибался 29.09.
     */
    const спросить = (s: string) =>
      request(приложение())
        .post("/api/pricing/checkout/session")
        .send({ tierId: "lite", app: s, seats: 1, currency: "USD" });

    for (const s of СНЯТЫЕ_СЛАГИ) {
      const r = await спросить(s);
      // Именно 400 invalid_app, а не 503: положение дел постоянное, а 503
      // означает «у нас сломалось, зайдите позже» и поднимает людей зря.
      expect(r.status, `${s}: ожидали 400, пришло ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`).toBe(400);
      expect(r.body?.error, `${s}: отказ не назвал причину`).toBe("invalid_app");
      expect(r.body?.url, `${s}: отказ пришёл вместе со ссылкой на оплату`).toBeFalsy();
    }

    /*
     * 🔴 КОНТРОЛЬ, без которого сторож зелёный не за то. В тестах касса не
     * настроена, и ПЕРВАЯ версия этой проверки («статус ≥ 400») проходила на
     * ответе 503 `checkout_unavailable`, который приходил ОДИНАКОВО и снятым, и
     * продаваемым: замер 01.10 дал 503 у qright, qskyway, devhub и multichat
     * разом. То есть различия не было вовсе. Теперь ответы обязаны РАЗЛИЧАТЬСЯ:
     * снятое — 400 invalid_app, продаваемое — не invalid_app.
     */
    for (const s of ПРОДАЮТСЯ_СЛАГИ) {
      const r = await спросить(s);
      expect(
        r.body?.error,
        `${s} продаётся, а касса зовёт его «отдельно не продаётся» — правило задето лишним`,
      ).not.toBe("invalid_app");
    }

    // И выдуманное имя по-прежнему отбивается — иначе проверка потеряла бы
    // прежнее поведение, которое мы не меняли.
    const чужое = await спросить("выдуманное-приложение");
    expect(чужое.status).toBe(400);
    expect(чужое.body?.error).toBe("invalid_app");
  });

  it("источник и витрина об этом СОГЛАСНЫ (один ответ, не два)", () => {
    for (const s of СНЯТЫЕ_СЛАГИ) {
      const app = STANDALONE_APPS.find((a) => a.slug === s);
      expect(продаётсяОтдельно(app!.moduleId), `${s}: источник всё ещё считает его продаваемым`).toBe(false);
    }
    expect(ДОСТУП_МОДУЛЕЙ.filter((м) => м.продаётся).length, "продаваемых не 5").toBe(5);
  });
});
