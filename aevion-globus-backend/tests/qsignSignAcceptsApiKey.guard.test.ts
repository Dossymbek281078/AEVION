/**
 * Подпись можно поставить ПЛАТФОРМЕННЫМ КЛЮЧОМ, и только ею.
 *
 * ПОВОД (05.10.2026). Пилот с покупателем данных обещает подписать поставку из
 * нескольких файлов. Замер показал, что сделать это было НЕЧЕМ: `/sign` шёл
 * через `requireAuth`, то есть требовал JWT живого человека, а ключей у
 * роутера qsign не было вовсе — поиск `apiKey` по файлу давал 0 совпадений при
 * существующем `routes/apiKeys.ts`. Контроль, снявший сомнение: наш же боевой
 * смоук `scripts/qsign-prod-smoke.js` пунктом 6 проверяет «POST /sign (no auth)
 * → 401». Ни один скрипт платформы никогда не подписывал через API.
 *
 * ЧТО ЗДЕСЬ ЗАКРЕПЛЯЕТСЯ, и почему каждый пункт нужен:
 *   1. без ключа и без токена — по-прежнему 401 (дверь не открылась для всех);
 *   2. с годным ключом — 200 И подпись Ed25519 РЕАЛЬНО проверяется открытым
 *      ключом над `payloadCanonical`: ровно так её будет проверять покупатель
 *      скриптом verify-aevion.mjs. Проверять «пришло 200» мало — молчаливо
 *      испорченная подпись тоже даёт 200;
 *   3. подпись ложится на ВЛАДЕЛЬЦА ключа, а не на кого попало;
 *   4. ОТОЗВАННЫЙ ключ не пускает — это та половина, ради которой отзыв вообще
 *      существует;
 *   5. ключ не открывает соседние ручки: отзыв подписи остаётся на Bearer.
 *
 * Сторож делает НАСТОЯЩИЙ запрос к ручке и смотрит в ТЕЛО ответа (правило
 * 0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС): проверка, зовущая функцию со своим выдуманным
 * запросом, проверяет замысел, а не работу.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";

const СЕКРЕТ_JWT = "test-secret-qsign-api-key";
const СЫРОЙ_КЛЮЧ = "aev_test_" + "a".repeat(64);
const ХЕШ_КЛЮЧА = crypto.createHash("sha256").update(СЫРОЙ_КЛЮЧ).digest("hex");
const ВЛАДЕЛЕЦ = "user-owning-the-key";

/** Состояние, которым управляют отдельные случаи. */
let ключОтозван = false;
let ключИзвестен = true;

/* Один Ed25519 на весь файл: его открытой частью мы и проверяем ответ. */
const пара = crypto.generateKeyPairSync("ed25519");
const открытыйHex = пара.publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

const вставленныеСтроки: unknown[][] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      /* Поиск ключа — та же строка запроса, что в общем resolveApiKey. */
      if (sql.includes('"PlatformApiKey"') && sql.trim().startsWith("SELECT")) {
        /*
         * 🔴 ВАЖНО, и это поправка к первой версии файла. Сперва заглушка сама
         * решала, пускать ли отозванный ключ (`&& !ключОтозван`) — и мутация
         * «убрать из SQL условие revokedAt IS NULL» ПРОШЛА МИМО: сторож
         * проверял мою заглушку, а не код. Теперь отзыв применяется ровно
         * тогда, когда об этом просит САМ запрос, как это делает Postgres.
         * Уберут условие из кода — строка вернётся, подпись пройдёт, и этот
         * файл покраснеет.
         */
        const строка = {
          id: "key-1",
          userId: ВЛАДЕЛЕЦ,
          tier: "developer",
          env: "test",
          revokedAt: ключОтозван ? new Date() : null,
        };
        const хешСовпал = params?.[0] === ХЕШ_КЛЮЧА && ключИзвестен;
        const спрашиваютПроОтзыв = sql.includes('"revokedAt" IS NULL');
        const подходит = хешСовпал && (!спрашиваютПроОтзыв || строка.revokedAt === null);
        return подходит ? { rows: [строка], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('"PlatformApiKey"')) return { rows: [], rowCount: 0 }; // учёт обращений
      if (sql.trim().startsWith("INSERT")) {
        вставленныеСтроки.push(params ?? []);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  }),
}));

vi.mock("../src/lib/qsignV2/ensureTables", () => ({
  ensureQSignV2Tables: vi.fn(async () => {}),
}));

vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  getActiveHmac: async () => ({
    kid: "qsign-hmac-test",
    algo: "HMAC-SHA256",
    secret: Buffer.from("0".repeat(64), "hex"),
  }),
  getActiveEd25519: async () => ({
    kid: "qsign-ed25519-test",
    algo: "Ed25519",
    privateKey: пара.privateKey,
    publicKeyHex: открытыйHex,
  }),
  getKeyByKid: async () => null,
  resolveHmac: async () => ({
    kid: "qsign-hmac-test",
    algo: "HMAC-SHA256",
    secret: Buffer.from("0".repeat(64), "hex"),
  }),
  resolveEd25519: async () => ({
    kid: "qsign-ed25519-test",
    algo: "Ed25519",
    privateKey: пара.privateKey,
    publicKeyHex: открытыйHex,
  }),
  _clearCaches: () => {},
}));

const приложение = async () => {
  process.env.AUTH_JWT_SECRET = СЕКРЕТ_JWT;
  const { qsignV2Router } = await import("../src/routes/qsignV2");
  const a = express();
  a.use(express.json());
  a.use("/api/qsign/v2", qsignV2Router);
  return a;
};

const подписать = async (заголовки: Record<string, string> = {}) =>
  request(await приложение())
    .post("/api/qsign/v2/sign")
    .set(заголовки)
    .send({ payload: { delivery: "pilot", file: "a.txt" } });

beforeEach(() => {
  ключОтозван = false;
  ключИзвестен = true;
  вставленныеСтроки.length = 0;
  vi.resetModules();
});

describe("POST /sign принимает платформенный ключ", () => {
  it("КОНТРОЛЬ: без токена и без ключа — 401", async () => {
    const r = await подписать();
    expect(r.status).toBe(401);
  });

  it("КОНТРОЛЬ: выдуманный ключ — 401, а не молчаливый пропуск", async () => {
    ключИзвестен = false;
    const r = await подписать({ "x-api-key": "aev_test_" + "f".repeat(64) });
    expect(r.status).toBe(401);
  });

  it("годный ключ — 200, и подпись Ed25519 ПРОВЕРЯЕТСЯ открытым ключом", async () => {
    const r = await подписать({ "x-api-key": СЫРОЙ_КЛЮЧ });
    /*
     * 201, а не 200: ручка СОЗДАЁТ подпись. Я ждал 200 и ошибся — код был
     * прав, ожидание нет. Записано, чтобы следующий не «починил» ручку под
     * своё ожидание.
     */
    expect(r.status, JSON.stringify(r.body)).toBe(201);

    const canonical: string = r.body.payloadCanonical;
    expect(typeof canonical, "ответ не несёт payloadCanonical").toBe("string");

    /*
     * Главная строка файла. Покупатель проверит подпись ровно так: своим
     * crypto, над payloadCanonical, открытым ключом. Если бы мы сверяли только
     * «status 200», подошла бы и подпись из нулей.
     */
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(открытыйHex, "hex"),
    ]);
    const годна = crypto.verify(
      null,
      Buffer.from(canonical, "utf8"),
      crypto.createPublicKey({ key: spki, format: "der", type: "spki" }),
      Buffer.from(r.body.ed25519.signature, "hex"),
    );
    expect(годна, "подпись из ответа не проверяется открытым ключом").toBe(true);

    /* И хеш обязан соответствовать телу — иначе манифест развяжется с файлом. */
    expect(crypto.createHash("sha256").update(canonical, "utf8").digest("hex")).toBe(
      r.body.payloadHash,
    );
  });

  it("подпись ложится на ВЛАДЕЛЬЦА ключа, и это видно в ответе", async () => {
    const r = await подписать({ "x-api-key": СЫРОЙ_КЛЮЧ });
    /*
     * Спрашиваем ОТВЕТ, а не только параметры вставки: покупателю и нам важно
     * то, что ручка сказала наружу. Параметры вставки проверяем вторым
     * условием — если разойдутся, значит в базу легло одно, а наружу ушло
     * другое, и это хуже любого из двух.
     */
    expect(r.body?.issuer?.userId, "в ответе не владелец ключа").toBe(ВЛАДЕЛЕЦ);
    expect(
      вставленныеСтроки.some((п) => п.includes(ВЛАДЕЛЕЦ)),
      "в базу легла подпись с другим владельцем, чем в ответе",
    ).toBe(true);
  });

  it("ОТОЗВАННЫЙ ключ не пускает", async () => {
    ключОтозван = true;
    const r = await подписать({ "x-api-key": СЫРОЙ_КЛЮЧ });
    expect(r.status, "отозванный ключ всё ещё подписывает").toBe(401);
  });

  it("ключ НЕ открывает соседние ручки: отзыв подписи остаётся на Bearer", async () => {
    /*
     * Граница важнее удобства: ключ — это машина, а отзыв чужой подписи —
     * действие владельца аккаунта. Если ключ начнёт открывать и его, мы молча
     * расширим права там, где никто этого не просил.
     */
    const r = await request(await приложение())
      .post("/api/qsign/v2/revoke/00000000-0000-0000-0000-000000000000")
      .set({ "x-api-key": СЫРОЙ_КЛЮЧ })
      .send({});
    expect(r.status).toBe(401);
  });
});
