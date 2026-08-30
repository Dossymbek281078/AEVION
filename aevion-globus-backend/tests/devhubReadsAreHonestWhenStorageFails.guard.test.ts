import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сбой хранилища не выдаётся за факт о данных человека.
 *
 * Приём взят из `qskywaySlotStoreHonesty.test.ts` и применён к DevHub впервые
 * 28.08.2026: роутер поднимается с базой, которая ПОДНЯЛАСЬ, а потом перестала
 * читаться. Это и есть опасный случай — модуль считает Postgres рабочим, и
 * запасная память не включается.
 *
 * Замер по всем 31 GET-ручке дал две находки:
 *
 *   GET /snippets        200 {"snippets":[],"total":0}   ← «полка пуста»
 *   GET /projects/:id    500 internal_error              ← «у нас сломалось»
 *
 * тогда как ВОСЕМНАДЦАТЬ соседних чтений в том же файле честно отвечали
 * 503 storage_unavailable («проект на месте, прочитать не удалось»).
 * Непоследовательность внутри одного файла — почти всегда недосмотр, а не
 * решение. После правки честных ответов двадцать, пятисоток ноль.
 *
 * Разница для человека большая: 500 читается как авария у нас, пустой список —
 * как потеря его работы, и только 503 говорит правду.
 */

vi.mock("../src/lib/dbPool", () => {
  const boom = () => { throw new Error("connection refused (тест)"); };
  return {
    getPool: () => ({
      query: async (sql?: string) => {
        const q = typeof sql === "string" ? sql.toUpperCase() : "";
        // Инициализация и проба живости проходят: `SELECT 1` в
        // ensureDevHubTables решает, считать ли Postgres рабочим. Без этого
        // модуль честно уходит в память — другой, разрешённый случай.
        if (q.trim() === "SELECT 1" || q.includes("CREATE ") || q.includes("ALTER ") || q.includes("INDEX")) {
          return { rows: [{ ok: 1 }], rowCount: 1 };
        }
        return boom();
      },
      connect: async () => ({ query: async () => boom(), release: () => {} }),
    }),
    getPoolStats: () => null,
  };
});

const ID = "00000000-0000-0000-0000-000000000000";

describe("чтения DevHub честны при упавшем хранилище", () => {
  let app: express.Express;
  beforeEach(async () => {
    vi.resetModules();
    const { devhubRouter } = await import("../src/routes/devhub");
    app = express().use(express.json()).use("/api/devhub", devhubRouter);
  });

  test("прибор работает: опасный случай достигнут, а не подменён запасной памятью", async () => {
    // Если бы проба живости падала, модуль ушёл бы в память и отвечал 200 —
    // это ДРУГОЙ, законный режим, и проверки ниже ничего бы не значили.
    const h = await request(app).get("/api/devhub/health");
    expect(h.body.db, "модуль ушёл в память — проверяется не тот случай").toBe("postgres");
  });

  test("список проектов отвечает отказом, а не пустотой", async () => {
    const r = await request(app).get("/api/devhub/projects");
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });

  test("список снипетов тоже — это была находка замера", async () => {
    const r = await request(app).get("/api/devhub/snippets");
    expect(r.status, "пустой список снова выдаётся за факт").toBe(503);
  });

  test("чтение одного проекта отвечает 503, а не 500", async () => {
    // 500 читается как «сломались мы» и поднимает тревогу как наша авария;
    // недоступность базы у нас описана отдельным кодом.
    const r = await request(app).get(`/api/devhub/projects/${ID}`);
    expect(r.status, "вернулась пятисотка").toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });

  test("девять отобранных руками чтений не отвечают 500", async () => {
    const paths = [
      "/api/devhub/projects",
      "/api/devhub/snippets",
      `/api/devhub/projects/${ID}`,
      `/api/devhub/projects/${ID}/files`,
      `/api/devhub/projects/${ID}/checkpoints`,
      `/api/devhub/projects/${ID}/collaborators`,
      `/api/devhub/projects/${ID}/database`,
      // Добавлено 29.08: чтение ОДНОГО файла. Имя теста обещало «ни одно
      // чтение», а список знал семь путей из большего числа — те два, что
      // читают файл, отвечали 500 и в список не входили.
      `/api/devhub/projects/${ID}/files/app.js`,
      `/api/devhub/projects/${ID}/file?path=app.js`,
    ];
    const bad: string[] = [];
    for (const p of paths) {
      const r = await request(app).get(p);
      if (r.status >= 500 && r.status !== 503) bad.push(`${p} → ${r.status}`);
    }
    expect(bad, "сбой хранилища выдан за нашу аварию").toEqual([]);
  }, 60_000);

  test("статические каталоги не трогают базу и отвечают как обычно", async () => {
    // Контроль в другую сторону: если бы 503 отдавали ВСЕ, проверки выше были
    // бы зелёными на модуле, который просто лёг целиком.
    for (const p of ["/api/devhub/templates", "/api/devhub/media/video/models"]) {
      const r = await request(app).get(p);
      expect(r.status, `${p} перестал отвечать`).toBe(200);
    }
  });
});

