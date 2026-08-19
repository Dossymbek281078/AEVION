import { describe, expect, test, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// Выгрузка заявок обязана говорить о себе правду — 19.08.2026.
//
// ЗАЧЕМ. По этому файлу принимают решения: сколько людей ждёт запуска и из каких
// каналов пришли. До починки (`d1ca730cb`, взята в ветку) выгрузка при сбое
// запроса к базе молча подставляла список из памяти и отдавала его как полный —
// владелец видел три строки и делал вывод, что заявок нет.
//
// Починка не в том, чтобы память не подставлять (запасной путь полезен), а в том,
// что признак подставленных данных лежит В САМИХ ДАННЫХ: `source`,
// `dbQueryFailed`, `truncated`, `rowCap`. Для CSV те же признаки уходят
// заголовками, потому что в файл их не положить, а файл в любом случае выглядит
// одинаково полным.
//
// Тест сторожит именно эти признаки. Без него первая же «чистка ответа» уберёт их
// как лишние поля, и выгрузка снова начнёт врать молча.
//
// Базы в тестовом окружении нет, поэтому ручка идёт по запасному пути — ровно тот
// случай, который и надо проверить.

const SECRET = "test-secret-for-waitlist-export-honesty-000";

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = SECRET;
  // Базы в тестах нет, и ручка это выясняет ПОПЫТКОЙ подключения. Пул по
  // умолчанию ждёт её 5 секунд (PG_POOL_CONN_MS), а при полном прогоне —
  // 122 файла параллельно — этого хватало, чтобы тест падал по таймауту в 10 с,
  // будучи зелёным в одиночку. Падало при этом не там, где причина.
  //
  // Сокращаем ожидание, а не поднимаем лимит теста: причина в ожидании
  // соединения, которого здесь и не должно быть. Vitest изолирует модули по
  // файлу, поэтому пул в этом файле создаётся уже с этим значением.
  process.env.PG_POOL_CONN_MS = "150";
  process.env.PG_STATEMENT_TIMEOUT_MS = "500";
});

function adminToken(): string {
  return jwt.sign({ sub: "admin-1", email: "a@a.test", role: "admin" }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

async function mount() {
  const { constitutionWaitlistAdminRouter } = await import("../src/routes/constitutionWaitlist");
  const app = express();
  app.use(express.json());
  app.use("/api/constitution/waitlist", constitutionWaitlistAdminRouter);
  return app;
}

describe("выгрузка заявок — признаки честности", () => {
  test(
    "без админского токена не отдаётся вовсе",
    async () => {
      // Список адресов — персональные данные: закрыт он не «на всякий случай».
      const app = await mount();
      const r = await request(app).get("/api/constitution/waitlist/list");
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("admin_required");
    },
    // Страховка: этот случай первый, он и платит за создание пула.
    20_000,
  );

  test("JSON называет источник данных, а не только строки", async () => {
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.status).toBe(200);
    // Четыре признака, каждый отвечает на свой вопрос: откуда список, не упал ли
    // запрос, не обрезан ли, и каков предел обрезки.
    expect(r.body).toHaveProperty("source");
    expect(["postgres", "memory"]).toContain(r.body.source);
    expect(r.body).toHaveProperty("dbQueryFailed");
    expect(typeof r.body.dbQueryFailed).toBe("boolean");
    expect(r.body).toHaveProperty("truncated");
    expect(typeof r.body.truncated).toBe("boolean");
    expect(r.body).toHaveProperty("rowCap");
    expect(r.body.rowCap).toBeGreaterThan(0);
  });

  test("без базы источник назван памятью — а не выдан за postgres", async () => {
    // Главное утверждение теста. В тестовом окружении базы нет, значит ответ
    // обязан признаться, что список из памяти.
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.body.source).toBe("memory");
    // truncated имеет смысл только для базы: у памяти обрезки нет, и говорить
    // «не обрезан» о неполном списке было бы вторым обманом.
    expect(r.body.truncated).toBe(false);
  });

  test("CSV несёт те же признаки заголовками — в файл их не положить", async () => {
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list?format=csv")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.headers["x-data-source"]).toBe("memory");
    expect(r.headers["x-data-truncated"]).toBe("false");
    // Шапка на месте, иначе файл не откроется таблицей.
    expect(r.text.split("\n")[0]).toBe("email,source,createdAt");
  });

  test("CSV отдаётся как вложение с именем файла", async () => {
    // Иначе браузер покажет его текстом, и человек скопирует руками с потерями.
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list?format=csv")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.headers["content-disposition"]).toMatch(/attachment/);
    expect(r.headers["content-disposition"]).toMatch(/\.csv/);
  });

  test("total описывает выданное, и рядом есть чем это понять", async () => {
    // `total` — это «сколько отдали», а не «сколько есть». Поэтому проверяем не
    // само число, а что рядом с ним стоят признаки, по которым его можно
    // истолковать.
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    if ("total" in r.body) {
      expect(typeof r.body.total).toBe("number");
      expect(r.body).toHaveProperty("source");
      expect(r.body).toHaveProperty("truncated");
    }
  });
});
