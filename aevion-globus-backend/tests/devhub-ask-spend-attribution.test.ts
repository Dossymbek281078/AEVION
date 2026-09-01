import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// Расход анонимных обращений к платному ИИ должен быть ОТДЕЛИМ от расхода
// платящих. До 31.08 обе половины шли в учёт одной меткой "devhub", и на
// вопрос «сколько стоят анонимные» ответить было нечем: число существовало,
// но было суммой двух разных вещей.
//
// Сторож проверяет СЛЕДСТВИЕ (какая метка ушла в учёт), а не форму вызова.

const { calls } = vi.hoisted(() => ({ calls: [] as any[] }));

vi.mock("../src/services/qcoreai/smartComplete", () => ({
  smartComplete: vi.fn(async (_input: any, opts: any) => {
    calls.push(opts);
    return { answer: "ok", routing: {} };
  }),
}));

const { runs, provider } = vi.hoisted(() => ({
  runs: [] as any[],
  // Ответ поставщика — в ИЗМЕНЯЕМОМ поле, а не подменой экспорта.
  // Подмена экспорта насовсем протекла в соседний тест: он получал
  // чужие токены и падал на сверке цены. Поймано падением.
  provider: { reply: "", tokensIn: 1000, tokensOut: 500, throws: false },
}));
vi.mock("../src/lib/smartRunLog", () => ({
  insertSmartRun: (row: any) => { runs.push(row); },
}));
// Поставщик подменён так, чтобы вернуть ТОКЕНЫ: без них цена всегда 0,
// и проверка «расход записан» прошла бы на сломанном учёте.
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [{ id: "openai", defaultModel: "gpt-4o-mini", configured: true }],
  callProvider: async () => {
    if (provider.throws) throw new Error("провайдер недоступен");
    return {
    reply: provider.reply || JSON.stringify({ summary: "s", milestones: [] }),
    model: "gpt-4o-mini",
      usage: { prompt_tokens: provider.tokensIn, completion_tokens: provider.tokensOut },
    };
  },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

const SECRET = "test-secret-for-devhub-ask-attribution-long-enough";

async function app() {
  process.env.AUTH_JWT_SECRET = SECRET;
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("расход /ask отделим: анонимный от вошедшего", () => {
  beforeEach(() => { calls.length = 0; });

  test("без входа расход помечается как анонимный", async () => {
    const res = await request(await app())
      .post("/api/devhub/ask")
      .send({ question: "как собрать проект" });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].module).toBe("devhub-anon");
  });

  test("со входом расход помечается как обычный", async () => {
    const token = jwt.sign({ sub: "user-42" }, SECRET);
    const res = await request(await app())
      .post("/api/devhub/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "как собрать проект" });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].module).toBe("devhub");
  });

  test("две половины НЕ совпадают — иначе отделить нельзя", async () => {
    await request(await app()).post("/api/devhub/ask").send({ question: "a" });
    const anon = calls[0].module;
    calls.length = 0;
    const token = jwt.sign({ sub: "user-42" }, SECRET);
    await request(await app())
      .post("/api/devhub/ask")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "a" });
    // Именно это утверждение ловит откат к одной метке на обе половины:
    // проверки по отдельности переживут его, если обе станут "devhub".
    expect(anon).not.toBe(calls[0].module);
  });
});

