import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  siteZone, dnsProvider, dnsConfigured, dnsTokensNeeded, labelInZone,
  upsertCname, zoneActiveUncached, zoneProbe, zoneProbeName,
} from "../src/lib/devhubDns";

/**
 * Адреса сайтов DevHub живут в зоне aevion.app, а её DNS — у Vercel.
 *
 * Решение основателя 15.09.2026. До этого записи писались в зону Cloudflare
 * aevion.build, которой больше нет, и «свой домен» стоял not_available с 28.08.
 * Здесь закреплено: выбор поставщика, метка внутри зоны, три исхода записи
 * (создать / заменить / уже стоит), готовность зоны и имя пробы.
 */

const ENV = ["DEVHUB_DNS_PROVIDER", "DEVHUB_SITE_ZONE", "VERCEL_API_TOKEN", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"];
const было: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  for (const k of ENV) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
  globalThis.fetch = originalFetch;
});

function resp(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function vercelEnv() {
  process.env.DEVHUB_DNS_PROVIDER = "vercel";
  process.env.VERCEL_API_TOKEN = "vcp_test";
}

describe("выбор поставщика DNS", () => {
  test("зона по умолчанию — aevion.app, метка считается от неё", () => {
    expect(siteZone()).toBe("aevion.app");
    expect(labelInZone("shop-abc123.aevion.app")).toBe("shop-abc123");
    expect(labelInZone("aevion.app")).toBe("@");
    expect(labelInZone("myapp.example.com"), "чужой домен — не наша зона").toBeNull();
  });

  test("явная переменная сильнее наличия ключей; иначе Cloudflare при его зоне, Vercel при его токене, ничего без ключей", () => {
    expect(dnsProvider()).toBeNull();
    expect(dnsConfigured()).toBe(false);
    process.env.VERCEL_API_TOKEN = "v";
    expect(dnsProvider()).toBe("vercel");
    process.env.CLOUDFLARE_API_TOKEN = "c"; process.env.CLOUDFLARE_ZONE_ID = "z";
    expect(dnsProvider(), "зона Cloudflare задана — прежний путь не меняется молча").toBe("cloudflare");
    process.env.DEVHUB_DNS_PROVIDER = "vercel";
    expect(dnsProvider()).toBe("vercel");
    expect(dnsTokensNeeded()).toEqual(["VERCEL_API_TOKEN"]);
    expect(zoneProbeName()).toBe("vercel_dns");
  });
});

describe("Vercel: запись CNAME в зоне aevion.app", () => {
  test("контроль прибора: без записей создаётся новая, с меткой ВНУТРИ зоны и целью pages.dev", async () => {
    vercelEnv();
    fetchMock
      .mockResolvedValueOnce(resp(200, { records: [{ id: "r1", name: "api", type: "CNAME", value: "x.railway.app." }] }))
      .mockResolvedValueOnce(resp(200, { uid: "rec-new" }));
    const r = await upsertCname("shop-abc123.aevion.app", "shop-abc123.pages.dev");
    expect(r).toEqual({ ok: true, action: "created", recordId: "rec-new" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v4/domains/aevion.app/records");
    const create = fetchMock.mock.calls[1];
    expect(String(create[0])).toBe("https://api.vercel.com/v2/domains/aevion.app/records");
    expect(create[1].method).toBe("POST");
    expect(JSON.parse(create[1].body)).toMatchObject({ name: "shop-abc123", type: "CNAME", value: "shop-abc123.pages.dev" });
    expect(create[1].headers.Authorization).toBe("Bearer vcp_test");
  });

  test("та же запись уже стоит — ничего не пишем (только чтение)", async () => {
    vercelEnv();
    fetchMock.mockResolvedValueOnce(resp(200, { records: [{ id: "r7", name: "shop-abc123", type: "CNAME", value: "shop-abc123.pages.dev." }] }));
    const r = await upsertCname("shop-abc123.aevion.app", "shop-abc123.pages.dev");
    expect(r).toEqual({ ok: true, action: "already-configured", recordId: "r7" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("запись смотрит не туда — удалить и создать заново", async () => {
    vercelEnv();
    fetchMock
      .mockResolvedValueOnce(resp(200, { records: [{ id: "r7", name: "shop-abc123", type: "CNAME", value: "old.pages.dev" }] }))
      .mockResolvedValueOnce(resp(200, {}))
      .mockResolvedValueOnce(resp(200, { uid: "rec-2" }));
    const r = await upsertCname("shop-abc123.aevion.app", "shop-abc123.pages.dev");
    expect(r).toEqual({ ok: true, action: "updated", recordId: "rec-2" });
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/records/r7");
    expect(fetchMock.mock.calls[2][1].method).toBe("POST");
  });

  test("чужой домен вне зоны — честный отказ без единого вызова", async () => {
    vercelEnv();
    const r = await upsertCname("myapp.example.com", "devhub.aevion.app");
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("отказ Vercel не превращается в успех", async () => {
    vercelEnv();
    fetchMock
      .mockResolvedValueOnce(resp(200, { records: [] }))
      .mockResolvedValueOnce(resp(403, { error: { message: "forbidden" } }));
    const r = await upsertCname("shop-abc123.aevion.app", "shop-abc123.pages.dev");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toMatch(/403/);
  });
});

describe("Vercel: готовность зоны — три исхода", () => {
  test("домен подтверждён и NS совпадают — зона готова, проба ok под именем vercel_dns", async () => {
    vercelEnv();
    fetchMock.mockResolvedValue(resp(200, { domain: { verified: true, nameservers: ["ns1.vercel-dns.com", "ns2.vercel-dns.com"], intendedNameservers: ["ns2.vercel-dns.com", "ns1.vercel-dns.com"] } }));
    expect(await zoneActiveUncached()).toBe(true);
    const p = await zoneProbe();
    expect(p.name).toBe("vercel_dns");
    expect(p.ok).toBe(true);
  });

  test("домен не подтверждён — не готова (false, а не null)", async () => {
    vercelEnv();
    fetchMock.mockResolvedValue(resp(200, { domain: { verified: false, nameservers: [], intendedNameservers: ["ns1.vercel-dns.com"] } }));
    expect(await zoneActiveUncached()).toBe(false);
    expect((await zoneProbe()).ok).toBe(false);
  });

  test("сеть не ответила — «не знаю» (null), а не «нет»", async () => {
    vercelEnv();
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await zoneActiveUncached()).toBeNull();
  });

  test("контроль: у Cloudflare имя пробы и формат прежние", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "c"; process.env.CLOUDFLARE_ZONE_ID = "z";
    fetchMock.mockResolvedValue(resp(200, { result: { status: "pending" } }));
    const p = await zoneProbe();
    expect(p.name).toBe("cloudflare_zone");
    expect(p.ok).toBe(false);
    expect(p.detail).toBe("zone status: pending");
  });
});
