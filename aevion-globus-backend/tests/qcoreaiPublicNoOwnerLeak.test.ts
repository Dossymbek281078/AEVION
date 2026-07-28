import { describe, test, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import {
  createSharedPreset,
  createEvalSuite,
  createPrompt,
  createTemplate,
  createPipeline,
  createPromptChain,
  setEvalSuitePublic,
} from "../src/services/qcoreai/store";

/**
 * Публичные каталоги QCoreAI не должны раскрывать автора.
 *
 * Шесть ручек — `/presets/public`, `/pipelines/public`, `/prompts/public`,
 * `/templates/public`, `/eval/suites/public`, `/prompt-chains/public` — открыты
 * без аутентификации и отдавали строки хранилища ЦЕЛИКОМ: `listPublic*` читают
 * их через `SELECT *`, а тип строки содержит `ownerUserId` (у цепочек промтов —
 * `userId`). То есть публичный каталог раскрывал внутренний идентификатор автора
 * каждого элемента.
 *
 * Найдено 28.07 сплошным аудитом публичных ручек. На проде эти списки пусты,
 * поэтому утечка была СКРЫТОЙ — включилась бы в тот момент, когда пользователь
 * впервые что-то опубликует. Именно поэтому проверка нужна поведенческая: она
 * ловит состояние, до которого прод ещё не дожил.
 *
 * Почему тест ходит по HTTP, а не проверяет функцию: два предыдущих дефекта того
 * же дня возникли ровно на границе «то, что вернула база» → «то, что ушло в
 * ответ». Проверять надо ответ, а не помощника, который его формирует.
 *
 * Отдельно проверяется, что фильтр не срезал содержимое: снятие лишнего легко
 * превратить в поломку, и тогда каталог перестанет показывать сами элементы.
 */

// hookTimeout, а НЕ только testTimeout: у vitest это разные лимиты, и
// `testTimeout` на хуки не распространяется. Замер 28.07 в полном параллельном
// прогоне: `beforeAll` этого файла (шесть посевов + импорт роутера qcoreai,
// тянущего провайдеров) упирался в дефолтные 10 с и ронял ФАЙЛ целиком —
// «Hook timed out in 10000ms», все семь тестов уходили в skip. В одиночку
// укладывается за доли секунды.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const OWNER = "usr-владелец-секретный-идентификатор";

/** Ручки и человекочитаемое имя того, что в них лежит. */
const ENDPOINTS = [
  { path: "/api/qcoreai/presets/public", what: "пресеты" },
  { path: "/api/qcoreai/pipelines/public", what: "конвейеры" },
  { path: "/api/qcoreai/prompts/public", what: "промты" },
  { path: "/api/qcoreai/templates/public", what: "шаблоны" },
  { path: "/api/qcoreai/eval/suites/public", what: "наборы проверок" },
  { path: "/api/qcoreai/prompt-chains/public", what: "цепочки промтов" },
] as const;

/** Поля, которых в публичном ответе быть не должно ни при каких условиях. */
const MUST_NOT_APPEAR = ["ownerUserId", "ownerEmail", "userId", "createdBy"];

let app: express.Express;

beforeAll(async () => {
  // Сеем по одному ПУБЛИЧНОМУ элементу каждого вида от одного владельца.
  // Хранилище без Postgres работает в памяти — сеть и БД не нужны.
  await createSharedPreset({ ownerUserId: OWNER, name: "утечка-пресет", isPublic: true });
  await createPipeline({
    ownerUserId: OWNER,
    name: "утечка-конвейер",
    steps: [{ id: "s1", provider: "stub", prompt: "привет" } as never],
    isPublic: true,
  });
  await createPrompt({ ownerUserId: OWNER, name: "утечка-промт", content: "текст", isPublic: true });
  await createTemplate({ ownerUserId: OWNER, name: "утечка-шаблон", input: "вход", isPublic: true });
  // У наборов проверок публикация — ОТДЕЛЬНЫЙ вызов: `createEvalSuite` поля
  // `isPublic` не принимает. Сначала я передал его прямо в создание и заглушил
  // несовпадение приведением `as never` — тест поймал это пустым каталогом.
  // Приведение ровно там, где нужна проверка типов, снова оказалось выключателем.
  const suite = await createEvalSuite({ ownerUserId: OWNER, name: "утечка-набор" });
  await setEvalSuitePublic(suite.id, OWNER, true);
  await createPromptChain({ userId: OWNER, name: "утечка-цепочка", isPublic: true });

  const { qcoreaiRouter } = await import("../src/routes/qcoreai");
  app = express();
  app.use(express.json());
  app.use("/api/qcoreai", qcoreaiRouter);
});

describe("публичные каталоги QCoreAI не раскрывают автора", () => {
  test.each(ENDPOINTS)("$path не отдаёт внутренние поля", async ({ path }) => {
    const res = await request(app).get(`${path}?limit=50`);
    expect(res.status).toBe(200);

    const raw = JSON.stringify(res.body);
    // Проверяем и по сырому тексту: поле могло уехать вложенным в overrides или
    // steps, и обход только верхнего уровня этого не увидит.
    expect(raw, "внутренний идентификатор владельца попал в публичный ответ").not.toContain(OWNER);
    for (const field of MUST_NOT_APPEAR) {
      expect(raw, `поле ${field} не должно уходить наружу`).not.toContain(`"${field}"`);
    }
  });

  test("фильтр не срезал содержимое — каталоги по-прежнему показывают элементы", async () => {
    // Без этой проверки «утечек нет» достигалось бы пустым ответом, и защита
    // была бы неотличима от поломки каталога.
    const seen: string[] = [];
    for (const { path, what } of ENDPOINTS) {
      const res = await request(app).get(`${path}?limit=50`);
      const items = (res.body?.items ?? []) as Array<Record<string, unknown>>;
      const mine = items.filter((i) => typeof i.name === "string" && i.name.startsWith("утечка-"));
      expect(items.length, `${what}: каталог пуст, фильтр срезал всё`).toBeGreaterThan(0);
      expect(mine.length, `${what}: посеянный элемент не виден`).toBeGreaterThan(0);
      // Имя и идентификатор остались — снято только лишнее.
      expect(mine[0]).toHaveProperty("name");
      expect(mine[0]).toHaveProperty("id");
      seen.push(what);
    }
    expect(seen).toHaveLength(ENDPOINTS.length);
  });
});
