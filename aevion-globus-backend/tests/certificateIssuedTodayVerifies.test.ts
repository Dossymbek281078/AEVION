// ВОРОТА ЗАПУСКА QRight (6.09): сертификат, выданный СЕГОДНЯ, обязан
// проходить проверку всеми слоями.
//
// Существующие тесты проверяют круг по кускам: отдельно правило хеша,
// отдельно вердикт по подготовленной строке. Ни один не проходит путь
// целиком — POST /protect настоящей ручкой, затем GET /verify настоящей
// ручкой по тому, что первая записала. А именно на этом стыке живут самые
// дорогие дефекты: строку кладёт один код, читает другой, и расхождение
// между ними ничем не ловится.
//
// Замер 27.08.2026, ради которого тест и написан: в публичном реестре все
// пять сертификатов не сходились по хешу, и разобраться, «сломан ли выпуск
// или испортились данные», было НЕЧЕМ. Оказалось — данные старые. Но узнать
// это стоило перебора десяти правил вручную.
//
// Фальшивая база здесь НЕ подставляет заранее готовую строку: она хранит
// ровно то, что записала ручка выдачи. Иначе тест проверял бы мою фикстуру,
// а не код (см. память feedback_test_writes_the_state_app_never_makes).

import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";
import zlib from "node:zlib";

/* ── Фальшивая база: хранит то, что положили, и отдаёт это же ─────────── */

type Row = Record<string, unknown>;

// Всё, к чему обращается фабрика vi.mock, обязано жить в vi.hoisted:
// pipeline.ts зовёт getPool() на уровне модуля, то есть ДО инициализации
// обычных const этого файла. Без hoisted — «Cannot access before initialization».
const h = vi.hoisted(() => {
  const store: Record<string, Row[]> = {};

/** Разбирает `INSERT INTO "T" ("a","b") VALUES ($1,'lit')` в строку таблицы. */
function applyInsert(sql: string, params: unknown[]): void {
  const m = sql.match(
    /INSERT INTO "([A-Za-z_]+)"\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/s,
  );
  if (!m) return;
  const [, table, colsRaw, valsRaw] = m;
  const cols = colsRaw
    .split(",")
    .map((c) => c.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);

  // Значения перечислены через запятую, но NOW() содержит собственные скобки.
  const vals: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of valsRaw) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      vals.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) vals.push(cur.trim());

  if (cols.length !== vals.length) {
    throw new Error(
      `фальшивая база не разобрала INSERT в "${table}": колонок ${cols.length}, значений ${vals.length}`,
    );
  }

  const row: Row = {};
  cols.forEach((col, i) => {
    const v = vals[i];
    if (/^\$\d+$/.test(v)) row[col] = params[Number(v.slice(1)) - 1];
    else if (/^'.*'$/s.test(v)) row[col] = v.slice(1, -1);
    else if (v === "true") row[col] = true;
    else if (v === "false") row[col] = false;
    else if (/^NOW\(\)$/i.test(v)) row[col] = new Date();
    else if (v === "NULL") row[col] = null;
    else row[col] = v;
  });

  (store[table] ??= []).push(row);
}

function runQuery(sql: unknown, params: unknown[] = []) {
  const q = String(sql);

  if (/^\s*INSERT INTO/i.test(q)) {
    applyInsert(q, params);
    return { rows: [] };
  }

  if (/SELECT \* FROM "IPCertificate"/.test(q)) {
    const id = params[0];
    return { rows: (store.IPCertificate ?? []).filter((r) => r.id === id) };
  }

  if (/FROM "QuantumShield"/.test(q)) {
    const id = params[0];
    return { rows: (store.QuantumShield ?? []).filter((r) => r.id === id) };
  }

  // CREATE TABLE, ALTER, BEGIN/COMMIT, журналы проверок и всё прочее.
  return { rows: [] };
}

  const fakePool = {
    query: async (sql: unknown, params?: unknown[]) =>
      runQuery(sql, params ?? []),
    connect: async () => ({
      query: async (sql: unknown, params?: unknown[]) =>
        runQuery(sql, params ?? []),
      release: () => {},
    }),
  };

  return { store, fakePool };
});

