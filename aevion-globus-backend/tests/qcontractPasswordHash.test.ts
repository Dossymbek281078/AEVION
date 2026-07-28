import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Пароль на документ хранился голым SHA-256 без соли. Два следствия:
 * одинаковые пароли давали одинаковый хеш (радужные таблицы), а перебор по
 * утёкшей базе упирался только в скорость железа — SHA-256 считается
 * миллиардами в секунду.
 *
 * Теперь scrypt с солью. Старый формат обязан продолжать открываться — иначе
 * правка «безопасности» ломает уже созданные документы, — и молча
 * переписываться на новый при первом верном вводе.
 */

function signJwt(payload: Record<string, unknown>, secret = "dev-auth-secret"): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qcontractRouter } from "../src/routes/qcontract";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qcontract", qcontractRouter);
  return app;
}

const AUTH = `Bearer ${signJwt({ sub: "u1", email: "u1@test.aev", role: "USER" })}`;
const TOKEN = "tok_test_document";

/**
 * Документ, который вернёт SELECT в обработчике просмотра.
 *
 * Идентификатор задаётся снаружи, и это не украшение: перенос старого хеша на
 * scrypt идёт ВДОГОНКУ ответу, поэтому его запрос к базе может прийти уже после
 * того, как следующий тест сбросил счётчик вызовов. При общем id такой поздний
 * вызов засчитывался бы следующему тесту — и тест «неверный пароль не
 * переписывает» падал через раз. Поймано на общем прогоне: в одиночку файл был
 * зелёным.
 */
function docRow(passwordHash: string, id = "doc-1") {
  return {
    id,
    title: "Договор",
    content: "Текст",
    content_type: "text",
    password_hash: passwordHash,
    max_views: null,
    view_count: 0,
    expires_at: null,
    revoked_at: null,
    require_signature: false,
    qright_id: null,
  };
}

/** Ответы пула: SELECT документа, затем атомарное списание, затем аудит. */
function wirePool(row: ReturnType<typeof docRow>) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    const q = String(sql);
    if (q.includes("SELECT") && q.includes("password_hash")) return { rows: [row], rowCount: 1 };
    if (q.startsWith("UPDATE qcontract_documents")) return { rows: [{ view_count: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
}

function open(password?: string) {
  return request(makeApp())
    .post(`/api/qcontract/view/${TOKEN}`)
    .send(password === undefined ? {} : { password });
}

/**
 * Ждём условие опросом, а не фиксированной паузой.
 *
 * Перенос хеша идёт вдогонку ответу и включает scrypt — намеренно медленную
 * функцию. Пауза в 150 мс проходила в одиночном прогоне и НЕ проходила под
 * нагрузкой общего: тест падал примерно раз на шесть прогонов с «перенос не
 * выполнен». Фиксированная пауза в тесте асинхронной работы — это не проверка,
 * а ставка на скорость машины.
 */
async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return cond();
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("QContract: пароль документа", () => {
  beforeEach(() => mockQuery.mockReset());

  test("новый документ получает солёный хеш, а не SHA-256", async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const res = await request(makeApp())
      .post("/api/qcontract/documents")
      .set("Authorization", AUTH)
      .send({ title: "Договор", content: "Текст", contentType: "text", password: "secret" });

    expect(res.status).toBe(201);
    const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
    const stored = String(insert?.[1]?.[6]);
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toBe(sha256("secret"));
  });

  test("два документа с ОДНИМ паролем дают разные хеши", async () => {
    const hashes: string[] = [];
    for (let i = 0; i < 2; i++) {
      mockQuery.mockReset();
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
      await request(makeApp())
        .post("/api/qcontract/documents")
        .set("Authorization", AUTH)
        .send({ title: "T", content: "C", contentType: "text", password: "one-and-the-same" });
      const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
      hashes.push(String(insert?.[1]?.[6]));
    }
    expect(hashes[0]).not.toBe(hashes[1]); // соль работает
  });

  test("верный пароль открывает документ", async () => {
    // хеш берём тем же путём, что и продукт: создаём документ и читаем вставку
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await request(makeApp())
      .post("/api/qcontract/documents")
      .set("Authorization", AUTH)
      .send({ title: "T", content: "C", contentType: "text", password: "letmein" });
    const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
    const fresh = String(insert?.[1]?.[6]);

    wirePool(docRow(fresh));
    expect((await open("letmein")).status).toBe(200);
  });

  test("неверный пароль не открывает", async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    await request(makeApp())
      .post("/api/qcontract/documents")
      .set("Authorization", AUTH)
      .send({ title: "T", content: "C", contentType: "text", password: "letmein" });
    const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO qcontract_documents"));
    const fresh = String(insert?.[1]?.[6]);

    wirePool(docRow(fresh));
    expect((await open("wrong")).status).toBe(403);
  });

  test("документ со СТАРЫМ хешем продолжает открываться", async () => {
    wirePool(docRow(sha256("old-secret"), "doc-legacy-open"));
    expect((await open("old-secret")).status).toBe(200);
  });

  test("старый хеш молча переписывается на новый при верном вводе", async () => {
    wirePool(docRow(sha256("old-secret"), "doc-legacy-upgrade"));
    await open("old-secret");

    const found = () =>
      mockQuery.mock.calls.some(
        (c) =>
          String(c[0]).includes("SET password_hash") &&
          String(c[1]?.[0]).startsWith("scrypt$") &&
          c[1]?.[1] === "doc-legacy-upgrade",
      );
    await waitFor(found);

    const upgrade = mockQuery.mock.calls.find(
      (c) =>
        String(c[0]).includes("SET password_hash") &&
        String(c[1]?.[0]).startsWith("scrypt$") &&
        c[1]?.[1] === "doc-legacy-upgrade",
    );
    expect(upgrade, "перенос на scrypt не выполнен").toBeTruthy();
  });

  test("неверный пароль к старому хешу не открывает и не переписывает", async () => {
    wirePool(docRow(sha256("old-secret"), "doc-legacy-wrong"));
    expect((await open("nope")).status).toBe(403);
    // Здесь ждём наоборот: переноса быть НЕ должно. Даём заведомо больше
    // времени, чем нужно положительному случаю, иначе проверка проходила бы
    // просто потому, что не дождалась.
    await new Promise((r) => setTimeout(r, 300));
    // Ищем перенос ИМЕННО этого документа: поздний вызов от соседнего теста
    // сюда попасть может, и раньше он ронял проверку через раз.
    const upgrade = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes("SET password_hash") && c[1]?.[1] === "doc-legacy-wrong",
    );
    expect(upgrade).toBeFalsy();
  });

  test("битый scrypt-хеш не открывает документ", async () => {
    wirePool(docRow("scrypt$оборванный"));
    expect((await open("anything")).status).toBe(403);
  });
});
