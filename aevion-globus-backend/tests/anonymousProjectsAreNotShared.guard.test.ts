import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Два посетителя БЕЗ метки — два разных владельца, а не один общий ящик.
 *
 * 🔴 НАЙДЕНО 06.10.2026 соседним окном на живом проде: проект, созданный
 * запросом без `x-devhub-guest` и без входа, принадлежал общей личности
 * "anonymous" — и такой же безметочный запрос его УДАЛИЛ (200, pagesRemoved),
 * вместе с опубликованным сайтом и базой проекта.
 *
 * Это тот же дефект, который чинили 21.08.2026 для вошедших и для гостей с
 * меткой: владение проверяется сравнением с userId, а у всех безметочных он был
 * один. Для них починка не доехала.
 *
 * И попадал туда не только curl. Фронт при НЕДОСТУПНОМ хранилище (приватный
 * режим, запрет данных сайта) заголовок не ставил вовсе: installDevhubGuestHeader
 * делал ранний выход при `getDevhubGuestId() === null`. То есть живой человек
 * оказывался в общем ящике с чужими черновиками, и любой посторонний мог удалить
 * его проект. Фронт починен отдельно (lib/devhubGuest.ts — личность в памяти
 * страницы); здесь закрыт вход со стороны сервера.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

/** Создать проект БЕЗ метки — так ходил curl и так ходил фронт без хранилища. */
async function создатьБезМетки(имя: string) {
  const r = await request(приложение()).post("/api/devhub/projects").send({ name: имя });
  return r;
}

beforeEach(() => { __resetDevHubStore?.(); });

describe("безметочные проекты не лежат в общем ящике", () => {
  test("прибор исправен: проект создаётся и без метки — обещание «без аккаунта» цело", async () => {
    const r = await создатьБезМетки("Без метки");
    expect(r.status, "создание без метки сломано — это уже другая поломка").toBe(201);
    expect(r.body.project?.id, "проект не создан").toBeTruthy();
  });

  test("ручка ВОЗВРАЩАЕТ выданную метку — иначе вызывающий теряет свой проект", async () => {
    const r = await создатьБезМетки("Своя метка");
    expect(r.body.guestId, "метка не названа в теле ответа").toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(r.headers["x-devhub-guest"], "метка не названа в заголовке").toBe(r.body.guestId);
    expect(String(r.body.guestIdNote ?? ""), "не сказано, что с меткой делать").toContain("x-devhub-guest");
  });

  test("🔴 ПОСТОРОННИЙ без метки НЕ удаляет чужой проект", async () => {
    const создан = await создатьБезМетки("Чужой проект");
    const id = создан.body.project.id;

    const удаление = await request(приложение()).delete("/api/devhub/projects/" + id);
    expect(удаление.status, "посторонний удалил чужой проект — дыра открыта").toBe(404);

    // И проект на месте: удаление не только отказало, но и ничего не сделало.
    const свой = await request(приложение())
      .get("/api/devhub/projects/" + id)
      .set("x-devhub-guest", создан.body.guestId);
    expect(свой.status, "владелец потерял свой проект").toBe(200);
  });

  test("ПОСТОРОННИЙ без метки не ВИДИТ чужой проект в списке", async () => {
    const создан = await создатьБезМетки("Чужой в списке");
    const чужой = await request(приложение()).get("/api/devhub/projects");
    const ids = ((чужой.body.projects ?? чужой.body ?? []) as Array<{ id?: string }>).map((p) => p?.id);
    expect(ids.includes(создан.body.project.id), "чужой проект виден посторонннему").toBe(false);
  });

  test("КОНТРОЛЬ: со СВОЕЙ меткой владелец и видит, и удаляет", async () => {
    // Без этого контроля «404 всем» выглядело бы починкой, а было бы поломкой:
    // проект, к которому не может обратиться даже его создатель, бесполезен.
    const создан = await создатьБезМетки("Свой проект");
    const id = создан.body.project.id;
    const метка = создан.body.guestId;

    const список = await request(приложение()).get("/api/devhub/projects").set("x-devhub-guest", метка);
    const ids = ((список.body.projects ?? список.body ?? []) as Array<{ id?: string }>).map((p) => p?.id);
    expect(ids.includes(id), "владелец не видит свой проект").toBe(true);

    const удаление = await request(приложение()).delete("/api/devhub/projects/" + id).set("x-devhub-guest", метка);
    expect(удаление.status, "владелец не может удалить свой проект").toBe(200);
  });

  test("две безметочные личности РАЗНЫЕ — не один ящик на всех", async () => {
    const a = await создатьБезМетки("Первый");
    const b = await создатьБезМетки("Второй");
    expect(a.body.guestId).not.toBe(b.body.guestId);
    // И метка одного не открывает проект другого.
    const чужое = await request(приложение())
      .get("/api/devhub/projects/" + a.body.project.id)
      .set("x-devhub-guest", b.body.guestId);
    expect(чужое.status, "метка одного открыла проект другого").toBe(404);
  });
});
