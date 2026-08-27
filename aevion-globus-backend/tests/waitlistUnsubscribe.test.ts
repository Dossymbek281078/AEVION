import { describe, expect, test, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

import { unsubToken, verifyUnsubToken, unsubscribeUrl } from "../src/lib/waitlistUnsubToken";

// Отписка от списка ожидания — 21.08.2026.
//
// ЗАЧЕМ ЭТОТ ФАЙЛ. До этого дня отписки не существовало ВООБЩЕ: в каждом письме
// стояла ссылка на `aevion.app/constitution/waitlist/unsubscribe`, которая отдавала
// 404 наравне с заведомо выдуманным адресом, и ручки в API тоже не было. При этом
// смоук `waitlist-unsub` был зелёным — он проверяет отписку ДРУГИХ модулей, и его
// зелёный цвет соседствовал с мёртвой ссылкой у нас. Рабочая отписка в маркетинговом
// письме — требование закона, а не вежливость, и до рассылки на запуск девять дней.

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars-long";
  process.env.PG_POOL_CONN_MS = "150";
  process.env.PG_STATEMENT_TIMEOUT_MS = "500";
});

let ipSeq = 0;
async function app() {
  const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
  const a = express();
  // Свой адрес каждому запросу: предел чтения считается по адресу, а файл делает
  // десятки запросов в одном процессе (vitest делит процесс между файлами).
  a.set("trust proxy", true);
  a.use((req, _res, next) => {
    ipSeq += 1;
    req.headers["x-forwarded-for"] = `10.5.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`;
    next();
  });
  a.use(express.json());
  a.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  return a;
}

describe("токен отписки", () => {
  test("токен зависит от адреса, а не общий на всех", () => {
    // Контроль смысла: общий токен означал бы, что по одной ссылке из чужого письма
    // отписывается кто угодно.
    const a = unsubToken("kto@primer.test");
    const b = unsubToken("drugoy@primer.test");
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test("регистр и пробелы в адресе не ломают проверку", () => {
    const t = unsubToken("kto@primer.test")!;
    expect(verifyUnsubToken("  KTO@Primer.Test  ", t)).toBe(true);
  });

  test("чужой токен не подходит", () => {
    const t = unsubToken("drugoy@primer.test")!;
    expect(verifyUnsubToken("kto@primer.test", t)).toBe(false);
  });

  test("ссылка содержит и адрес, и токен, и ведёт на существующий путь", () => {
    const url = unsubscribeUrl("kto@primer.test")!;
    expect(url).toContain("/api/constitution/waitlist/unsubscribe");
    expect(url).toContain("email=kto%40primer.test");
    expect(url).toMatch(/[?&]t=[0-9a-f]{32}/);
    // Прежний, мёртвый адрес: страницы с таким путём не существует, и вернуться он
    // не должен даже частично.
    expect(url).not.toContain("aevion.app/constitution/waitlist/unsubscribe?email");
  });
});

describe("ручка отписки различает три исхода", () => {
  test("верная ссылка — 200 и человеческий ответ", async () => {
    const a = await app();
    const email = "unsub-ok@primer.test";
    const t = unsubToken(email)!;
    const r = await request(a).get("/api/constitution/waitlist/unsubscribe").query({ email, t });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/html/);
    expect(r.text).toMatch(/больше не напишем/i);
    expect(r.text).toContain(email);
  });

  test("без токена — 400, а не тихий успех", async () => {
    const a = await app();
    const r = await request(a).get("/api/constitution/waitlist/unsubscribe").query({ email: "kto@primer.test" });
    expect(r.status).toBe(400);
    expect(r.text).toMatch(/ссылка неполная/i);
  });

  test("подделанный токен — 400 и подсказка, куда писать", async () => {
    const a = await app();
    const r = await request(a)
      .get("/api/constitution/waitlist/unsubscribe")
      .query({ email: "kto@primer.test", t: "0".repeat(32) });
    expect(r.status).toBe(400);
    expect(r.text).toMatch(/не подошла/i);
    expect(r.text).toMatch(/mailto:/);
  });

  test("страница закрыта от поисковиков", async () => {
    // Ссылка приходит в письме и содержит адрес человека — ей не место в выдаче.
    const a = await app();
    const email = "unsub-noindex@primer.test";
    const r = await request(a)
      .get("/api/constitution/waitlist/unsubscribe")
      .query({ email, t: unsubToken(email)! });
    expect(r.text).toMatch(/name="robots" content="noindex"/);
  });
});

describe("письма несут рабочую ссылку, а не прежнюю мёртвую", () => {
  test("письмо-подтверждение", async () => {
    const { buildWaitlistConfirmEmail } = await import("../src/lib/constitutionBrevo");
    const html = String(buildWaitlistConfirmEmail("kto@primer.test", "cyberchess").htmlContent);
    expect(html).toMatch(/\/api\/constitution\/waitlist\/unsubscribe\?email=[^"]+&t=[0-9a-f]{32}/);
  });

  test("письмо на запуск — и в тексте, и в разметке", async () => {
    const { buildLaunchEmail } = await import("../src/lib/launchAnnounce");
    const m = buildLaunchEmail("cyberchess", "kto@primer.test");
    expect(String(m.textContent)).toMatch(/Отписаться: https:\/\/[^\s]+t=[0-9a-f]{32}/);
    expect(String(m.htmlContent)).toMatch(/href="https:\/\/[^"]+t=[0-9a-f]{32}"/);
    // Задвоения «Отписаться: Отписаться:» быть не должно — оно уже случалось при
    // механической замене.
    expect(String(m.textContent)).not.toMatch(/Отписаться:\s*Отписаться:/);
  });
});

describe("регистр в ссылке не должен ломать удаление", () => {
  // Нашлось мутацией: если убрать приведение адреса к нижнему регистру в ручке,
  // ТОКЕН всё равно сойдётся (помощник нормализует внутри), а вот удаление
  // промахнётся мимо строки — человек увидит «готово», а письма продолжат приходить.
  // Это тихий отказ: ответ об успехе при невыполненном действии.
  //
  // Ответ ручки различает случаи словами «(его там уже не было)» — на этом и держится
  // проверка: страница не должна так говорить о том, кто в списке БЫЛ.
  test("подписался строчными, отписался ПРОПИСНЫМИ — адрес удалён", async () => {
    const a = await app();
    const email = "case-test@primer.test";
    const sub = await request(a)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email, source: "cyberchess" });
    expect([200, 201]).toContain(sub.status);

    const r = await request(a)
      .get("/api/constitution/waitlist/unsubscribe")
      .query({ email: "CASE-Test@Primer.TEST", t: unsubToken(email)! });
    expect(r.status).toBe(200);
    expect(r.text, "ручка сказала «его там не было» о том, кто в списке был").not.toMatch(/уже не было/);
  });

  test("контроль: о незнакомом адресе ручка честно говорит, что его не было", async () => {
    // Без этого контроля предыдущая проверка проходила бы и на сломанной ручке,
    // которая вообще никогда не пишет «уже не было».
    const a = await app();
    const email = "never-subscribed@primer.test";
    const r = await request(a)
      .get("/api/constitution/waitlist/unsubscribe")
      .query({ email, t: unsubToken(email)! });
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/уже не было/);
  });
});
