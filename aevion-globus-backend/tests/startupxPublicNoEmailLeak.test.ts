import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Биржа идей не отдаёт почту основателя по публичным ручкам.
 *
 * Почему проверка нужна, хотя код признан образцовым. Аудит 28.07 назвал
 * `publicView()` в `startupExchange.ts` эталоном белого списка — и это правда.
 * Но вывод «чисто» был сделан ЧТЕНИЕМ, а за тот же день чтение дважды оказалось
 * слабее мутации: тест на вспомогательной функции проходил полностью, когда её
 * просто перестали вызывать.
 *
 * Здесь риск выше обычного:
 * - `founder_email` — настоящие персональные данные живых людей, а не внутренний
 *   идентификатор;
 * - оба запроса берут строку ЦЕЛИКОМ (`SELECT * FROM startup_ideas`), то есть
 *   почта доезжает до обработчика всегда, и единственное, что её задерживает, —
 *   вызов `publicView()`. Замените `publicView(r)` на `r`, и утечка готова;
 * - под соседний сторож `selectStarOnSensitiveTables` эта звёздочка НЕ попадает
 *   намеренно: колонки с почтой в него не включены, потому что почту законно
 *   выбирают, чтобы письмо отправить, и правило дало бы ложные срабатывания.
 *
 * То есть до этого теста единственной защитой персональных данных был один вызов
 * функции, ничем не подкреплённый.
 */

const EMAIL = "osnovatel@example.test";
// Идентификатор ЧИСЛОВОЙ: маршрут делает Number(req.params.id) и отвергает
// всё прочее как invalid_id. Первая версия теста ловила 400 вместо утечки —
// проверка формы запроса важна не меньше проверки ответа.
const IDEA_ID = "17";

const ideaRow = {
  id: Number(IDEA_ID),
  title: "Идея для проверки",
  description: "Описание идеи",
  stage: "mvp",
  founder_email: EMAIL,
  contact_method: "телеграм @openly", // это поле публично ПО ЗАМЫСЛУ
  qright_object_id: null,
  content_hash: null,
  visibility: "public",
  created_at: "2026-07-28T00:00:00.000Z",
  ai_score: null,
  ai_scored_at: null,
};

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line import/first
import { startupExchangeRouter } from "../src/routes/startupExchange";

/** Отвечаем по СОДЕРЖАНИЮ запроса, а не по порядку вызовов. */
function respondTo(sql: unknown) {
  const q = String(sql);
  if (/COUNT\(\*\)/i.test(q)) return { rows: [{ n: 0 }], rowCount: 1 };
  if (/FROM\s+startup_ideas/i.test(q)) return { rows: [ideaRow], rowCount: 1 };
  return { rows: [], rowCount: 0 };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/startupx", startupExchangeRouter);
  return app;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => respondTo(sql));
});

describe("публичные ручки биржи идей не раскрывают почту основателя", () => {
  it("список идей отдаёт саму идею, но НЕ почту", async () => {
    const res = await request(makeApp()).get("/api/startupx/ideas");
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    // Полезная часть на месте — иначе проверка ниже была бы про пустоту.
    expect(raw).toContain("Идея для проверки");
    expect(raw, "почта основателя утекла в публичный список").not.toContain(EMAIL);
    expect(raw).not.toContain("founder_email");
  });

  it("одна идея по ссылке — тоже без почты", async () => {
    const res = await request(makeApp()).get(`/api/startupx/ideas/${IDEA_ID}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).toContain("Идея для проверки");
    expect(raw, "почта основателя утекла в публичной карточке идеи").not.toContain(EMAIL);
    expect(raw).not.toContain("founder_email");
  });

  it("способ связи отдаётся — он публичен по замыслу", async () => {
    // Обратная сторона: срезать всё — тоже дефект. Биржа существует для того,
    // чтобы с основателем можно было связаться ТЕМ способом, который он указал
    // сам; почта из отдельного поля к этому не относится.
    const res = await request(makeApp()).get(`/api/startupx/ideas/${IDEA_ID}`);
    expect(JSON.stringify(res.body)).toContain("телеграм @openly");
  });

  it("состав полей идеи — ровно белый список", async () => {
    const res = await request(makeApp()).get(`/api/startupx/ideas/${IDEA_ID}`);
    expect(res.status).toBe(200);
    const idea = res.body.data as Record<string, unknown>;
    // Ни одного поля сверх перечисленных в publicView (+ interest_count).
    const allowed = [
      "id", "title", "description", "stage", "contact_method",
      "qright_object_id", "content_hash", "qright_protected",
      "visibility", "created_at", "ai_score", "ai_scored_at", "interest_count",
    ];
    for (const key of Object.keys(idea)) {
      expect(allowed, `лишнее поле «${key}» в публичном ответе`).toContain(key);
    }
  });

  it("почта не проходит и в поиске по свободному запросу", async () => {
    // Фильтры идут в SQL; проверяем, что ответ всё равно санитизирован.
    const res = await request(makeApp()).get("/api/startupx/ideas?q=идея&stage=mvp");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(EMAIL);
  });
});
