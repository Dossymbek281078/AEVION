import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * У продукта, который продаётся как «доказательство авторства», не было ни
 * одного теста на круг «выдали сертификат → проверили сертификат».
 *
 * Замер на проде 23.08.2026 (5 сертификатов из 5):
 *
 *   valid                    true      ← всегда, это константа в коде
 *   integrity.contentHashValid  false  ← у ВСЕХ пяти
 *   integrity.signatureHmacValid null  (NO_SIGNED_AT)
 *   bitcoinAnchor.status     not_stamped
 *
 * То есть ручка отвечала «valid» ровно тогда, когда проверка не сходилась.
 * Страница /verify/[id] честна — она считает свой вердикт по слоям и рисует
 * красную плитку. А вот тот, кто читает ответ через API (и наша же спека,
 * обещавшая поле `cert`, которого в ответе нет), получал «valid: true» и
 * никакого признака расхождения.
 *
 * Поэтому здесь три разных вопроса, и они намеренно разделены:
 *   1) сходится ли круг вообще — сертификат, выданный по нашему же правилу,
 *      обязан проверяться (иначе «forever-verifiable» не работает НИ для кого);
 *   2) ловится ли подделка — испорченный хеш обязан давать false;
 *   3) есть ли в ответе поле, которое можно показать человеку как вердикт.
 */

const CERT_ID = "cert-test-0000000000000001";

/** Строка сертификата в том виде, в каком её кладёт protectOne(). */
type Row = Record<string, unknown>;
let certRow: Row = {};

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      const q = String(sql);
      if (q.includes('SELECT * FROM "IPCertificate"')) return { rows: [certRow] };
      if (q.includes('FROM "QuantumShield"')) {
        // Значение ровно то, которое пишет выдача (см. INSERT в protectOne).
        // Раньше здесь стояло "real_2of3" — состояние, которого в проде не
        // бывает, и код читает его как legacy_all_local. Фикстура, описывающая
        // несуществующий мир, тихо проверяет не тот путь.
        return { rows: [{ status: "active", legacy: false, distribution_policy: "distributed_v2" }] };
      }
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

process.env.QSIGN_SECRET = process.env.QSIGN_SECRET || "test-secret-for-verify-roundtrip";

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";
// eslint-disable-next-line import/first
import { canonicalContentHash } from "../src/lib/contentHash";
// eslint-disable-next-line import/first
import { openapiSpec } from "../src/lib/openapiSpec";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

/** Поля, из которых считается канонический хеш — те же, что у protectOne. */
const FIELDS = {
  title: "Степной рассвет",
  description: "фотография, снята на рассвете",
  kind: "photo",
  country: "KZ",
  city: "Алматы",
};

function makeRow(contentHash: string): Row {
  return {
    id: CERT_ID,
    objectId: "obj-1",
    ...FIELDS,
    authorName: "А. Досымбек",
    authorEmail: "a@example.com",
    contentHash,
    fileHash: null,
    signatureHmac: "0".repeat(64),
    signatureEd25519: "1".repeat(128),
    algorithm: "SHA-256 + HMAC-SHA256 + Ed25519",
    protectedAt: "2026-08-23T00:00:00.000Z",
    signedAt: null,
    qsignKeyVersion: 1,
    status: "active",
    shieldId: "qs-1",
    shardCount: 3,
    shardThreshold: 2,
    verifiedCount: 0,
    legalBasis: {},
    otsProof: null,
    otsStatus: null,
    otsBitcoinBlockHeight: null,
    otsStampedAt: null,
    authorPublicKey: null,
    authorSignature: null,
    authorKeyAlgo: null,
  };
}

const get = () => request(app()).get(`/api/pipeline/verify/${CERT_ID}`);

beforeEach(() => {
  certRow = makeRow(canonicalContentHash(FIELDS));
});

