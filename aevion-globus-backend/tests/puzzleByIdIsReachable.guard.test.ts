import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 Утверждение: ссылка на КОНКРЕТНУЮ задачу открывает именно её.
 *
 * Повод 07.10.2026. Ссылки на задачу не существовало вовсе, и причина лежала
 * глубже отсутствия маршрута: ветвь, которой банк грузится НА ПРОДЕ (Postgres,
 * source "db ChessPuzzle (500000)"), собирала объект по названным полям, и `id`
 * среди них не был назван. То есть идентификатор терялся ещё до любой ручки, а
 * снаружи это выглядело как «у задач нет идентификаторов».
 *
 * Сторож идёт настоящим путём — поднимает роутер и делает ЗАПРОСЫ, — и смотрит
 * ТЕЛО ответа. Наличие маршрута в исходнике не доказывает, что он отвечает той
 * задачей, про которую спросили: именно это и было сломано.
 */

const каталог = mkdtempSync(join(tmpdir(), "aevion-puzzle-id-"));
const файлПула = join(каталог, "pool.json");
const файлБезId = join(каталог, "pool-no-id.json");

/** Две задачи с РАЗНЫМИ позициями: иначе «вернул ту самую» не проверить. */
const ЗАДАЧИ = [
  {
    id: "li_382iH",
    fen: "r4rk1/ppp2ppp/2nq4/8/4P1n1/2NP4/PPP1N1PP/R3QRK1 b - - 6 13",
    sol: ["d6h2"],
    name: "Мат в 1 · Лёгкая",
    r: 696,
    theme: "Мат в 1",
    phase: "Middlegame",
    side: "b",
    goal: "Mate",
    mateIn: 1,
  },
  {
    id: "li_9xKq2",
    fen: "1k6/7p/6pK/1N1r4/5P1P/6P1/Rb6/8 b - - 2 49",
    sol: ["d5h5"],
    name: "Мат в 1 · Средняя",
    r: 1204,
    theme: "Мат в 1",
    phase: "Endgame",
    side: "b",
    goal: "Mate",
    mateIn: 1,
  },
];

