import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 142 (18.10.2026): лёгкая страница задачи после решения показывает короткий разбор на языке страницы.
 * Источник текста — поле razbor у /api/cyberchess-puzzles/:id (ru/en/kk из таблицы PuzzleRazbor); факт о позиции
 * в нём — из позиции, не из модели (сторож генератора). Правила: разбор отдаётся ТОЛЬКО при решении (до него он
 * подсказка), язык — тот же, что у страницы (yazykZaprosa), без разбора страница живёт как раньше, текст рисуется
 * внутри блока статуса (та же ячейка сетки на desktop), а не отдельной строкой сетки.
 */
const ROUTE = readFileSync(join(__dirname, "..", "[id]", "route.ts"), "utf8");
const КЛИЕНТ = readFileSync(join(__dirname, "..", "klientSkript.ts"), "utf8");

describe("разбор после решения на лёгкой странице (142)", () => {
  it("🔴 загрузка задачи берёт razbor рядом с puzzle и не падает без него", () => {
    expect(ROUTE).toContain("razbor?: { ru?: string; en?: string; kk?: string }");
    expect(ROUTE).toContain('razbor: telo?.razbor && typeof telo.razbor === "object" ? telo.razbor : undefined');
  });
  it("🔴 POST отдаёт razbor только при решении и на языке запроса (запасной — en)", () => {
    expect(ROUTE).toContain("const razbor = r.reshena && syraya.razbor ? (syraya.razbor[yazyk] || syraya.razbor.en || undefined) : undefined;");
    expect(ROUTE).toContain('const yazyk = yazykZaprosa(req.headers.get("cookie"), new URL(req.url).searchParams.get("lang"), req.headers.get("accept-language"));');
    expect(ROUTE).toContain("san: r.reshena ? resheniyeSan(pz.fen, pz.sol) : undefined, razbor");
  });
  it("🔴 клиент рисует разбор внутри блока статуса после текста решения; без razbor ничего не добавляет", () => {
    expect(КЛИЕНТ).toContain('if(r.razbor){var rz=document.createElement("div");rz.className="rz";rz.setAttribute("data-cc-razbor","");rz.textContent=r.razbor;st.appendChild(rz)}');
    expect(ROUTE).toContain(".s .rz{font-size:14px;font-weight:500;line-height:1.45;color:#cbd5e1;margin-top:8px}");
  });
});
