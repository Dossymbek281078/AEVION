/*
 * 🔴 19.10.2026 (очередь оркестратора окну Продукт). Две записи скрыты из ПУБЛИЧНЫХ
 * СПИСКОВ по id, и только из списков:
 *   — демо-запись для адресата письма (имя компании-адресата в title) — светилась в
 *     /api/qright/objects и /api/pipeline/certificates рядом с настоящими записями;
 *   — «Контроль окна Продажи 19.10» — там же.
 * Данные не правятся: title/description/kind/country/city входят в contentHash, правка
 * ломает сертификат. Прямая ссылка /verify/<cert> ОСТАЁТСЯ живой — на неё ведут письма.
 *
 * Вторая половина: ответ POST /protect для НАШЕЙ пробы обязан говорить правду.
 * Замер Продаж 19.10 10:46: POST с ownerName «smoke-test» → success + verifyUrl,
 * GET /verify по нему → 404 (правило 157). Теперь verifyUrl=null и probe=true.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { этоНашаПроба, скрытоИзСписков, СКРЫТЫ_ИЗ_СПИСКОВ } from "../src/lib/publicRegistryProbes";

const СНЯТО_С_ПРОДА_19_10 = [
  { id: "01888e40-d01f-4c3d-bc1e-8be5ccc8ccad", title: "ДЕМО-запись для Восток-Патент: фиксация момента создания", author: "AEVION (демонстрация для партнёра)" },
  { id: "cert-503ab5d6bfc504a7", title: "ДЕМО-запись для Восток-Патент: фиксация момента создания", author: "AEVION (демонстрация для партнёра)" },
  { id: "72fa28ef-f245-4a0e-a64c-d3dee890cd48", title: "Контроль окна Продажи 19.10: обычная запись", author: "AEVION контроль" },
  { id: "cert-c86855ea76141b89", title: "Контроль окна Продажи 19.10: обычная запись", author: "AEVION контроль" },
];
/** Остаются видимыми: демо AEVION из 22 писем и живые авторы. */
const ОСТАЮТСЯ = [
  { id: "cert-463708f3b7f6e156", title: "Демонстрационная запись AEVION: фиксация даты создания", author: "AEVION (демонстрация)" },
  { id: "5bdfe4a3-2f69-4f23-bb05-2656857af1cb", title: "Демонстрационная запись AEVION: фиксация даты создания", author: "AEVION (демонстрация)" },
  { id: "4a28d937-057d-49d5-8e0b-bf2b95e6fc39", title: "Billion way", author: "Dosynbek" },
];

describe("скрытые по id: списки прячут, /verify живёт", () => {
  it("все четыре id с прода скрыты из списков; демо из писем и живые — нет", () => {
    // 19.10 вечер: +4 QuantumShield (демо с именем лида и три пробы Продаж) — итого 8.
    expect(СКРЫТЫ_ИЗ_СПИСКОВ.size).toBe(8);
    for (const id of ["qs-1eb0e72e92724c88", "qs-6e9b0097991fd1d3", "qs-4352e7533b02bd55", "qs-84ea9703c933ae6f"]) expect(скрытоИзСписков(id), id).toBe(true);
    expect(СНЯТО_С_ПРОДА_19_10.filter((з) => !скрытоИзСписков(з.id)), "не скрыты").toEqual([]);
    expect(ОСТАЮТСЯ.filter((з) => скрытоИзСписков(з.id)), "скрыты лишние").toEqual([]);
    expect(скрытоИзСписков(undefined)).toBe(false);
  });

  it("скрытые по id НЕ считаются пробами — иначе /verify по ссылке из письма отдал бы 404", () => {
    expect(СНЯТО_С_ПРОДА_19_10.filter((з) => этоНашаПроба(з)), "сочтены пробами").toEqual([]);
  });

  it("маршрут /verify/:certId решает только по этоНашаПроба, а не по списку скрытых", () => {
    const src = readFileSync(join(__dirname, "..", "src", "routes", "pipeline.ts"), "utf8");
    const от = src.indexOf('pipelineRouter.get("/verify/:certId"');
    const до = src.indexOf("pipelineRouter.", от + 10);
    const блок = src.slice(от, до);
    expect(от).toBeGreaterThan(0);
    expect(блок).toContain("этоНашаПроба(");
    expect(блок).not.toContain("скрытоИзСписков(");
    // а список и выгрузка — зовут обе проверки
    expect(src.match(/!этоНашаПроба\([^)]*\) && !скрытоИзСписков\(/g)?.length ?? 0).toBe(2);
  });

  it("ответ POST /protect для нашей пробы: verifyUrl null и probe true (по исходнику)", () => {
    const src = readFileSync(join(__dirname, "..", "src", "routes", "pipeline.ts"), "utf8");
    expect(src).toContain("const этоПроба = этоНашаПроба({ id: certId, title, author: authorName });");
    expect(src).toContain("verifyUrl: этоПроба ? null : `https://aevion.app/verify/${certId}`,");
    expect(src).toContain("probe: этоПроба,");
    expect(src).toMatch(/message: этоПроба\s*\?\s*"Protected as OUR PROBE/);
  });
});

/* ── Живой маршрут QRight с подменённой базой: список/поиск/CSV прячут, /objects/:id отдаёт ── */
const ЖИВАЯ = { id: "obj-live", title: "Протокол долголетия: методика", kind: "text", contentHash: "a".repeat(64), ownerName: "Иван", country: "KZ", city: "Almaty", createdAt: new Date("2026-10-01T00:00:00Z"), revokedAt: null };
const СКРЫТАЯ = { ...ЖИВАЯ, id: "01888e40-d01f-4c3d-bc1e-8be5ccc8ccad", title: "ДЕМО-запись для Восток-Патент", ownerName: "AEVION (демонстрация для партнёра)" };
const ВСЕ = [ЖИВАЯ, СКРЫТАЯ];

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      if (!s.includes("QRightObject") || !s.trim().startsWith("SELECT")) return { rows: [], rowCount: 0 };
      if (s.includes('"id" = $1')) {
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

describe("QRight: скрытая по id запись", () => {
  it("🔴 GET /objects: живая есть, скрытой нет, total = показанным (знаменатель 2 → 1)", async () => {
    const r = await request(app()).get("/api/qright/objects");
    expect(r.status).toBe(200);
    const ids = (r.body.items as { id: string }[]).map((x) => x.id);
    expect(ids).toEqual(["obj-live"]);
    expect(r.body.total).toBe(1);
  });
  it("🔴 GET /objects/search по слову из скрытой → 0, по живой → 1", async () => {
    const с = await request(app()).get("/api/qright/objects/search?q=Восток");
    expect(с.body.items).toEqual([]);
    const ж = await request(app()).get("/api/qright/objects/search?q=долголетия");
    expect(ж.body.items.map((x: { id: string }) => x.id)).toEqual(["obj-live"]);
  });
  it("🔴 GET /objects.csv: скрытой нет, живая есть", async () => {
    const r = await request(app()).get("/api/qright/objects.csv");
    expect(r.status).toBe(200);
    expect(r.text).toContain("obj-live");
    expect(r.text).not.toContain("Восток");
  });
  it("🔴 GET /objects/:id: скрытая по id ОТДАЁТСЯ (200) — прямая ссылка живёт", async () => {
    const r = await request(app()).get("/api/qright/objects/01888e40-d01f-4c3d-bc1e-8be5ccc8ccad");
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).toContain("Восток");
  });
});