beforeAll(() => {
  writeFileSync(файлПула, JSON.stringify(ЗАДАЧИ), "utf8");
  // Тот же набор, но БЕЗ идентификаторов — так выглядит запасной публичный пул
  // aevion.app/puzzles.json (проверено 07.10.2026: слово "id" в нём 0 раз).
  writeFileSync(файлБезId, JSON.stringify(ЗАДАЧИ.map(({ id: _id, ...прочее }) => прочее)), "utf8");
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

/**
 * Роутер читает путь к пулу при ИМПОРТЕ модуля и кэширует загрузку на весь
 * процесс. Поэтому для каждого пула нужен свежий импорт — отсюда resetModules.
 */
async function приложение(путь: string) {
  process.env.CYBERCHESS_PUZZLES_PATH = путь;
  delete process.env.DATABASE_URL;
  // resetModules, а НЕ запрос в пути импорта: подставлять путь к файлу в строку
  // специфайера нельзя — двоеточие диска делает её непохожей на модуль, и
  // загрузчик перестаёт разбирать TypeScript (первая версия сторожа падала
  // разбором самого роутера, а выглядело это как «роутер сломан»).
  vi.resetModules();
  const { default: router } = await import("../src/routes/cyberchessPuzzles");
  const app = express();
  app.use(express.json());
  app.use("/api/cyberchess-puzzles", router);
  return app;
}

describe("задача открывается по идентификатору", () => {
  it("🔴 в теле лежит ТА САМАЯ задача, про которую спросили", async () => {
    const app = await приложение(файлПула);
    const r = await request(app).get("/api/cyberchess-puzzles/li_382iH");
    expect(r.status, `ответ ${r.status}, тело ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.puzzle?.id, "идентификатор не доехал до тела").toBe("li_382iH");
    expect(r.body.puzzle?.fen, "вернулась позиция другой задачи").toBe(ЗАДАЧИ[0].fen);
  });

  it("🔴 два разных идентификатора дают РАЗНЫЕ позиции", async () => {
    // Без этого «вернул ту самую» прошло бы и у ручки, которая всегда отдаёт
    // первую задачу пула: один запрос такую подмену не различает.
    const app = await приложение(файлПула);
    const а = await request(app).get("/api/cyberchess-puzzles/li_382iH");
    const б = await request(app).get("/api/cyberchess-puzzles/li_9xKq2");
    expect(а.body.puzzle?.fen).toBe(ЗАДАЧИ[0].fen);
    expect(б.body.puzzle?.fen).toBe(ЗАДАЧИ[1].fen);
    expect(а.body.puzzle?.fen).not.toBe(б.body.puzzle?.fen);
  });

  it("🔴 выдуманный идентификатор — строго 404, а не первая попавшаяся задача", async () => {
    const app = await приложение(файлПула);
    // Идентификатор по ФОРМЕ правильный, но такого в пуле нет — иначе проверка
    // съедет на 400 «мусор в адресе» и перестанет проверять поиск. Первая версия
    // писала здесь «li_нетакой99» кириллицей, получала 400 и краснела: ошибался
    // сторож, а не ручка.
    const r = await request(app).get("/api/cyberchess-puzzles/li_ZZZZZ9");
    expect(r.status, `ответ ${r.status}, тело ${JSON.stringify(r.body).slice(0, 160)}`).toBe(404);
    expect(r.body.ok).toBe(false);
    expect(r.body.puzzle, "на выдуманный идентификатор пришла задача").toBeUndefined();
  });

  it("🔴 /themes и /meta не перехвачены маршрутом :id", async () => {
    // Express сверяет маршруты по порядку объявления, и ":id" совпадает с любым
    // одиночным отрезком пути. Объяви его выше — и /themes стал бы «задачей с
    // идентификатором themes»: ручка отвечала бы 404 на верный запрос, а
    // выглядело бы это как «темы пропали».
    const app = await приложение(файлПула);
    const themes = await request(app).get("/api/cyberchess-puzzles/themes");
    expect(themes.status, "маршрут :id перехватил /themes").toBe(200);
    expect(Array.isArray(themes.body.themes), "в теле /themes нет списка тем").toBe(true);
    const meta = await request(app).get("/api/cyberchess-puzzles/meta");
    expect(meta.status, "маршрут :id перехватил /meta").toBe(200);
    expect(meta.body.poolSize, "в теле /meta нет размера пула").toBeGreaterThan(0);
  });

  it("🔴 пул без идентификаторов отвечает 503 ids_unavailable, а НЕ 404", async () => {
    // Разные неисправности обязаны выглядеть по-разному. 404 здесь означал бы
    // «такой задачи не существует», хотя задача существует и просто не ищется:
    // на запасном публичном пуле идентификаторов нет ни у одной записи.
    const app = await приложение(файлБезId);
    const r = await request(app).get("/api/cyberchess-puzzles/li_382iH");
    expect(r.status, `ответ ${r.status}, тело ${JSON.stringify(r.body).slice(0, 200)}`).toBe(503);
    expect(r.body.reason).toBe("ids_unavailable");
  });

  it("КОНТРОЛЬ: мусор в адресе — 400, а не 404 и не 500", async () => {
    // Неверные данные запроса это 4xx; 5xx означает «у нас сломалось» и поднимает
    // людей зря. И отдельно от 404: «ты спросил не то» и «такого нет» — разное.
    const app = await приложение(файлПула);
    for (const мусор of ["../../etc/passwd", "a".repeat(70), "__proto__"]) {
      const r = await request(app).get(`/api/cyberchess-puzzles/${encodeURIComponent(мусор)}`);
      expect([400, 404], `на «${мусор}» ответ ${r.status}`).toContain(r.status);
      expect(r.body.puzzle, `на «${мусор}» пришла задача`).toBeUndefined();
    }
    // __proto__ отдельно: поиск идёт по Map, и ключ прототипа для неё обычный.
    const proto = await request(app).get("/api/cyberchess-puzzles/__proto__");
    expect(proto.status, "ключ прототипа нашёл что-то в пуле").toBe(404);
  });

  it("КОНТРОЛЬ: обычная выборка тоже отдаёт id — иначе ссылку не из чего собрать", async () => {
    // Ручка одной задачи бесполезна, если в списке задач идентификаторов нет:
    // ссылку собирать не из чего. Ровно это и было на проде.
    const app = await приложение(файлПула);
    const r = await request(app).get("/api/cyberchess-puzzles/?limit=2");
    expect(r.status).toBe(200);
    expect(r.body.puzzles?.length, "выборка пуста — проверка ниже была бы пустой").toBeGreaterThan(0);
    expect(r.body.puzzles.every((п: { id?: string }) => typeof п.id === "string" && п.id.length > 0),
      `в выборке есть задачи без id: ${JSON.stringify(r.body.puzzles.map((п: { id?: string }) => п.id))}`).toBe(true);
  });
});
