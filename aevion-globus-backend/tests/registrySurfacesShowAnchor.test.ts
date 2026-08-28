import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Публичный реестр не показывал состояние якоря в биткойне.
 *
 * Замер 28.08.2026, ответ прода `GET /api/pipeline/certificates`:
 *   id, title, kind, author, location, contentHash, fileHash, algorithm,
 *   protectedAt, verifiedCount, shieldId, verifyUrl
 *
 * Ни `otsStatus`, ни высоты блока. То есть на витрине продукта, который
 * продаётся фразой «доказательство, которое переживёт AEVION», нельзя было
 * увидеть, чем именно подтверждена запись. Особенно это било по поиску по
 * хешу: им пользуется ТРЕТЬЯ сторона, чтобы узнать, зарегистрирована ли уже
 * работа, и ответ «да, есть запись» без состояния якоря — половина ответа.
 *
 * Поверхностей три, и проверяются все три: одна починенная из трёх выглядит
 * как починенный класс и потому опаснее, чем ни одной.
 */

let row: Record<string, unknown> = {};
let rows: Array<Record<string, unknown>> = [];
/** Все SQL, которые прошли через пул: подменённый пул не умеет «не отдать»
 *  колонку, которую забыли выбрать, поэтому список колонок проверяется по
 *  тексту запроса. Без этого мутация «убрать otsStatus из SELECT» выживает —
 *  проверено, она выжила, и этот блок появился именно поэтому. */
let seenSql: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      seenSql.push(String(sql));
      if (String(sql).includes('FROM "IPCertificate"')) return { rows };
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

const HASH = "a".repeat(64);

/**
 * Разбор строки CSV по правилам кавычек. Наивное деление по запятой врало:
 * поле «Астана, KZ» само содержит запятую и потому закавычено — столбец 10
 * оказывался серединой адреса, а не состоянием якоря. Прибор ошибался, не код.
 * Заодно этот разбор проверяет, что экранирование вообще есть.
 */
function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

beforeEach(() => {
  row = {
    id: "cert-anchor-0001",
    title: "Степной рассвет",
    kind: "photo",
    authorName: "Досымбек",
    country: "KZ",
    city: "Астана",
    contentHash: HASH,
    fileHash: null,
    algorithm: "sha256",
    status: "active",
    protectedAt: new Date("2026-08-01T00:00:00Z"),
    verifiedCount: 3,
    shieldId: "qs-1",
    otsStatus: "bitcoin-confirmed",
    otsBitcoinBlockHeight: "912345",
  };
  rows = [row];
  seenSql = [];
});

/** Запрос, выбирающий сертификаты (не CREATE TABLE и не служебные). */
const selects = () =>
  seenSql.filter((s) => s.includes('FROM "IPCertificate"') && s.includes("SELECT"));

