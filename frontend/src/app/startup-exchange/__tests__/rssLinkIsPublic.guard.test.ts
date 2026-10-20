/**
 * Ссылка «RSS этого среза» ведёт на публичный адрес, а не на внутренний Railway.
 *
 * ПОВОД (20.10.2026, осмотр /startup-exchange гостем на проде): ссылка вела на
 * aevion-production-…up.railway.app — apiUrl на сервере даёт адрес для fetch, не для ссылок.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("RSS биржи", () => {
  it("ссылка строится от getBackendOrigin(), не от apiUrl", () => {
    const i = SRC.indexOf("const rssHref");
    expect(i, "построение ссылки RSS не найдено — сторож смотрел бы в пустоту").toBeGreaterThan(0);
    const блок = SRC.slice(i, SRC.indexOf("})();", i));
    expect(блок).toContain("getBackendOrigin()");
    expect(блок).not.toMatch(/apiUrl\(/);
  });

  it("в проде публичный адрес — aevion.app/api-backend (контроль источника)", async () => {
    const прежний = process.env.NODE_ENV;
    const pub = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    (process.env as any).NODE_ENV = "production";
    try {
      const { getBackendOrigin } = await import("@/lib/apiBase");
      expect(getBackendOrigin()).toBe("https://aevion.app/api-backend");
    } finally {
      (process.env as any).NODE_ENV = прежний;
      if (pub !== undefined) process.env.NEXT_PUBLIC_API_BASE_URL = pub;
    }
  });
});