describe("Проверка сертификата говорит правду", () => {
  test("круг сходится: сертификат, выданный по нашему правилу, проверяется", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(
      r.body.integrity?.contentHashValid,
      "хеш, посчитанный тем же кодом, что и при выдаче, не сошёлся при проверке — " +
        "значит НИ ОДИН сертификат не проверяется",
    ).toBe(true);
  });

  test("подделка ловится: испорченный хеш даёт contentHashValid=false", async () => {
    certRow = makeRow("f".repeat(64));
    const r = await get();
    expect(r.body.integrity?.contentHashValid).toBe(false);
  });

  test("у ответа есть поле-вердикт, и на расхождении оно false", async () => {
    certRow = makeRow("f".repeat(64));
    const r = await get();
    expect(
      r.body.integrityVerified,
      "ответ не содержит ни одного поля, по которому видно расхождение",
    ).toBe(false);
  });

  test("вердикт true, когда все слои сошлись", async () => {
    const r = await get();
    expect(r.body.integrityVerified).toBe(true);
  });

  test("отозванный щит роняет вердикт", async () => {
    // Контроль второй оси: вердикт обязан зависеть НЕ ТОЛЬКО от хеша.
    const prev = certRow;
    certRow = { ...prev, shieldId: null };
    const r = await get();
    expect(r.body.integrity?.quantumShieldStatus).not.toBe("active");
    expect(r.body.integrityVerified).toBe(false);
  });

  test("valid остаётся true и на расхождении — это НЕ вердикт, и так задокументировано", async () => {
    certRow = makeRow("f".repeat(64));
    const r = await get();
    // Поведение сохранено намеренно: страница /verify/[id] по !valid показывает
    // «Certificate not found or invalid» ВМЕСТО разбора, то есть честный
    // послойный экран исчез бы ровно там, где он нужнее всего.
    expect(r.body.valid).toBe(true);
    const spec = openapiSpec as unknown as Record<string, any>;
    const props =
      spec.paths["/api/pipeline/verify/{certId}"].get.responses["200"].content[
        "application/json"
      ].schema.properties;
    expect(
      String(props.valid.description),
      "поле-константа обязано быть описано как таковое, иначе его читают как вердикт",
    ).toMatch(/НЕ вердикт/);
  });
});

describe("Спека описывает то, что ручка действительно отдаёт", () => {
  // ⚠️ ПЕРВАЯ ВЕРСИЯ ЭТОГО СТОРОЖА СРАВНИВАЛА ТОЛЬКО ВЕРХНИЙ УРОВЕНЬ.
  // Поймано мутацией 27.08.2026: переименование поля внутри integrity прошло
  // мимо обоих тестов, хотя они назывались «каждое поле». То есть сторож
  // отчитывался охватом, которого у него не было, — а таблица проверок на
  // странице собрана как раз из вложенных полей.

  const props = () => {
    const spec = openapiSpec as unknown as Record<string, any>;
    return spec.paths["/api/pipeline/verify/{certId}"].get.responses["200"]
      .content["application/json"].schema.properties;
  };

  const isPlainObject = (v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  /** Поля спеки, которых нет в ответе — с обходом вложенных объектов. */
  function specFieldsMissingFrom(
    schemaProps: Record<string, any>,
    body: Record<string, any>,
    path = "",
  ): string[] {
    const out: string[] = [];
    for (const [key, schema] of Object.entries(schemaProps)) {
      const here = path ? path + "." + key : key;
      if (!(key in body)) {
        out.push(here);
        continue;
      }
      // Спускаемся только там, где в ответе действительно объект: у
      // необязательных веток (bitcoinAnchor, shardDistribution) значения может
      // не быть вовсе, и требовать их поля здесь значило бы краснеть всегда.
      if (schema?.properties && isPlainObject(body[key])) {
        out.push(...specFieldsMissingFrom(schema.properties, body[key], here));
      }
    }
    return out;
  }

  /** Поля ответа, которых нет в спеке — с обходом вложенных объектов. */
  function bodyFieldsMissingFromSpec(
    body: Record<string, any>,
    schemaProps: Record<string, any>,
    path = "",
  ): string[] {
    const out: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      const here = path ? path + "." + key : key;
      const schema = schemaProps?.[key];
      if (!schema) {
        out.push(here);
        continue;
      }
      if (isPlainObject(value) && schema.properties) {
        out.push(...bodyFieldsMissingFromSpec(value, schema.properties, here));
      }
    }
    return out;
  }

  test("контроль: сторож видит вложенные поля, а не только верхний уровень", async () => {
    const r = await get();
    // Без этого теста прошлая версия сторожа выглядела бы исправной: она
    // сравнивала 10 ключей верхнего уровня и молчала про полсотни вложенных.
    const seen = bodyFieldsMissingFromSpec(
      { integrity: { ...r.body.integrity, выдуманноеПоле: 1 } },
      props(),
    );
    expect(seen).toContain("integrity.выдуманноеПоле");
  });

  test("каждое поле из спеки есть в настоящем ответе — включая вложенные", async () => {
    const r = await get();
    const documented = Object.keys(props());
    expect(documented.length, "контроль: спека вообще прочиталась").toBeGreaterThan(3);
    expect(
      specFieldsMissingFrom(props(), r.body),
      "спека называет поля, которых в ответе нет — сгенерированный клиент прочтёт undefined",
    ).toEqual([]);
  });

  test("каждое поле ответа описано в спеке — включая вложенные", async () => {
    const r = await get();
    expect(
      bodyFieldsMissingFromSpec(r.body, props()),
      "ручка отдаёт поля, которых нет в спеке — читатель спеки о них не узнает",
    ).toEqual([]);
  });
});