/**
 * Подключение своего домена — единственная ручка DevHub из 92, которую
 * не проверял НИКТО: ни тесты, ни ежедневный смоук (замер 29.08.2026,
 * с контролем в обе стороны). Она же стоит на возможности, обещание
 * которой пришлось снимать с кнопки: зона aevion.build не делегирована.
 *
 * Непроверенная ручка на спорной возможности — худшее сочетание из
 * возможных, поэтому здесь закреплено главное: при упавшем хранилище
 * она отвечает отказом, а не выдаёт отсутствие проекта за факт.
 */
describe("подключение домена не врёт при упавшем хранилище", () => {
  let app: express.Express;
  beforeEach(async () => {
    vi.resetModules();
    const { devhubRouter } = await import("../src/routes/devhub");
    app = express().use(express.json()).use("/api/devhub", devhubRouter);
  });

  test("прибор работает: опасный случай достигнут", async () => {
    const h = await request(app).get("/api/devhub/health");
    expect(h.body.db, "модуль ушёл в память — проверяется не тот путь").toBe("postgres");
  });

  test("отвечает 503, а не «проект не найден»", async () => {
    // 404 здесь был бы враньём с самыми дорогими последствиями:
    // человек решил бы, что потерял проект, и завёл новый.
    const r = await request(app)
      .post(`/api/devhub/projects/${ID}/domain/setup`)
      .send({ domain: "example.com" });
    expect(r.status, "недоступность базы выдана за отсутствие проекта").toBe(503);
    expect(r.body.error).toBe("storage_unavailable");
  });
});

/**
 * Список путей заменён ПЕРЕБОРОМ. Замер 29.08.2026.
 *
 * Проверка выше держит девять адресов, набранных руками, а имя обещает «ни
 * одно чтение». Утром я убедился, чем это кончается: два обработчика файлов
 * отвечали 500 и в список просто не входили. Список — это ставка на то, что
 * ты перечислил все случаи; в этом файле она уже проигрывала.
 *
 * Здесь адреса берутся из ИСХОДНИКА: все GET-ручки роутера, с подстановкой
 * идентификатора проекта. Ноль исключений — если ручка отвечает 500 при
 * недоступном хранилище, это находка, а не «её нет в списке».
 */
describe("ни одно чтение не отвечает 500 — перебором, а не списком", () => {
  let app2: express.Express;
  const ROUTER_SRC = readFileSync(
    join(__dirname, "..", "src", "routes", "devhub.ts"),
    "utf8",
  ).split(String.fromCharCode(10));

  function everyGetPath(): string[] {
    const out: string[] = [];
    for (const l of ROUTER_SRC) {
      if (!l.startsWith("devhubRouter.get(")) continue;
      const q = l.indexOf(String.fromCharCode(34));
      if (q < 0) continue;
      const raw = l.slice(q + 1, l.indexOf(String.fromCharCode(34), q + 1));
      // Подставляем значение ЛЮБОМУ параметру, а не только :id.
      //
      // Первая версия пропускала пути со вторым параметром — и мимо неё
      // прошло чтение файла (/files/:filepath), то самое, ради которого
      // список и переделывался в перебор. Мутация это показала: вернул
      // туда 500, перебор остался зелёным.
      //
      // В комментарии при этом было написано, что такие пути «считаются
      // отдельно». Не считались. Обещание в комментарии — не проверка.
      const filled = raw
        .split("/")
        .map((seg) => (seg.startsWith(":") ? (seg === ":id" ? ID : "probe.txt") : seg))
        .join("/");
      out.push(`/api/devhub` + filled);
    }
    return out;
  }

  beforeEach(async () => {
    vi.resetModules();
    const { devhubRouter } = await import("../src/routes/devhub");
    app2 = express().use(express.json()).use("/api/devhub", devhubRouter);
  });

  test("перебор всех GET-ручек роутера", async () => {
    const paths = everyGetPath();
    // Контроль прибора: разбор исходника обязан что-то найти, иначе цикл
    // ниже «проходит», не сделав ни одной проверки.
    expect(paths.length, "разбор исходника не нашёл GET-ручек").toBeGreaterThan(10);

    const bad: string[] = [];
    for (const p of paths) {
      const r = await request(app2).get(p);
      if (r.status === 500) bad.push(`${p} -> 500`);
    }
    expect(
      bad,
      "недоступность хранилища выдана за нашу поломку: отвечайте replyStorageUnavailable",
    ).toEqual([]);
  });
});
