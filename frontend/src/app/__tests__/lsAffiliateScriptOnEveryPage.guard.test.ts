import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LS_AFFILIATE_SCRIPT, LS_STORE_SLUG } from "@/lib/lsAffiliate";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

/**
 * 30.10.2026: процент партнёру Lemon Squeezy засчитывается только при их скрипте
 * на сайте; 25 писем партнёрам ведут на /pricing. Без скрипта деньги партнёрам
 * не засчитаются молча.
 */
describe("партнёрский скрипт Lemon Squeezy стоит на всех страницах", () => {
  it("константы указывают на магазин aevion и официальный скрипт", () => {
    expect(LS_STORE_SLUG).toBe("aevion");
    expect(LS_AFFILIATE_SCRIPT).toBe("https://lmsqueezy.com/affiliate.js");
    expect(LS_AFFILIATE_SCRIPT).toContain("lmsqueezy.com/affiliate.js");
  });

  it("корневой layout.tsx подключает конфиг и скрипт", () => {
    const l = read("app", "layout.tsx");
    expect(l).toContain("lemonSqueezyAffiliateConfig");
    expect(l).toMatch(/store:\s*\$\{JSON\.stringify\(LS_STORE_SLUG\)\}/);
    expect(l).toMatch(/<script src=\{LS_AFFILIATE_SCRIPT\} defer crossOrigin="anonymous" \/>/); // 30.10.2026: без crossOrigin COEP require-corp блокирует скрипт (прод 043aa4cc7)
  });

  it("страница цен оборачивает адрес кассы", () => {
    expect(read("app", "pricing", "page.tsx")).toContain("сКассойПартнёра(withChannel(");
  });
});