const store = h.store;

vi.mock("../src/lib/dbPool", () => ({ getPool: () => h.fakePool }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// Якорение в биткойн уходит в сеть уже ПОСЛЕ фиксации транзакции. К вердикту
// проверки оно отношения не имеет, а в тесте дало бы сетевой вызов.
vi.mock("../src/lib/opentimestamps/anchor", () => ({
  stampHash: vi.fn(async () => null),
  upgradeProof: vi.fn(async () => null),
  verifyProof: vi.fn(async () => null),
}));

process.env.QSIGN_SECRET =
  process.env.QSIGN_SECRET || "test-secret-for-issue-verify-roundtrip";
process.env.SHARD_HMAC_SECRET_V1 =
  process.env.SHARD_HMAC_SECRET_V1 || "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";
// eslint-disable-next-line import/first
import {
  canonicalContentHash,
  pdfContentHashLabel,
} from "../src/lib/contentHash";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

const WORK = {
  title: "Степной рассвет",
  description: "фотография, снята на рассвете над Алматы",
  kind: "photo",
  ownerName: "Абдолла",
  country: "KZ",
  city: "Алматы",
};

async function issue(body: Record<string, unknown> = WORK) {
  return request(app()).post("/api/pipeline/protect").send(body);
}

async function verify(certId: string) {
  return request(app()).get(`/api/pipeline/verify/${certId}`);
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("круг «выдали сегодня → проверили» замыкается через настоящие ручки", () => {
  test("контроль: выдача вообще состоялась и что-то записала", async () => {
    const r = await issue();
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.certificate?.id).toMatch(/^cert-/);
    // Без этой проверки фальшивая база могла бы молча ничего не сохранить,
    // и все остальные тесты стали бы проверять пустоту.
    expect(store.IPCertificate ?? []).toHaveLength(1);
    expect(store.QuantumShield ?? []).toHaveLength(1);
  });

  test("свежий сертификат сходится по хешу — и по НЫНЕШНЕМУ правилу", async () => {
    const issued = await issue();
    const v = await verify(issued.body.certificate.id);
    expect(v.status).toBe(200);
    expect(v.body.integrity.contentHashValid).toBe(true);
    // Не «сошлось хоть как-нибудь»: новый сертификат обязан быть v2.
    // Иначе выдача незаметно откатилась бы на старое правило.
    expect(v.body.integrity.contentHashRule).toBe("v2");
  });

  test("подпись HMAC пересчитывается — signedAt записан при выдаче", async () => {
    const issued = await issue();
    const v = await verify(issued.body.certificate.id);
    // У апрельских сертификатов здесь NO_SIGNED_AT, и это была главная
    // причина серых плиток. У выданного сегодня так быть не должно.
    expect(v.body.integrity.signatureHmacReason).toBe("OK");
    expect(v.body.integrity.signatureHmacValid).toBe(true);
  });

  test("щит активен, не legacy, и распределение настоящее", async () => {
    const issued = await issue();
    const v = await verify(issued.body.certificate.id);
    expect(v.body.integrity.quantumShieldStatus).toBe("active");
    expect(v.body.integrity.shieldLegacy).toBe(false);
    // Значение сверяется с тем, что ДЕЙСТВИТЕЛЬНО пишет выдача, а не с
    // придуманным: строка INSERT содержит 'distributed_v2'.
    expect(v.body.shardDistribution?.policy).toBe("distributed_v2");
  });

  test("сводный вердикт сервера — целостность подтверждена", async () => {
    const issued = await issue();
    const v = await verify(issued.body.certificate.id);
    expect(v.body.integrityVerified).toBe(true);
  });
});

describe("подделка после выдачи ловится", () => {
  test("правка названия в базе роняет проверку хеша", async () => {
    const issued = await issue();
    const id = issued.body.certificate.id;
    // Правим ровно то, что защищает хеш, — как это сделал бы тот, кто
    // получил доступ к базе и хочет присвоить чужую работу.
    store.IPCertificate[0].title = "Чужое название";

    const v = await verify(id);
    expect(v.body.integrity.contentHashValid).toBe(false);
    expect(v.body.integrity.contentHashRule).toBeNull();
    expect(v.body.integrityVerified).toBe(false);
  });

  test("правка ГОРОДА тоже ловится — у нынешнего правила он в хеше", async () => {
    // Ровно то, чего не умеет правило v1. Тест закрепляет, что новая выдача
    // это умеет: иначе разница между правилами перестала бы существовать.
    const issued = await issue();
    const id = issued.body.certificate.id;
    store.IPCertificate[0].city = "Астана";

    const v = await verify(id);
    expect(v.body.integrity.contentHashValid).toBe(false);
  });

// ── Офлайн-пакет свежего сертификата ────────────────────────────────
  //
  // Замер на проде 28.08.2026: подпись AEVION лежит в пакете у ДВУХ записей из
  // семи. У пяти апрельских её нет — их подписывала прежняя схема, где в
  // подписанный текст входил `timestamp: Date.now()`, нигде не сохранённый.
  // Восстановить сообщение нельзя, значит и проверить подпись нельзя никому.
  //
  // Отсюда вопрос, который не стерёг никто: а СЕГОДНЯШНИЙ сертификат — он
  // проверяем? Обещание «переживёт AEVION» держится ровно на этом.
  async function bundle(certId: string) {
    return request(app()).get(`/api/pipeline/certificate/${certId}/bundle.json`);
  }

  test("у свежего сертификата в пакете ЕСТЬ подпись AEVION", async () => {
    const issued = await issue();
    const r = await bundle(issued.body.certificate.id);
    expect(r.status).toBe(200);
    const a = r.body?.proofs?.aevionEd25519;
    expect(a, "подписи в пакете нет — обещание «проверьте без нас» пусто").toBeTruthy();
    expect(String(a.signature).length, "подпись обрезана").toBeGreaterThan(100);
    expect(String(a.publicKeyRawHex).length, "ключ не 32 байта").toBe(64);
    expect(String(a.signedPayload).length, "нет подписанного текста").toBeGreaterThan(10);
  });

  test("⭐ подпись из пакета ДЕЙСТВИТЕЛЬНО сходится — проверено криптографией", async () => {
    // Самая сильная возможная проверка обещания: берём из пакета ровно то, что
    // получит посторонний, и сверяем подпись его же способом. Ни одна строка
    // здесь не доверяет нашему коду на слово.
    const issued = await issue();
    const r = await bundle(issued.body.certificate.id);
    const a = r.body.proofs.aevionEd25519;

    const rawPub = Buffer.from(String(a.publicKeyRawHex), "hex");
    expect(rawPub.length).toBe(32);
    // RFC 8410: 12-байтовый префикс SPKI для Ed25519.
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      rawPub,
    ]);
    const pubKey = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });

    const ok = crypto.verify(
      null,
      Buffer.from(String(a.signedPayload), "utf8"),
      pubKey,
      Buffer.from(String(a.signature), "hex"),
    );
    expect(ok, "подпись в пакете НЕ сходится с подписанным текстом").toBe(true);
  });

  test("контроль: испорченный подписанный текст подпись НЕ проходит", async () => {
    // Без этого контроля предыдущая проверка могла бы быть зелёной по ошибке
    // (например, если бы verify молча возвращал true на любом входе).
    const issued = await issue();
    const r = await bundle(issued.body.certificate.id);
    const a = r.body.proofs.aevionEd25519;
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(String(a.publicKeyRawHex), "hex"),
    ]);
    const pubKey = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });
    const ok = crypto.verify(
      null,
      Buffer.from(String(a.signedPayload) + " ", "utf8"),
      pubKey,
      Buffer.from(String(a.signature), "hex"),
    );
    expect(ok, "подпись сходится с ЧУЖИМ текстом — проверка ничего не значит").toBe(false);
  });

  test("отзыв сертификата виден в ответе", async () => {
    const issued = await issue();
    const id = issued.body.certificate.id;
    store.IPCertificate[0].status = "revoked";

    const v = await verify(id);
    expect(v.body.certificate.status).toBe("revoked");
  });
});

