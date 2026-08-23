import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сбой записи проекта в базу обязан быть ВИДЕН.
 *
 * Устройство модуля: все чтения идут из `memProjects`, база — write-through
 * копия. Значит во время работы процесса пользователь ничего не теряет, и
 * «выстрелил и забыл» здесь оправдано. Но база — единственное, что переживает
 * перезапуск, а выкатки в общий сервис идут по нескольку раз в день. Раньше
 * запись падала с `.catch(() => {})`: ни строки в журнале, и проекты
 * исчезали при первой же выкатке — узнали бы мы об этом от пользователя.
 *
 * Тот же класс чинили 12.08.2026 в `devhub.ts` (55bda8024). Там понадобилась
 * подкладка из памяти при чтении, потому что чтения шли в базу; здесь нужна
 * ровно видимость.
 */

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

/** Ждём, пока отложенные промисы отработают: запись «выстрелил и забыл». */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("Молчащих отказов записи в qreal не осталось", () => {
  test("в исходнике нет ни одного `.catch(() => {})`", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/routes/qreal.ts", import.meta.url), "utf8");
    // Проверка по КОДУ, а не по всему тексту: собственный комментарий,
    // описывающий прежнее поведение, попал бы под шаблон (наступал на это
    // сегодня дважды).
    const code = src
      .split("\n")
      .filter((l) => { const t = l.trim(); return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); })
      .join("\n");
    expect(code).not.toContain(".catch(() => {})");
  });

  test("упавшая запись проекта попадает в журнал и называет проект", async () => {
    query.mockRejectedValue(new Error("connection refused"));
    const { qrealRouter } = await import("../src/routes/qreal");
    const app = express();
    app.use(express.json());
    app.use(qrealRouter);

    const r = await request(app)
      .post("/projects")
      .send({ title: "Ролик", brief: "О платформе", format: "reel", language: "ru" });

    // Ручка обязана ответить успехом: проект лежит в памяти, и отказ базы
    // не должен ломать работу — предмет проверки именно ВИДИМОСТЬ.
    expect(r.status).toBeLessThan(400);
    await settle();

    const said = warn.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(said).toContain("[qreal]");
    expect(said).toContain("connection refused");
    expect(said).toContain("не переживёт перезапуск");
  });
});
