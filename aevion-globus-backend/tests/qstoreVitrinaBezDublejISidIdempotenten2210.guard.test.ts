import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/*
 * 🔴 22.10.2026, замер прода GET /api/qstore/products: 21 товар = 5 названий × 4 копии + 1 — сид демо-контента
 * до 21.08 создавал копию каждым запуском; витрина показывала одно и то же четырежды. Слово оркестратора:
 *  (1) в выдаче на одно название — один товар, самый ранний; в базе не удалять; карточки копий по id открываются;
 *  (2) 21 на входе → 6 на выходе; мутация, снимающая отбор, краснеет;
 *  (3) повторный сид не плодит копий: тот же продавец + то же название → существующий товар (200, existing).
 * Мок базы НЕ исполняет SQL (DISTINCT ON там проверяется текстом запроса) — он отдаёт все 21 строку, поэтому
 * склейку обязан делать код; это и ловит мутация.
 */

const query = vi.fn();
const dbReady = vi.fn(() => true);
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureQStoreTables", () => ({ ensureQStoreTables: vi.fn(), isQStoreDbReady: () => dbReady() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => undefined }));

// eslint-disable-next-line import/first
import { qstoreRouter, безДублейПоНазванию } from "../src/routes/qstore";
// eslint-disable-next-line import/first
import { getJwtSecret } from "../src/lib/authJwt";

const app = () => { const a = express(); a.use(express.json()); a.use(qstoreRouter); return a; };
const bearer = (sub: string) => "Bearer " + jwt.sign({ sub }, getJwtSecret(), { algorithm: "HS256", expiresIn: "1h" });

type Row = { id: string; sellerId: string; title: string; description: string; category: string; price: number; currency: string; previewUrl: string; tags: string[]; salesCount: number; avgRating: number; reviewCount: number; isPublic: boolean; createdAt: string; updatedAt: string };
let строки: Row[] = [];
let вставок = 0;

