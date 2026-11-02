import { describe, it, expect, vi, afterEach } from "vitest";
import { startupxApi } from "../lib";
import { sx } from "../sxText";

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const f = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { listings: [], total: 0 } }), { status: 200 }));
  vi.stubGlobal("fetch", f);
  return f;
}
const urls = (f: ReturnType<typeof stubFetch>) => f.mock.calls.map((c) => String((c as unknown[])[0]));

describe("язык страницы доходит до ленты и карточки", () => {
  it("list и get с en несут lang=en", async () => {
    const f = stubFetch();
    await startupxApi.list({ limit: 10, offset: 0, lang: "en" });
    await startupxApi.get(21, "en");
    expect(urls(f)[0]).toContain("lang=en");
    expect(urls(f)[1]).toMatch(/\/ideas\/21\?lang=en$/);
  });
  it("на ru lang не передаётся", async () => {
    const f = stubFetch();
    await startupxApi.list({ limit: 10, offset: 0, lang: "ru" });
    await startupxApi.get(21, "ru");
    expect(urls(f)[0]).not.toContain("lang=");
    expect(urls(f)[1]).not.toContain("lang=");
  });
  it("пометка есть на en и русская на ru", () => {
    expect(sx("en", "Переведено AEVION")).toBe("Translated by AEVION");
    expect(sx("ru", "Переведено AEVION")).toBe("Переведено AEVION");
  });
});
