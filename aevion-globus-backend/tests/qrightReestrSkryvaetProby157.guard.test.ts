import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 157 (18.10.2026, задание оркестратора). Публичные поверхности реестра QRight не показывают НАШИ пробы.
 * Повод: прогон полного пути 18.10 оставил 5 сертификатов smoke-probe-user-99-qright-<окно> в публичном
 * списке /qright (after-deploy: «проб 5 из 8»); отозвать их можно только Bearer владельца/админа, которого у
 * окна нет. Решение: фильтр на бэкенде тем же правилом, что у /api/pipeline/certificates (lib/publicRegistryProbes);
 * записи в базе не удаляются. Контроль «живая запись видна» — обязательная половина: иначе фильтр мог бы прятать всех.
 */

const ЖИВАЯ = { id: "obj-live", title: "Протокол долголетия: методика", kind: "text", contentHash: "a".repeat(64), ownerName: "Иванов", country: null, city: null, createdAt: new Date("2026-10-01T00:00:00Z"), revokedAt: null, revokeReason: null, revokeReasonCode: null, certificateId: null };
const ПРОБА_ПО_НАЗВАНИЮ = { ...ЖИВАЯ, id: "obj-probe-title", title: "smoke-probe-user-99-qright-390x844", ownerName: null };
const ПРОБА_ПО_АВТОРУ = { ...ЖИВАЯ, id: "obj-probe-author", title: "Музыка", ownerName: "probe-okno" };
const ВСЕ = [ЖИВАЯ, ПРОБА_ПО_НАЗВАНИЮ, ПРОБА_ПО_АВТОРУ];

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      if (!s.includes("QRightObject") || !s.trim().startsWith("SELECT")) return { rows: [], rowCount: 0 };
      if (s.includes('WHERE "id" = $1')) {
        const rows = ВСЕ.filter((r) => r.id === params?.[0]);
        return { rows, rowCount: rows.length };
      }
      if (s.includes("ILIKE")) {
        const q = String(params?.[0] ?? "").replace(/%/g, "").toLowerCase();
        const rows = ВСЕ.filter((r) => r.title.toLowerCase().includes(q));
        return { rows, rowCount: rows.length };
      }
      return { rows: ВСЕ, rowCount: ВСЕ.length };
    },
  }),
}));
vi.mock("../src/lib/ensureQRightTable", () => ({ ensureQRightTable: async () => {} }));
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n(),
}));

import { qrightRouter } from "../src/routes/qright";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qright", qrightRouter);
  return a;
}

describe("157: публичный реестр QRight прячет наши пробы и показывает живые записи", () => {
  it("🔴 GET /objects: живая запись есть, обе пробы нет, total равен числу показанных", async () => {
    const r = await request(app()).get("/api/qright/objects");
    expect(r.status).toBe(200);
    const ids = (r.body.items as { id: string }[]).map((x) => x.id);
    expect(ids).toContain("obj-live");
    expect(ids).not.toContain("obj-probe-title");
    expect(ids).not.toContain("obj-probe-author");
    expect(r.body.total).toBe(ids.length);
    expect(ids.length).toBe(1);
  });

  it("🔴 GET /objects/search: поиск по слову из названия пробы отдаёт 0, по живому — 1", async () => {
    const проба = await request(app()).get("/api/qright/objects/search?q=smoke-probe");
    expect(проба.status).toBe(200);
    expect(проба.body.items).toEqual([]);
    expect(проба.body.total).toBe(0);
    const живая = await request(app()).get("/api/qright/objects/search?q=долголетия");
    expect(живая.body.items.map((x: { id: string }) => x.id)).toEqual(["obj-live"]);
  });

  it("🔴 GET /objects.csv: строк с пробами нет, живая есть", async () => {
    const r = await request(app()).get("/api/qright/objects.csv");
    expect(r.status).toBe(200);
    expect(r.text).toContain("obj-live");
    expect(r.text).not.toContain("smoke-probe-user-99");
    expect(r.text).not.toContain("obj-probe-author");
  });

  it("🔴 GET /objects/:id: проба → 404 как несуществующая, живая → 200 с названием", async () => {
    const проба = await request(app()).get("/api/qright/objects/obj-probe-title");
    expect(проба.status).toBe(404);
    const живая = await request(app()).get("/api/qright/objects/obj-live");
    expect(живая.status).toBe(200);
    expect(JSON.stringify(живая.body)).toContain("Протокол долголетия");
  });

  it("публичная проверка pipeline /verify/:certId тоже закрыта для проб (по исходнику: фильтр стоит до счётчика проверок)", () => {
    const src = readFileSync(join(__dirname, "..", "src", "routes", "pipeline.ts"), "utf8");
    const verify = src.indexOf('pipelineRouter.get("/verify/:certId"');
    const фильтр = src.indexOf("этоНашаПроба({ id: cert.id, title: cert.title, author: cert.authorName })", verify);
    const счётчик = src.indexOf('"verifiedCount" = "verifiedCount" + 1', verify);
    expect(verify).toBeGreaterThan(0);
    expect(фильтр).toBeGreaterThan(verify);
    expect(счётчик).toBeGreaterThan(фильтр);
  });
});
