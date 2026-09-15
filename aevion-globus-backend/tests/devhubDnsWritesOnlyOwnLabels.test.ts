/**
 * DevHub пишет в зону aevion.app только СВОИ имена и перезаписывает только СВОИ записи.
 *
 * Найдено окном приёмки 15.09.2026 на проде c5669fb: гость без входа мог записать
 * в проект customDomain "api.aevion.app" и вызвать auto-setup — upsertCname удалял
 * CNAME `api` (весь бэкенд на Railway) и ставил свой. Так же brevo1/2._domainkey
 * (подпись писем). Здесь три чужих имени из записки приёмки, отрицательный
 * контроль на чужую запись с НАШИМ именем, и положительный контроль — наша
 * запись перезаписывается, иначе «DELETE=0» ничего бы не значило.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { upsertCname, zoneWriteRefusal, ownLabelOk, recordIsOurs } from "../src/lib/devhubDns";

const ENV = ["DEVHUB_DNS_PROVIDER", "DEVHUB_SITE_ZONE", "VERCEL_API_TOKEN", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"];
const было: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const k of ENV) { было[k] = process.env[k]; delete process.env[k]; }
  process.env.DEVHUB_DNS_PROVIDER = "vercel";
  process.env.VERCEL_API_TOKEN = "vcp_test";
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
const deletes = () => fetchMock.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === "DELETE").length;

/** Зона, как на проде до любых правок: api → Railway, brevo → подпись писем. */
function prodLikeZone() {
  fetchMock.mockResolvedValue(resp(200, { records: [
    { id: "r-api", name: "api", type: "CNAME", value: "ok6wvjyl.up.railway.app." },
    { id: "r-b1", name: "brevo1._domainkey", type: "CNAME", value: "b1.sendibt2.com." },
    { id: "r-b2", name: "brevo2._domainkey", type: "CNAME", value: "b2.sendibt2.com." },
    { id: "r-shop", name: "shop-abc123", type: "CNAME", value: "shop-abc123.pages.dev." },
    { id: "r-x", name: "docs-0f0f0f", type: "CNAME", value: "ghs.googlehosted.com." },
  ] }));
}

describe("чужие имена зоны — отказ до единого запроса", () => {
  for (const fqdn of ["api.aevion.app", "brevo1._domainkey.aevion.app", "aevion.app", "www.aevion.app", "mail.aevion.app."]) {
    test(`${fqdn} → отказ, DELETE = 0, запросов к Vercel = 0`, async () => {
      prodLikeZone();
      const r = await upsertCname(fqdn, "devhub.aevion.app");
      expect(r.ok).toBe(false);
      expect(deletes()).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });
  }
});

describe("чужая запись с НАШИМ именем — не трогаем", () => {
  test("docs-0f0f0f указывает не на нас → отказ без DELETE", async () => {
    prodLikeZone();
    const r = await upsertCname("docs-0f0f0f.aevion.app", "docs-0f0f0f.pages.dev");
    expect(r.ok).toBe(false);
    expect(String(r.error)).toContain("не наша");
    expect(deletes()).toBe(0);
  });
});

describe("положительный контроль — наше пишем как раньше", () => {
  test("наша запись на pages.dev с новой целью → DELETE 1 + POST 1", async () => {
    fetchMock
      .mockResolvedValueOnce(resp(200, { records: [{ id: "r-shop", name: "shop-abc123", type: "CNAME", value: "shop-abc123.pages.dev." }] }))
      .mockResolvedValueOnce(resp(200, {}))
      .mockResolvedValueOnce(resp(200, { uid: "new" }));
    const r = await upsertCname("shop-abc123.aevion.app", "devhub.aevion.app");
    expect(r.ok).toBe(true);
    expect(deletes()).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  test("новой метке своего формата — просто создаём", async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { records: [] })).mockResolvedValueOnce(resp(200, { uid: "n1" }));
    const r = await upsertCname("blog-1a2b3c.aevion.app", "blog-1a2b3c.pages.dev");
    expect(r.ok).toBe(true);
    expect(deletes()).toBe(0);
  });
});

describe("сами правила", () => {
  test("формат метки", () => {
    expect(ownLabelOk("shop-abc123")).toBe(true);
    expect(ownLabelOk("my-site-0f0f0f")).toBe(true);
    for (const bad of ["api", "@", "brevo1._domainkey", "shop.abc123", "-abc123", "shop-ABC123", "shop-abc12"]) {
      expect(ownLabelOk(bad), bad).toBe(false);
    }
  });
  test("наши цели", () => {
    expect(recordIsOurs("shop-abc123.pages.dev.")).toBe(true);
    expect(recordIsOurs("devhub.aevion.app")).toBe(true);
    expect(recordIsOurs("ok6wvjyl.up.railway.app.")).toBe(false);
    expect(recordIsOurs("b1.sendibt2.com")).toBe(false);
  });
  test("имя вне зоны — не наш вопрос (откажет поставщик), внутри — только формат", () => {
    expect(zoneWriteRefusal("example.com")).toBeNull();
    expect(zoneWriteRefusal("shop-abc123.aevion.app")).toBeNull();
    expect(zoneWriteRefusal("api.aevion.app")).not.toBeNull();
  });
});
