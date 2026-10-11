/**
 * Сторож: подпись v1 отделена доменом, и её нельзя предъявить как подпись
 * сертификата QRight.
 *
 * Повод (замер 11.10.2026, только чтение): POST /api/qsign/sign отвечает
 * анониму 200 и на api.aevion.app, и через прокси сайта (им пользуются кнопки
 * signAndDownload и publishToPlanet на публичной /constitution). Подписывал он
 * ровно JSON.stringify(тело) тем же ключом, которым routes/pipeline.ts:84-95
 * подписывает сертификат по четырём полям objectId/title/contentHash/signedAt
 * (HMAC_KEY_VERSION не задан → 1, QSIGN_SECRET_V1 не задан → откат на legacy
 * QSIGN_SECRET, config/qright.ts:60-69). Закрытие входом сломало бы публичные
 * кнопки, поэтому оркестратор выбрал разделение домена.
 *
 * Ожидание записано ЛИТЕРАЛАМИ («qsign-v1:» и секрет прямо здесь), а не взято
 * из охраняемого модуля: сторож, выводящий ожидание из охраняемой константы,
 * проходит любую её подмену.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import express from "express";
import request from "supertest";

const СЕКРЕТ = "test-qsign-secret-32-chars-minimum-pad";
let былоСекрет: string | undefined;
let былоСреда: string | undefined;

/**
 * Свежий модуль на каждый тест: ограничитель подписи (60/мин) живёт в модуле,
 * и без сброса счёт перетекает между тестами — тест с сотней тел съедал предел,
 * а падал СЛЕДУЮЩИЙ тест, на 429 вместо подписи.
 */
async function приложение() {
  vi.resetModules();
  const { qsignRouter } = await import("../src/routes/qsign");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/qsign", qsignRouter);
  return app;
}

/** То, что подписывает ЛЮБОЙ другой подписывающий у нас: голый JSON.stringify. */
function голаяПодпись(о: unknown): string {
  return crypto.createHmac("sha256", СЕКРЕТ).update(JSON.stringify(о)).digest("hex");
}

/** То, что должен подписывать v1: та же строка с литеральным префиксом домена. */
function подписьДоменаV1(о: unknown): string {
  return crypto.createHmac("sha256", СЕКРЕТ).update("qsign-v1:" + JSON.stringify(о)).digest("hex");
}

/** Форма сертификата QRight: ровно те четыре поля и в том же порядке. */
const СЕРТИФИКАТ = {
  objectId: "qr_probe_1",
  title: "проба сторожа",
  contentHash: "a".repeat(64),
  signedAt: "2026-10-11T15:40:00.000Z",
};

beforeEach(() => {
  былоСекрет = process.env.QSIGN_SECRET;
  былоСреда = process.env.NODE_ENV;
  process.env.QSIGN_SECRET = СЕКРЕТ;
  process.env.NODE_ENV = "test";
});
afterEach(() => {
  if (былоСекрет === undefined) delete process.env.QSIGN_SECRET;
  else process.env.QSIGN_SECRET = былоСекрет;
  if (былоСреда === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = былоСреда;
});

describe("v1 /sign — разделение домена", () => {
  test("подпись формы сертификата НЕ равна голой подписи того же объекта", async () => {
    const r = await request(await приложение()).post("/api/qsign/sign").send(СЕРТИФИКАТ);
    expect(r.status).toBe(200);
    expect(typeof r.body.signature).toBe("string");
    expect(r.body.signature).not.toBe(голаяПодпись(СЕРТИФИКАТ));
  });

  test("подпись равна подписи строки с префиксом домена", async () => {
    const r = await request(await приложение()).post("/api/qsign/sign").send(СЕРТИФИКАТ);
    expect(r.body.signature).toBe(подписьДоменаV1(СЕРТИФИКАТ));
  });

  test("контроль прибора: голая и доменная подписи вообще различаются", () => {
    expect(голаяПодпись(СЕРТИФИКАТ)).not.toBe(подписьДоменаV1(СЕРТИФИКАТ));
    expect(голаяПодпись(СЕРТИФИКАТ)).toHaveLength(64);
  });

  test("домен отделяет и произвольное тело, не только форму сертификата", async () => {
    for (const тело of [{ x: 1 }, { module: "aevion.constitution", version: 1 }, { a: [1, 2], b: null }]) {
      const r = await request(await приложение()).post("/api/qsign/sign").send(тело);
      expect(r.status).toBe(200);
      expect(r.body.signature).not.toBe(голаяПодпись(тело));
      expect(r.body.signature).toBe(подписьДоменаV1(тело));
    }
  });
});

describe("v1 — публичный поток цел", () => {
  test("своя пара sign + verify согласована (кнопки /constitution работают)", async () => {
    const app = await приложение();
    const тело = { module: "aevion.constitution", version: 1, title: "проба" };
    const s = await request(app).post("/api/qsign/sign").send(тело);
    expect(s.status).toBe(200);
    const v = await request(app)
      .post("/api/qsign/verify")
      .send({ payload: s.body.payload, signature: s.body.signature });
    expect(v.status).toBe(200);
    expect(v.body.valid).toBe(true);
  });

  test("verify отличает подделку", async () => {
    const r = await request(await приложение())
      .post("/api/qsign/verify")
      .send({ payload: СЕРТИФИКАТ, signature: "b" + "a".repeat(63) });
    expect(r.body.valid).toBe(false);
  });

  test("старый чек посетителя (подпись без домена) всё ещё проходит verify", async () => {
    // frontend/src/app/bank/_lib/signatures.ts держит пары (payload, signature)
    // в localStorage, чтобы человек мог перепроверить их когда угодно, а
    // /bank/settings обещает это словами. Строгая проверка показала бы ему его
    // собственные чеки как подделанные.
    const r = await request(await приложение())
      .post("/api/qsign/verify")
      .send({ payload: СЕРТИФИКАТ, signature: голаяПодпись(СЕРТИФИКАТ) });
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(true);
  });

  test("но ВЫДАТЬ подпись без домена нельзя — дыра была именно в выдаче", async () => {
    // Сто разных тел: ни на одном /sign не возвращает голую подпись.
    for (let i = 0; i < 100; i++) {
      const тело = { i, objectId: "qr_" + i, contentHash: String(i).repeat(3) };
      const r = await request(await приложение()).post("/api/qsign/sign").send(тело);
      expect(r.body.signature).not.toBe(голаяПодпись(тело));
    }
  }, 20_000);

  test("форма ответа не изменилась — обещания /bank/api и /developers в силе", async () => {
    const r = await request(await приложение()).post("/api/qsign/sign").send({ x: 1 });
    expect(Object.keys(r.body).sort()).toEqual(["algo", "createdAt", "payload", "signature"]);
    expect(r.body.algo).toBe("HMAC-SHA256");
    expect(r.body.payload).toEqual({ x: 1 });
  });
});