describe("все три поверхности реестра показывают состояние якоря", () => {
  test("список: у записи есть bitcoinAnchor со статусом и высотой блока", async () => {
    const r = await request(app()).get("/api/pipeline/certificates");
    expect(r.status).toBe(200);
    const c = r.body.certificates[0];
    expect(c.bitcoinAnchor, "в списке нет поля bitcoinAnchor").toBeDefined();
    expect(c.bitcoinAnchor.status).toBe("bitcoin-confirmed");
    expect(c.bitcoinAnchor.bitcoinBlockHeight).toBe(912345);
  });

  test("поиск по хешу: третья сторона видит, чем подтверждена запись", async () => {
    const r = await request(app()).get(`/api/pipeline/lookup/${HASH}`);
    expect(r.status).toBe(200);
    expect(r.body.protected).toBe(true);
    expect(r.body.certificate.bitcoinAnchor, "в ответе поиска нет поля bitcoinAnchor").toBeDefined();
    expect(r.body.certificate.bitcoinAnchor.status).toBe("bitcoin-confirmed");
    expect(r.body.certificate.bitcoinAnchor.bitcoinBlockHeight).toBe(912345);
  });

  test("выгрузка CSV: столбцы якоря есть и заполнены", async () => {
    const r = await request(app()).get("/api/pipeline/certificates.csv");
    expect(r.status).toBe(200);
    const [header, first] = r.text.split(/\r?\n/);
    // Контроль прибора: поле с запятой обязано быть закавычено, иначе разбор
    // по столбцам бессмыслен для всех, кто откроет выгрузку.
    expect(first).toContain(`"Астана, KZ"`);
    // Точное имя, а не подстрока: "bitcoinAnchorStatus" содержит "anchorStatus",
    // и прежняя проверка прошла бы при любом из двух имён.
    expect(csvFields(header)).toContain("bitcoinAnchorStatus");
    expect(csvFields(header)).toContain("bitcoinBlockHeight");
    expect(first).toContain("bitcoin-confirmed");
    expect(first).toContain("912345");
  });

  test("CSV: столбцы якоря дописаны в КОНЕЦ, порядок прежних не сдвинут", async () => {
    const r = await request(app()).get("/api/pipeline/certificates.csv");
    const cols = csvFields(r.text.split(/\r?\n/)[0]);
    // Прежний контракт: первые десять столбцов на своих местах.
    expect(cols.slice(0, 10)).toEqual([
      "id", "title", "kind", "author", "location",
      "contentHash", "fileHash", "algorithm", "protectedAt", "verifiedCount",
    ]);
    expect(cols[cols.length - 1]).toBe("verifyUrl");
  });

  test.each([
    ["список", "/api/pipeline/certificates"],
    ["поиск по хешу", `/api/pipeline/lookup/${HASH}`],
    ["выгрузка CSV", "/api/pipeline/certificates.csv"],
  ])("%s: колонки якоря действительно ЗАПРОШЕНЫ у базы", async (_name, url) => {
    await request(app()).get(url);
    const s = selects();
    expect(s.length, "запрос к IPCertificate не сделан вовсе").toBeGreaterThan(0);
    for (const q of s) {
      expect(q, "в SELECT нет otsStatus — на живой базе якорь у всех станет not_stamped").toContain(`"otsStatus"`);
      expect(q, "в SELECT нет otsBitcoinBlockHeight — номер блока будет пустым").toContain(`"otsBitcoinBlockHeight"`);
    }
  });

test("офлайн-пакет называет состояние якоря словами, а не пустотой", async () => {
    row.otsStatus = null;
    row.otsBitcoinBlockHeight = null;
    const r = await request(app()).get(`/api/pipeline/certificate/${String(row.id)}/bundle.json`);
    expect(r.status).toBe(200);
    const ots = r.body?.proofs?.openTimestamps;
    expect(ots, "поле openTimestamps отсутствует или null — «не знаю» и «нет якоря» снова слиты").not.toBeNull();
    expect(ots.status).toBe("not_stamped");
    expect(String(ots.note)).toMatch(/none will appear/i);
    expect(ots.proofBase64).toBeNull();
  });

  test("офлайн-пакет: подтверждённый якорь приходит с высотой блока", async () => {
    row.otsStatus = "bitcoin-confirmed";
    row.otsBitcoinBlockHeight = "912345";
    const r = await request(app()).get(`/api/pipeline/certificate/${String(row.id)}/bundle.json`);
    expect(r.status).toBe(200);
    expect(r.body.proofs.openTimestamps.status).toBe("bitcoin-confirmed");
    expect(r.body.proofs.openTimestamps.bitcoinBlockHeight).toBe(912345);
  });

  test("не якорённый сертификат не выдаётся за ожидающий", async () => {
    row.otsStatus = null;
    row.otsBitcoinBlockHeight = null;
    const r = await request(app()).get("/api/pipeline/certificates");
    const c = r.body.certificates[0];
    expect(c.bitcoinAnchor.status).toBe("not_stamped");
    expect(c.bitcoinAnchor.status).not.toBe("pending");
    expect(c.bitcoinAnchor.bitcoinBlockHeight).toBeNull();
  });

test("страница автора: у каждой работы есть состояние якоря", async () => {
    // Седьмая поверхность. Публичная страница автора показывает его работы —
    // и до 28.08.2026 не говорила про якорь ничего, хотя это главное, чем
    // запись отличается от строки в чьей-то базе.
    const r = await request(app()).get("/api/pipeline/authors/dosymbek");
    expect(r.status).toBe(200);
    const c = r.body.certificates?.[0];
    expect(c, "ответ без работ — проверка смотрит не туда").toBeTruthy();
    expect(c.bitcoinAnchor, "у работы на странице автора нет поля bitcoinAnchor").toBeDefined();
    expect(c.bitcoinAnchor.status).toBe("bitcoin-confirmed");
    expect(c.bitcoinAnchor.bitcoinBlockHeight).toBe(912345);
  });

  test("страница автора: колонки якоря ЗАПРОШЕНЫ у базы", async () => {
    await request(app()).get("/api/pipeline/authors/dosymbek");
    const sel = selects();
    expect(sel.length).toBeGreaterThan(0);
    for (const q of sel) {
      expect(q, "в SELECT нет otsStatus — на живой базе якорь у всех станет not_stamped").toContain(`"otsStatus"`);
      expect(q).toContain(`"otsBitcoinBlockHeight"`);
    }
  });

  test("страница автора: не якорённая работа не выдаётся за ожидающую", async () => {
    row.otsStatus = null;
    row.otsBitcoinBlockHeight = null;
    const r = await request(app()).get("/api/pipeline/authors/dosymbek");
    expect(r.body.certificates[0].bitcoinAnchor.status).toBe("not_stamped");
  });

  test("три состояния дают три разных ответа во всех трёх поверхностях", async () => {
    const seen = { list: new Set<string>(), lookup: new Set<string>(), csv: new Set<string>() };
    for (const s of [null, "pending", "bitcoin-confirmed"]) {
      row.otsStatus = s;
      seen.list.add((await request(app()).get("/api/pipeline/certificates")).body.certificates[0].bitcoinAnchor.status);
      seen.lookup.add((await request(app()).get(`/api/pipeline/lookup/${HASH}`)).body.certificate.bitcoinAnchor.status);
      const csv = (await request(app()).get("/api/pipeline/certificates.csv")).text.split(/\r?\n/)[1];
      seen.csv.add(csvFields(csv)[10]);
    }
    expect(seen.list.size, "список не различает состояния").toBe(3);
    expect(seen.lookup.size, "поиск не различает состояния").toBe(3);
    expect(seen.csv.size, "выгрузка не различает состояния").toBe(3);
  });
});
