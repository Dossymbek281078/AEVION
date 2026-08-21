import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));
vi.mock("../src/services/qcoreai/providers", () => ({ getProviders: () => [], callProvider: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { devhubGuestId, requesterId, DEVHUB_GUEST_HEADER } from "../src/lib/devhubGuest";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}
function tokenFor(sub: string) {
  const secret = process.env.AUTH_JWT_SECRET || "dev-auth-secret";
  return jwt.sign({ sub, email: `${sub}@example.com`, role: "user" }, secret, { algorithm: "HS256" });
}
const GUEST_A = "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa";
const GUEST_B = "bbbbbbbb-2222-4444-8888-bbbbbbbbbbbb";

async function createProject(app: express.Express, headers: Record<string, string>, name: string) {
  const r = await request(app).post("/api/devhub/projects").set(headers)
    .send({ name, description: name, stack: "react" });
  expect(r.status, `создание проекта «${name}» не удалось: ${r.text}`).toBe(201);
  return r.body.project.id as string;
}

beforeEach(() => { __resetDevHubStore?.(); });

describe("разбор заголовка гостя", () => {
  test("годный идентификатор получает пространство имён гостя", () => {
    expect(devhubGuestId(GUEST_A)).toBe(`guest:${GUEST_A}`);
  });

  test("отсутствие и мусор дают прежнее anonymous — старые клиенты не ломаются", () => {
    for (const bad of [undefined, null, "", "   ", "короткий", 42, {}, "a".repeat(65), "с пробелом"]) {
      expect(devhubGuestId(bad as unknown), `значение ${JSON.stringify(bad)} прошло как годное`).toBe("anonymous");
    }
  });

  test("двоеточие запрещено — иначе гость подделал бы сам префикс", () => {
    expect(devhubGuestId("guest:aaaaaaaa")).toBe("anonymous");
    expect(devhubGuestId("user:12345678")).toBe("anonymous");
  });

  test("массив заголовков берётся первым значением, а не склеивается", () => {
    expect(devhubGuestId([GUEST_A, GUEST_B])).toBe(`guest:${GUEST_A}`);
  });

  test("вошедший пользователь главнее заголовка", () => {
    const req = { headers: { [DEVHUB_GUEST_HEADER]: GUEST_A } };
    expect(requesterId(req as never, "user-777")).toBe("user-777");
  });

  test("заголовком нельзя назваться вошедшим пользователем", () => {
    const req = { headers: { [DEVHUB_GUEST_HEADER]: "user-777" } };
    // Даже если формат совпал бы с настоящим `sub`, префикс уводит значение
    // в другое пространство имён.
    expect(requesterId(req as never, null)).not.toBe("user-777");
  });
});

describe("проекты гостей разделены", () => {
  test("гость Б не видит проект гостя А в своём списке", async () => {
    const app = makeApp();
    await createProject(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "проект гостя А");

    const mine = await request(app).get("/api/devhub/projects").set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    expect(mine.body.projects.map((p: { name: string }) => p.name)).toContain("проект гостя А");

    const theirs = await request(app).get("/api/devhub/projects").set({ [DEVHUB_GUEST_HEADER]: GUEST_B });
    expect(theirs.body.projects.map((p: { name: string }) => p.name),
      "чужой черновик виден постороннему посетителю").not.toContain("проект гостя А");
  });

  test("гость Б не может удалить проект гостя А", async () => {
    const app = makeApp();
    const id = await createProject(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "удалять нельзя");

    const attempt = await request(app).delete(`/api/devhub/projects/${id}`).set({ [DEVHUB_GUEST_HEADER]: GUEST_B });
    expect(attempt.status, "посторонний удалил чужой проект вместе с его базой").toBe(404);

    const still = await request(app).get("/api/devhub/projects").set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    expect(still.body.projects.map((p: { id: string }) => p.id)).toContain(id);
  });

  test("свой проект гость удалить может — починка не заперла хозяина", async () => {
    const app = makeApp();
    const id = await createProject(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "свой проект");
    const own = await request(app).delete(`/api/devhub/projects/${id}`).set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    expect(own.status).toBe(200);
  });

  test("гость не добирается до проекта вошедшего пользователя, назвавшись его идентификатором", async () => {
    const app = makeApp();
    const sub = "user-abcdef123456";
    const id = await createProject(app, { Authorization: `Bearer ${tokenFor(sub)}` }, "проект хозяина аккаунта");

    const peek = await request(app).get(`/api/devhub/projects/${id}`).set({ [DEVHUB_GUEST_HEADER]: sub });
    expect(peek.status, "заголовком удалось выдать себя за вошедшего пользователя").toBe(404);

    const kill = await request(app).delete(`/api/devhub/projects/${id}`).set({ [DEVHUB_GUEST_HEADER]: sub });
    expect(kill.status).toBe(404);
  });

  test("без заголовка поведение прежнее — общий ящик anonymous", async () => {
    const app = makeApp();
    await createProject(app, {}, "старый клиент");
    const r = await request(app).get("/api/devhub/projects");
    expect(r.body.projects.map((p: { name: string }) => p.name)).toContain("старый клиент");
  });
});

describe("публичная полка сниппетов", () => {
  async function share(app: express.Express, headers: Record<string, string>, title: string) {
    const r = await request(app).post("/api/devhub/snippets").set(headers)
      .send({ title, content: "console.log(1);", language: "javascript", tags: ["proba"] });
    expect(r.status, `не удалось опубликовать «${title}»: ${r.text}`).toBe(201);
    return r.body.snippet.id as string;
  }

  test("личность автора не уезжает на публичную полку", async () => {
    const app = makeApp();
    await share(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "сниппет гостя А");

    const list = await request(app).get("/api/devhub/snippets").set({ [DEVHUB_GUEST_HEADER]: GUEST_B });
    // Контроль: сниппет в списке ЕСТЬ — иначе проверка на утечку прошла бы
    // просто потому, что список пустой.
    expect(list.body.snippets.map((s: { title: string }) => s.title)).toContain("сниппет гостя А");
    expect(list.text, "идентификатор гостя опубликован — по нему можно назваться им")
      .not.toContain(GUEST_A);
    expect(list.body.snippets[0]).not.toHaveProperty("userId");
  });

  test("свой сниппет помечен mine, чужой — нет", async () => {
    const app = makeApp();
    await share(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "мой");
    const asA = await request(app).get("/api/devhub/snippets").set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    const asB = await request(app).get("/api/devhub/snippets").set({ [DEVHUB_GUEST_HEADER]: GUEST_B });
    expect(asA.body.snippets[0].mine).toBe(true);
    expect(asB.body.snippets[0].mine).toBe(false);
  });

  test("автор может снять свой сниппет с полки", async () => {
    const app = makeApp();
    const id = await share(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "снимаемый");
    const del = await request(app).delete(`/api/devhub/snippets/${id}`).set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    expect(del.status, "опубликованное нельзя было убрать никак — ручки удаления не существовало").toBe(200);

    const list = await request(app).get("/api/devhub/snippets").set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    expect(list.body.snippets.map((s: { id: string }) => s.id)).not.toContain(id);
  });

  test("посторонний снять чужой сниппет не может", async () => {
    const app = makeApp();
    const id = await share(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "чужой");
    const del = await request(app).delete(`/api/devhub/snippets/${id}`).set({ [DEVHUB_GUEST_HEADER]: GUEST_B });
    expect(del.status).toBe(404);
    const list = await request(app).get("/api/devhub/snippets").set({ [DEVHUB_GUEST_HEADER]: GUEST_A });
    expect(list.body.snippets.map((s: { id: string }) => s.id), "посторонний удалил чужое").toContain(id);
  });

  test("одиночный сниппет тоже отдаётся без личности", async () => {
    const app = makeApp();
    const id = await share(app, { [DEVHUB_GUEST_HEADER]: GUEST_A }, "одиночный");
    const one = await request(app).get(`/api/devhub/snippets/${id}`).set({ [DEVHUB_GUEST_HEADER]: GUEST_B });
    expect(one.status).toBe(200);
    expect(one.body.snippet.title).toBe("одиночный");
    expect(one.text).not.toContain(GUEST_A);
  });
});
