// Доезжает ли имя автора до карточки ссылки, и не ходим ли мы за этим туда,
// куда ходить не следует.

import { describe, test, expect, afterEach, vi } from "vitest";
import { generateMetadata } from "./layout";

let calls: string[] = [];
function stub(ok: boolean, body: unknown = { name: "Dosymbek", stats: { certificates: 3 } }) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    calls.push(String(u));
    if (!ok) throw new Error("ECONNRESET");
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as typeof fetch);
}
const params = () => Promise.resolve({ slug: "dosymbek" });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("карточка ссылки на автора", () => {
  test("имя автора и число работ доезжают до заголовка и описания", async () => {
    stub(true);
    const m = await generateMetadata({ params: params() });
    expect(String(m.title)).toContain("Dosymbek");
    expect(String(m.description)).toContain("3 registered works");
    expect(String(m.openGraph?.title)).toContain("Dosymbek");
  });

  test("ходит в ручку авторов, а не в ручку проверки", async () => {
    stub(true);
    await generateMetadata({ params: params() });
    expect(calls.some((u) => u.includes("/api/pipeline/authors/"))).toBe(true);
    expect(
      calls.some((u) => /\/api\/pipeline\/verify\//.test(u)),
      "ручка проверки наращивает публичный счётчик — за карточкой туда нельзя",
    ).toBe(false);
  });

  test("спросить не удалось — общая карточка, имени не выдумываем", async () => {
    stub(false);
    const m = await generateMetadata({ params: params() });
    expect(String(m.title)).not.toContain("Dosymbek");
    expect(String(m.title)).toMatch(/AEVION Bureau/);
  });
});
