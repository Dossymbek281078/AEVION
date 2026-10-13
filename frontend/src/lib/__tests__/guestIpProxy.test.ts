/*
 * Действия с бесплатной нормой идут на бэкенд с адресом гостя и секретом.
 * Замер прода 13.10.2026 (окно Приложения-31.12): через rewrite бэкенд видел
 * всех гостей под адресом Vercel, а заголовки из middleware не доходили.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { заголовкиДляБэкенда, проксироватьСАдресом } from "../guestIpProxy";

const СЕКРЕТ = "s".repeat(32);

describe("заголовкиДляБэкенда", () => {
  it("кладёт первый адрес X-Forwarded-For и секрет", () => {
    const h = заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "178.91.246.196, 10.0.0.1" }), СЕКРЕТ)!;
    expect(h.get("x-aevion-client-ip")).toBe("178.91.246.196");
    expect(h.get("x-aevion-edge-key")).toBe(СЕКРЕТ);
  });

  it("поддельные заголовки гостя затираются", () => {
    const h = заголовкиДляБэкенда(
      new Headers({ "x-forwarded-for": "178.91.246.196", "x-aevion-client-ip": "6.6.6.6", "x-aevion-edge-key": "forged-key" }),
      СЕКРЕТ,
    )!;
    expect(h.get("x-aevion-client-ip")).toBe("178.91.246.196");
    expect(h.get("x-aevion-edge-key")).toBe(СЕКРЕТ);
  });

  it("без адреса гостя секрет не уходит, а подделка всё равно стёрта", () => {
    const h = заголовкиДляБэкенда(new Headers({ "x-aevion-client-ip": "6.6.6.6" }), СЕКРЕТ)!;
    expect(h.get("x-aevion-client-ip")).toBeNull();
    expect(h.get("x-aevion-edge-key")).toBeNull();
  });

  it("секрет с BOM и переводом строки очищается; не-ASCII — механизм спит, а не роняет запрос", () => {
    // Замер прода 13.10.2026: секрет с BOM ронял Headers.set — три действия отвечали 500.
    const h = заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "1.2.3.4" }), "\uFEFF" + СЕКРЕТ + "\n")!;
    expect(h.get("x-aevion-edge-key")).toBe(СЕКРЕТ);
    expect(заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "1.2.3.4" }), "ключ".repeat(8))).toBeNull();
  });

  it("КОНТРОЛЬ: без секрета ничего не добавляет", () => {
    expect(заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "1.2.3.4" }), undefined)).toBeNull();
    expect(заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "1.2.3.4" }), "short")).toBeNull();
  });
});

describe("проксироватьСАдресом", () => {
  const старые = { t: process.env.BACKEND_PROXY_TARGET, k: process.env.AEVION_EDGE_KEY };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.BACKEND_PROXY_TARGET = старые.t;
    process.env.AEVION_EDGE_KEY = старые.k;
  });

  it("запрос уходит на бэкенд с телом, адресом гостя и без host; ответ 402 возвращается как есть", async () => {
    process.env.BACKEND_PROXY_TARGET = "https://api.example.test/";
    process.env.AEVION_EDGE_KEY = СЕКРЕТ;
    const вызов = vi.fn(async () => Response.json({ error: "free_quota_exceeded" }, { status: 402 }));
    vi.stubGlobal("fetch", вызов);
    const req = new Request("https://aevion.app/api-backend/api/healthai/check?c=probe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "95.56.2.2", host: "aevion.app", authorization: "Bearer t" },
      body: JSON.stringify({ symptoms: ["a"] }),
    });
    const r = await проксироватьСАдресом(req, "/api/healthai/check");
    expect(r.status).toBe(402);
    expect((await r.json()).error).toBe("free_quota_exceeded");
    const [адрес, опции] = вызов.mock.calls[0] as unknown as [string, RequestInit];
    expect(адрес).toBe("https://api.example.test/api/healthai/check?c=probe");
    const h = new Headers(опции.headers);
    expect(h.get("x-aevion-client-ip")).toBe("95.56.2.2");
    expect(h.get("x-aevion-edge-key")).toBe(СЕКРЕТ);
    expect(h.get("authorization")).toBe("Bearer t");
    expect(h.get("host")).toBeNull();
    expect(new TextDecoder().decode(опции.body as ArrayBuffer)).toContain("symptoms");
  });

  it("КОНТРОЛЬ: бэкенд недоступен — 502, а не исключение", async () => {
    process.env.BACKEND_PROXY_TARGET = "https://api.example.test";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const r = await проксироватьСАдресом(new Request("https://aevion.app/x", { method: "POST", body: "{}" }), "/api/healthai/check");
    expect(r.status).toBe(502);
  });
});


describe("обработчики стоят ровно на трёх включённых действиях", () => {
  const app = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app", "api-backend", "api");
  for (const путь of ["healthai/check", "bureau/verify/start", "qventure/analyze"]) {
    it(путь, () => {
      const файл = join(app, путь, "route.ts");
      expect(existsSync(файл), файл).toBe(true);
      expect(readFileSync(файл, "utf8")).toContain(`проксироватьСАдресом(req, "/api/${путь}")`);
    });
  }
});