describe("соподпись автора — слой, который делает вердикт ПОЛНЫМ", () => {
  // Без соподписи новый сертификат получает «verified-legacy»: страница
  // честно не произносит «сошлись все слои». Слой добавляет браузер
  // покупателя, и именно поэтому его надо проверять здесь: если выдача
  // перестанет его принимать, снаружи это будет выглядеть как «всё в
  // порядке, просто без одной галочки» — то есть молча.

  /** Ключ в том же виде, в каком его отдаёт WebCrypto браузера. */
  function browserKey() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    // Сырые 32 байта: из SPKI отбрасываем 12-байтовый префикс RFC 8410.
    const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
    return {
      publicKeyBase64: spki.subarray(12).toString("base64"),
      sign: (message: string) =>
        crypto
          .sign(null, Buffer.from(message, "utf8"), privateKey)
          .toString("base64"),
    };
  }

  test("контроль: без соподписи слой отсутствует — значит тест ниже что-то меняет", async () => {
    const issued = await issue();
    const v = await verify(issued.body.certificate.id);
    expect(v.body.integrity.authorCosign?.present).toBe(false);
  });

  test("сертификат с соподписью браузера проверяется по ВСЕМ слоям", async () => {
    const key = browserKey();
    const contentHash = canonicalContentHash({
      title: WORK.title,
      description: WORK.description,
      kind: WORK.kind,
      country: WORK.country,
      city: WORK.city,
    });

    const issued = await issue({
      ...WORK,
      authorPublicKey: key.publicKeyBase64,
      authorSignature: key.sign(contentHash),
    });
    expect(issued.status, JSON.stringify(issued.body)).toBe(201);

    const v = await verify(issued.body.certificate.id);
    expect(v.body.integrity.authorCosign).toMatchObject({
      present: true,
      valid: true,
    });
    // Полный набор: то, ради чего продукт и продаётся.
    expect(v.body.integrity.contentHashValid).toBe(true);
    expect(v.body.integrity.contentHashRule).toBe("v2");
    expect(v.body.integrity.signatureHmacValid).toBe(true);
    expect(v.body.integrity.quantumShieldStatus).toBe("active");
    expect(v.body.integrity.shieldLegacy).toBe(false);
    expect(v.body.integrityVerified).toBe(true);
  });

  test("чужая подпись не принимается — выдача отказывает ДО записи в базу", async () => {
    const key = browserKey();
    const other = browserKey();
    const contentHash = canonicalContentHash({
      title: WORK.title,
      description: WORK.description,
      kind: WORK.kind,
      country: WORK.country,
      city: WORK.city,
    });

    const r = await issue({
      ...WORK,
      authorPublicKey: key.publicKeyBase64,
      authorSignature: other.sign(contentHash),
    });
    expect(r.status).toBe(400);
    // Отказ обязан быть ДО записи, иначе в реестре осядет полусертификат.
    expect(store.IPCertificate ?? []).toHaveLength(0);
    expect(store.QuantumShield ?? []).toHaveLength(0);
  });
});