describe("расход /plan попадает в учёт и отделим", () => {
  beforeEach(() => {
    runs.length = 0;
    // Возврат к исходному: иначе один тест меняет вход другому.
    provider.reply = "";
    provider.tokensIn = 1000;
    provider.tokensOut = 500;
    provider.throws = false;
  });

  test("без входа расход записан и помечен как анонимный", async () => {
    const res = await request(await app())
      .post("/api/devhub/plan")
      .send({ idea: "магазин носков" });
    expect(res.status).toBe(200);
    // Считаем ПРИРОСТ записей, а не наличие: строка могла остаться от соседа.
    expect(runs).toHaveLength(1);
    expect(runs[0].module).toBe("devhub-anon");
  });

  test("отказ ИИ — это 200 с ok:false, а НЕ пятисотка", async () => {
    // Договор честности: планировщик не бросает при отказе поставщика, а
    // возвращает ok:false. Витрина это читает (data.ok === false) и говорит
    // человеку. Проверено 31.08.2026 по обеим сторонам.
    //
    // Закрепляю проверкой, а не комментарием: соблазн «привести к общему
    // виду» и отдавать 5xx выглядит как уборка, а сломает две вещи разом —
    // сообщение человеку и чистоту Sentry. Пятисотка означает «у нас
    // сломалось» и поднимает людей; отказ чужого поставщика — не наша авария.
    provider.reply = "";
    provider.throws = true;
    const res = await request(await app())
      .post("/api/devhub/plan")
      .send({ idea: "магазин носков" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
  });

  test("деньги потрачены — учёт есть, даже если ответ не разобрался", async () => {
    // Учёт стоит СРАЗУ после вызова поставщика, до разбора ответа, и это
    // не косметика: поставщику уже заплачено. Разбери мы ответ неудачно —
    // расход всё равно состоялся, и не записать его значит занизить сумму
    // ровно в тех случаях, когда что-то пошло не так.
    //
    // Перенос строки учёта ПОСЛЕ разбора выглядел бы безобидной уборкой.
    provider.reply = "это не JSON";   // разбор упадёт
    const res = await request(await app())
      .post("/api/devhub/plan")
      .send({ idea: "магазин носков" });
    // Ответ может быть любым — важно, что расход записан.
    expect([200, 500, 502]).toContain(res.status);
    expect(runs).toHaveLength(1);
    expect(runs[0].costUsd).toBeGreaterThan(0);
  });

  test("цена не нулевая — иначе учёт есть только на вид", async () => {
    await request(await app()).post("/api/devhub/plan").send({ idea: "магазин носков" });
    // Прежняя редакция утверждала costUsd > 0 и была СЛАБЕЕ своего названия:
    // мутация «обнулить prompt_tokens» её пережила — цену вытягивал второй
    // счётчик. Поймано мутацией, не глазами.
    //
    // Сверяем с ценой, посчитанной платформенной таблицей от ТЕХ ЖЕ токенов:
    // потеря любого из двух входов теперь меняет число и ловится.
    const { costUsd } = await import("../src/services/qcoreai/pricing");
    expect(runs[0].costUsd).toBe(costUsd("openai", "gpt-4o-mini", 1000, 500));
    expect(runs[0].costUsd).toBeGreaterThan(0);   // контроль: модель с ценой
  });

  test("генерация кода ЗАПИСЫВАЕТ расход — проверка следствия, а не наличия кода", async () => {
    // Сторож devhubSpendAccountingRatchet проверяет, что учёт ЕСТЬ В КОДЕ.
    // Это утверждение о форме: оно осталось бы зелёным при учёте, который
    // никогда не вызывается. Здесь проверяется следствие — после генерации в
    // журнале расхода появляется запись с меткой генерации.
    //
    // Почему это важнее обычного: до 01.09.2026 генерация — главная платная
    // работа модуля — не писала расход ВООБЩЕ, и её траты не входили ни в один
    // наш отчёт. Найдено не просмотром кода, а вопросом «кто ещё не пишет».
    runs.length = 0;
    provider.reply = JSON.stringify({
      files: [{ path: "index.html", content: "<h1>привет</h1>" }],
      summary: "готово",
    });
    const a = await app();
    const созд = await request(a).post("/api/devhub/projects").send({ name: "проверка учёта" });
    expect(созд.status, "проект не создался — проверять нечего").toBe(201);
    const id = созд.body?.project?.id ?? созд.body?.id;
    expect(id, "нет идентификатора проекта").toBeTruthy();

    await request(a).post(`/api/devhub/projects/${id}/generate`).send({ prompt: "страница с приветом" });

    const генерации = runs.filter((r: any) => String(r.module).includes("generate"));
    expect(
      генерации.length,
      "генерация не записала расход. Именно так её траты были невидимы до 01.09: " +
        "она зовёт поставщика напрямую, минуя службу, где учёт встроен.",
    ).toBeGreaterThan(0);
  });
});
