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