describe("PDF не утверждает больше, чем проверено", () => {
  // PDF — то, что покупатель уносит с собой и показывает третьей стороне.
  // До 27.08.2026 он печатал строку из базы как факт, ничего не пересчитывая:
  // у записи с подменённым названием получался такой же документ, как у целой.
  //
  // ⚠️ Надписи в PDF проверить чтением байтов НЕЛЬЗЯ: PDFKit кодирует текст
  // подмножеством шрифта, в потоке документа ASCII нет. Первая версия этого
  // теста искала там строки — и контроль извлекателя это поймал, иначе
  // проверки сравнивали бы пустоту и были бы вечно зелёными на отрицаниях.
  // Поэтому решение отделено от рисования и проверяется напрямую.

  async function pdf(certId: string) {
    return request(app())
      .get(`/api/pipeline/certificate/${certId}/pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
  }

  test("контроль: PDF отдаётся и это действительно PDF", async () => {
    const issued = await issue();
    const r = await pdf(issued.body.certificate.id);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/application\/pdf/);
    expect(r.body.toString("latin1").slice(0, 5)).toBe("%PDF-");
  });

test.each(["bitcoin-confirmed", "pending", "failed", null])(
    "PDF рисуется при состоянии якоря %s — новая строка не роняет документ",
    async (status) => {
      const issued = await issue();
      const id = issued.body.certificate.id;
      store.IPCertificate[0].otsStatus = status;
      store.IPCertificate[0].otsBitcoinBlockHeight = status === "bitcoin-confirmed" ? 912345 : null;
      const r = await pdf(id);
      expect(r.status).toBe(200);
      expect(r.body.toString("latin1").slice(0, 5)).toBe("%PDF-");
    },
  );

  test("строка про якорь действительно ВСТАВЛЕНА в документ", async () => {
    // Надписи из PDFKit не извлекаются, поэтому «попала ли строка в документ»
    // проверяется по исходнику. Проверка слабее чтения документа, но РЕАЛЬНАЯ:
    // без неё функция pdfAnchorField была бы покрыта тестами и не вызвана
    // ниоткуда — ровно тот класс «код обещает то, чего не делает».
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/routes/pipeline.ts", import.meta.url), "utf8"),
    );
    const i = src.indexOf(`label: "HMAC-SHA256 SIGNATURE"`);
    expect(i, "не найден блок полей PDF — проверка смотрит не туда").toBeGreaterThan(0);
    const block = src.slice(i, i + 900);
    expect(block, "pdfAnchorField не вызывается в блоке полей PDF").toContain("pdfAnchorField(");
  });

  test("PDF рисуется и когда хеш НЕ сходится — документ не падает", async () => {
    // Важно именно это: при расхождении рисуется дополнительная полоса.
    // Ошибка в её координатах уронила бы выдачу документа целиком.
    const issued = await issue();
    const id = issued.body.certificate.id;
    store.IPCertificate[0].title = "Чужое название";
    const r = await pdf(id);
    expect(r.status).toBe(200);
    expect(r.body.toString("latin1").slice(0, 5)).toBe("%PDF-");
  });

  test("подпись под хешем: сошлось по нынешнему правилу", () => {
    expect(
      pdfContentHashLabel({ valid: true, rule: "v2" }, "2026-08-27T10:00:00.000Z"),
    ).toBe("CONTENT HASH (SHA-256) — re-verified 2026-08-27");
  });

  test("подпись под хешем: сошлось по прежнему правилу — ограничение названо", () => {
    const label = pdfContentHashLabel(
      { valid: true, rule: "v1" },
      "2026-08-27T10:00:00.000Z",
    );
    expect(label).toMatch(/re-verified 2026-08-27/);
    expect(label).toMatch(/location not covered/);
  });

  test("подпись под хешем: НЕ сошлось — ни слова о подтверждении", () => {
    const label = pdfContentHashLabel({ valid: false, rule: null }, "2026-08-27T10:00:00.000Z");
    expect(label).toMatch(/DOES NOT MATCH/);
    expect(label).not.toMatch(/verified/);
  });
});
