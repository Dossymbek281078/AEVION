import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter, нашТестовыйПрогон } from "../src/routes/devhub";

/**
 * Наши собственные тестовые прогоны не показываются человеку как его проекты.
 *
 * Замер прода 08.09.2026: гость с заблокированным хранилищем получает общую
 * личность `anonymous`, и список отдавал ему 17 наших июльских прогонов
 * («таймер помодоро» в семи вариантах, cf-pages-test, prod-smoke-test).
 * Человек открывает модуль впервые и видит два десятка чужих проектов как свои.
 *
 * Прячем ФИЛЬТРОМ, а не удалением: удаление данных на проде необратимо и
 * остаётся руке основателя. Приём взят у соседнего модуля — в QRight публичные
 * выдачи так же прячут смоук-записи.
 *
 * Сторож держит ГРАНИЦУ фильтра с обеих сторон: старые записи общей корзины
 * скрыты, а работа настоящего человека — и в общей корзине тоже — видна. Без
 * второй половины фильтр однажды спрячет чью-то работу, и никто не заметит.
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("тестовые прогоны спрятаны, чужая работа — нет", () => {
  test("свежий проект общей корзины ВИДЕН (граница не съедает настоящее)", async () => {
    const app = makeApp();
    // Без заголовка личности — это и есть общая корзина `anonymous`.
    const создан = await request(app).post("/api/devhub/projects")
      .send({ name: "проект человека без хранилища", stack: "static" });
    const pid = создан.body.project?.id;
    expect(pid, "проект не создан — сторож мерит не тот путь").toBeTruthy();

    const список = await request(app).get("/api/devhub/projects");
    const ids = (список.body.projects ?? []).map((p: { id: string }) => p.id);
    expect(
      ids.includes(pid),
      "фильтр съел работу настоящего человека — он создал проект и не видит его",
    ).toBe(true);

    await request(app).delete(`/api/devhub/projects/${pid}`);
  });

  test("граница описана датой и константой, а не списком идентификаторов", () => {
    // Список UUID пришлось бы править руками при каждом новом прогоне, и он
    // молча устарел бы. Дата самоочевидна: настоящая работа создаётся после неё.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
    expect(src).toContain("НАШИ_ПРОГОНЫ_ДО");
    expect(src, "фильтр перестал смотреть на общую личность").toContain('ОБЩАЯ_ЛИЧНОСТЬ = "anonymous"');
    expect(
      /НАШИ_ПРОГОНЫ_ДО = "2026-0[89]/.test(src),
      "граница уехала — проверьте, не прячет ли она теперь настоящую работу",
    ).toBe(true);
  });

  test("фильтр стоит в ОБЕИХ ветках списка — и в базе, и в памяти", () => {
    // Запасная память процесса — не исключение: при недоступной базе список
    // строится из неё, и пропуск там вернул бы прогоны на экран.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
    const тело = src.slice(src.indexOf("async function dbListProjects"), src.indexOf("async function dbGetProject"));
    const вхождений = (тело.match(/нашТестовыйПрогон/g) ?? []).length;
    expect(вхождений, `фильтр применён ${вхождений} раз(а) — ожидалось не меньше трёх`).toBeGreaterThanOrEqual(3);
  });
  test("предикат ПРЯЧЕТ старую запись общей корзины и только её", () => {
    // Проверка следствия, а не наличия вызовов: мутация «фильтр обезврежен»
    // проходила мимо первой редакции этого сторожа.
    expect(
      нашТестовыйПрогон({ userId: "anonymous", createdAt: "2026-07-26T10:00:00.000Z" }),
      "июльская запись общей корзины не спрятана — человек снова увидит наши прогоны",
    ).toBe(true);
    expect(
      нашТестовыйПрогон({ userId: "anonymous", createdAt: "2026-09-10T10:00:00.000Z" }),
      "спрятана работа человека, созданная ПОСЛЕ границы",
    ).toBe(false);
    expect(
      нашТестовыйПрогон({ userId: "guest:abcdefgh", createdAt: "2026-07-26T10:00:00.000Z" }),
      "спрятана старая работа ОБЫЧНОГО гостя — фильтр вышел за общую корзину",
    ).toBe(false);
  });
});
