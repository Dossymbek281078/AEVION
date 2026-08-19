import { describe, expect, test, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Путь новичка целиком, без браузера и без записи в боевую базу — 20.08.2026.
//
// ЗАЧЕМ. Ворота запуска требуют пройти путь человека до конца. Утром я закрыл этот
// пункт неправильно — настоящей отправкой на прод, и в боевом списке подписчиков
// остались четыре тестовых адреса, которые придётся удалять руками. Второй раз так
// делать нельзя (feedback_never_test_prod_mutating_scripts), а пункт закрыть надо.
//
// Здесь путь идёт через НАСТОЯЩИЙ роутер и настоящие сборщики письма; наружу не
// уходит ничего: перехватывается транспорт (fetch к Brevo), и проверяется то, что
// человек РЕАЛЬНО получил бы — тема и текст, а не факт вызова.
//
// Почему через транспорт, а не подменой sendWaitlistConfirm: подмена доказала бы
// только, что функцию позвали. Разрыв, который я чинил 19.08, был именно в
// содержимом — роут не передавал источник, и человеку с посадочной модуля уходило
// письмо про Constitution Pro со скидкой, о которой он не просил.

beforeAll(() => {
  process.env.BREVO_API_KEY = "test-key-not-a-real-one";
  // Базы в тестах нет; ручка выясняет это попыткой подключения, и без укороченного
  // ожидания полный прогон падал бы по таймауту не там, где причина.
  process.env.PG_POOL_CONN_MS = "150";
  process.env.PG_STATEMENT_TIMEOUT_MS = "500";
});

type Sent = { url: string; body: any };
let sent: Sent[] = [];

function stubTransport() {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init: any) => {
      sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<test@brevo>" }),
        text: async () => "",
      } as unknown as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount() {
  const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
  const app = express();
  app.use(express.json());
  app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  return app;
}

/** Письмо уходит вслед за ответом, поэтому ЖДЁМ события, а не фиксированную паузу. */
async function waitForLetter(ms = 3000): Promise<Sent | null> {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const letter = sent.find((s) => s.url.includes("brevo"));
    if (letter) return letter;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe("путь новичка: оставил адрес на посадочной — получил письмо про ЭТОТ модуль", () => {
  test("подписка с посадочной DevHub принимается", async () => {
    stubTransport();
    const app = await mount();
    const r = await request(app)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email: "novichok-devhub@primer.test", source: "devhub" });
    expect([200, 201]).toContain(r.status);
    expect(r.body?.ok ?? true).not.toBe(false);
  });

  test("письмо уходит и НЕ обещает Constitution Pro со скидкой", async () => {
    stubTransport();
    const app = await mount();
    await request(app)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email: "novichok-2@primer.test", source: "devhub" });

    const letter = await waitForLetter();
    expect(letter, "письмо не ушло вовсе — человек подписался и ничего не получил").not.toBeNull();
    const all = `${letter!.body?.subject ?? ""} ${JSON.stringify(letter!.body ?? {})}`;
    expect(all).not.toMatch(/Constitution Pro/i);
    expect(all).not.toMatch(/30%/);
    expect(letter!.body?.to?.[0]?.email).toBe("novichok-2@primer.test");
  });

  test("подписчик конституции по-прежнему получает своё письмо", async () => {
    // Отрицательный контроль: правка не должна отобрать письмо у того, кому оно
    // и предназначалось. Без этого «не Constitution» проходило бы, даже если бы
    // конституционная ветка сломалась целиком.
    stubTransport();
    const app = await mount();
    await request(app)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email: "novichok-3@primer.test", source: "constitution" });

    const letter = await waitForLetter();
    expect(letter).not.toBeNull();
    expect(`${letter!.body?.subject ?? ""}`).toMatch(/Constitution/i);
  });

  test("наружу не ушло ничего, кроме одного письма", async () => {
    // Проба сама не должна оказаться источником трафика: если роут вдруг начнёт
    // звать провайдера дважды, человек получит два письма на одну подписку.
    stubTransport();
    const app = await mount();
    await request(app)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email: "novichok-4@primer.test", source: "devhub" });
    await waitForLetter();
    const toBrevo = sent.filter((s) => s.url.includes("brevo"));
    expect(toBrevo.length).toBe(1);
  });
});