/** 5 названий × 4 копии + 1; самая ранняя копия нарочно НЕ первая в массиве (ловим «первый выигрывает»). */
function двадцатьОдин(): Row[] {
  const названия = ["QCoreAI Prompt Engineering Course", "Kazakhstan Business Launch Checklist", "Web3 Smart Contract Templates (KZ Law)", "HealthAI Wellness Tracker Spreadsheet", "CyberChess Opening Repertoire Pack"];
  const rows: Row[] = [];
  let n = 0;
  for (const [ti, title] of названия.entries()) {
    for (const копия of [2, 0, 3, 1]) { // порядок в массиве: вторая, самая ранняя, четвёртая, третья
      n++;
      rows.push({ id: `p${ti}-${копия}`, sellerId: "seller-seed", title, description: "d", category: "templates", price: 1900, currency: "usd", previewUrl: "", tags: [], salesCount: 10 - копия, avgRating: 4, reviewCount: 1, isPublic: true, createdAt: new Date(Date.UTC(2026, 7, 1 + копия * 7)).toISOString(), updatedAt: "2026-10-01T00:00:00.000Z" });
    }
  }
  rows.push({ id: "p-kit", sellerId: "seller-seed", title: "AEVION IP Protection Starter Kit", description: "d", category: "templates", price: 1900, currency: "usd", previewUrl: "", tags: [], salesCount: 1, avgRating: 0, reviewCount: 0, isPublic: true, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" });
  expect(rows).toHaveLength(21);
  return rows;
}

beforeEach(() => {
  строки = двадцатьОдин();
  вставок = 0;
  dbReady.mockReturnValue(true);
  query.mockReset();
  query.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (/WHERE "id" = \$1/.test(s) && /SELECT \* FROM "QStoreProduct"/.test(s)) {
      const r = строки.filter((x) => x.id === params?.[0]); return { rows: r, rowCount: r.length };
    }
    if (/"sellerId" = \$1 AND lower\(trim\("title"\)\) = \$2/.test(s)) {
      const r = строки.filter((x) => x.sellerId === params?.[0] && x.title.trim().toLowerCase() === params?.[1]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { rows: r.slice(0, 1), rowCount: Math.min(1, r.length) };
    }
    if (/INSERT INTO "QStoreProduct"/.test(s)) {
      const p = params as unknown[];
      вставок++;
      строки.push({ id: String(p[0]), sellerId: String(p[1]), title: String(p[2]), description: String(p[3]), category: String(p[4]), price: Number(p[5]), currency: String(p[6]), previewUrl: String(p[7]), tags: p[8] as string[], salesCount: 0, avgRating: 0, reviewCount: 0, isPublic: true, createdAt: String(p[11]), updatedAt: String(p[12]) });
      return { rows: [], rowCount: 1 };
    }
    if (/FROM "QStoreProduct"/.test(s)) { const r = строки.filter((x) => x.isPublic); return { rows: r, rowCount: r.length }; }
    return { rows: [], rowCount: 0 };
  });
});

describe("витрина QStore без дублей по названию", () => {
  test("🔴 GET /products: 21 строка базы → 6 товаров, на название самый ранний, total честный, SQL склеивает ДО LIMIT", async () => {
    const r = await request(app()).get("/products?limit=50");
    expect(r.status).toBe(200);
    const titles = r.body.products.map((p: Row) => p.title);
    expect(r.body.products, "21 → 6").toHaveLength(6);
    expect(new Set(titles).size).toBe(6);
    expect(r.body.total).toBe(6);
    // победитель — самая ранняя копия (копия 0), а не первая в порядке выдачи
    for (const p of r.body.products) if (p.id !== "p-kit") expect(p.id.endsWith("-0"), `${p.title}: ${p.id}`).toBe(true);
    const sql = String(query.mock.calls.find((c) => /FROM "QStoreProduct"/.test(String(c[0])))?.[0]);
    expect(sql).toContain('DISTINCT ON (lower(trim("title")))');
    expect(sql.indexOf("DISTINCT ON")).toBeLessThan(sql.indexOf("LIMIT"));
    expect(sql).toMatch(/ORDER BY "salesCount" DESC LIMIT/);
  });

  test("карточка копии по прямому id открывается — ссылки не сломаны, в базе ничего не удалено", async () => {
    const r = await request(app()).get("/products/p2-3");
    expect(r.status).toBe(200);
    expect(r.body.product.id).toBe("p2-3");
    expect(строки).toHaveLength(21);
  });

  test("GET /featured: подборки без повторов названий и без недобора (6 уникальных ≥ limit 5)", async () => {
    const r = await request(app()).get("/featured?limit=5");
    expect(r.status).toBe(200);
    for (const k of ["popular", "newest", "trending"]) {
      const t = r.body[k].map((p: Row) => p.title);
      expect(new Set(t).size, k).toBe(t.length);
      expect(t, `${k}: недобор из-за склейки после LIMIT`).toHaveLength(5);
    }
  });

  test("безДублейПоНазванию: регистр и пробелы — одно название; порядок входа сохраняется", () => {
    const a = { id: "b", title: " Курс ", createdAt: "2026-01-02T00:00:00Z" };
    const b = { id: "a", title: "курс", createdAt: "2026-01-01T00:00:00Z" };
    const c = { id: "c", title: "Другой", createdAt: "2026-01-03T00:00:00Z" };
    expect(безДублейПоНазванию([a, c, b])).toEqual([c, b]);
  });
});

describe("сид идемпотентен на сервере: тот же продавец + то же название = тот же товар", () => {
  const тело = { title: "QCoreAI Prompt Engineering Course", description: "x", category: "courses", price: 4900 };

  test("🔴 два запуска подряд: 1-й → 200 existing (товар уже есть у продавца), вставок 0; новое название → 201, вставка 1; второй раз → 200, вставок по-прежнему 1", async () => {
    const a = app();
    const r1 = await request(a).post("/me/products").set("Authorization", bearer("seller-seed")).send(тело);
    expect(r1.status).toBe(200);
    expect(r1.body.existing).toBe(true);
    expect(r1.body.product.id, "самая ранняя копия").toBe("p0-0");
    expect(вставок).toBe(0);

    const новое = { ...тело, title: "Совсем новый товар" };
    const r2 = await request(a).post("/me/products").set("Authorization", bearer("seller-seed")).send(новое);
    expect(r2.status).toBe(201);
    expect(вставок).toBe(1);
    const r3 = await request(a).post("/me/products").set("Authorization", bearer("seller-seed")).send({ ...новое, title: "  совсем НОВЫЙ товар " });
    expect(r3.status).toBe(200);
    expect(r3.body.existing).toBe(true);
    expect(r3.body.product.id).toBe(r2.body.product.id);
    expect(вставок, "повторный запуск не плодит копий").toBe(1);
  });

  test("КОНТРОЛЬ: другой продавец с тем же названием создаёт свой товар", async () => {
    const r = await request(app()).post("/me/products").set("Authorization", bearer("seller-other")).send(тело);
    expect(r.status).toBe(201);
    expect(вставок).toBe(1);
  });

  test("память (база недоступна): тот же порядок — второй запуск не плодит копий", async () => {
    dbReady.mockReturnValue(false);
    const a = app();
    const r1 = await request(a).post("/me/products").set("Authorization", bearer("s-mem")).send({ ...тело, title: "Память: товар" });
    const r2 = await request(a).post("/me/products").set("Authorization", bearer("s-mem")).send({ ...тело, title: "память: товар " });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body.product.id).toBe(r1.body.product.id);
    const list = await request(a).get("/products?q=Память&limit=50");
    expect(list.body.products.filter((p: Row) => p.title.toLowerCase().startsWith("память"))).toHaveLength(1);
  });
});
