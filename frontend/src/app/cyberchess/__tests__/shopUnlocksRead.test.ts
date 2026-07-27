import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* Самый дорогой товар магазина, «AI Rival» за 100 Chessy, ничего не делал: покупка
   записывала chessy.owned["ai_rival"], и это владение НЕ ЧИТАЛ никто. Деньги списывались,
   поведение не менялось, ошибок не было. Он помечен soon:true и не продаётся, но класс
   дефекта остаётся: разблокировку легко объявить и забыть подключить.

   Признак «подключено» — id встречается где-то ещё, кроме собственного объявления:
   `chessy.owned.master_ai`, `chessy.owned[id]` или `premium:"theme_neon"` на теме доски.
   Товары с soon:true пропускаются: они честно объявлены неработающими и не продаются. */

const DIR = "src/app/cyberchess";
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function sources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__") walk(p);
      } else if (/\.tsx?$/.test(e.name)) {
        out.push(p);
      }
    }
  };
  walk(DIR);
  return out;
}

describe("shop unlocks", () => {
  const all = sources().map((f) => stripComments(readFileSync(f, "utf8")));
  const page = all.find((s) => s.includes("type ShopItem=")) ?? "";

  const unlocks = [...page.matchAll(/\{id:"([^"]+)"[^}]*kind:"unlock"([^}]*)\}/g)]
    .map((m) => ({ id: m[1], soon: /soon:\s*true/.test(m[2]) }))
    .filter((x) => !x.soon);

  it("has unlocks to sell", () => {
    expect(unlocks.length).toBeGreaterThan(3);
  });

  it("reads the ownership it sells", () => {
    const dead: string[] = [];
    for (const u of unlocks) {
      const mentions = all.reduce(
        (n, s) => n + [...s.matchAll(new RegExp(u.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))].length,
        0,
      );
      // одно упоминание = только собственное объявление, читать владение некому
      if (mentions < 2) dead.push(u.id);
    }
    expect(dead).toEqual([]);
  });
});
