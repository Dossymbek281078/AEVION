import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 28.10.2026 (окно «Продукт», заявка Продаж через Оркестратора). В Shorts ссылки не кликаются —
 * зритель набирает адрес руками, а /go/chess отдавал 404 [Точно curl Оркестратора 28.10].
 * Короткий aevion.app/chess → /cyberchess (308): с ?c= метка сохраняется, без метки — c=yt-typed.
 * Живой замер: curl -sI http://127.0.0.1:3077/chess → 308, Location /cyberchess?c=yt-typed;
 * /chess?c=yt-s1 → Location /cyberchess?c=yt-s1 (dev, 28.10). Мутация: убрать запись с
 * missing → тест 2 красный (проверено 28.10).
 */
const конфиг = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
const блок = конфиг.slice(конфиг.indexOf("async redirects()"), конфиг.indexOf("async rewrites()"));

describe("короткий адрес /chess для Shorts", () => {
  test("в next.config есть redirects() с /chess → /cyberchess, 308", () => {
    expect(блок.length).toBeGreaterThan(50);
    expect(блок).toMatch(/source:\s*"\/chess",\s*destination:\s*"\/cyberchess",\s*permanent:\s*true/);
  });
  test("🔴 без метки ставится c=yt-typed (запись с missing query c)", () => {
    expect(блок).toMatch(/source:\s*"\/chess",\s*missing:\s*\[\{\s*type:\s*"query",\s*key:\s*"c"\s*\}\],\s*destination:\s*"\/cyberchess\?c=yt-typed",\s*permanent:\s*true/);
  });
  test("запись с missing стоит ПЕРВОЙ — иначе общая перехватит и метка не появится", () => {
    expect(блок.indexOf("missing:")).toBeLessThan(блок.indexOf('{ source: "/chess", destination: "/cyberchess"'));
  });
});
