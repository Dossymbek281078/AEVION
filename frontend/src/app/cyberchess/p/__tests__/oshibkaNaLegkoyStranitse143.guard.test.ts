import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 143 (18.10.2026): «Нашли ошибку?» на лёгкой странице задачи — кнопка в ряду подсказки (не поверх клеток),
 * форма отдельным блоком той же сетки, отправка прямым запросом на ручку событий с проверкой ответа; при отказе
 * показывается адрес почты, а не вид успеха; авто-поля: fen, id задачи, окно, метка; тексты в трёх языках.
 */
const ROUTE = readFileSync(join(__dirname, "..", "[id]", "route.ts"), "utf8");
const КЛИЕНТ = readFileSync(join(__dirname, "..", "klientSkript.ts"), "utf8");
const СЛОВА = readFileSync(join(__dirname, "..", "pzSlova.ts"), "utf8");

describe("кнопка ошибки на лёгкой странице (143)", () => {
  it("🔴 кнопка в ряду подсказки, форма — отдельный блок сетки после него, в правой колонке широкого окна", () => {
    expect(ROUTE).toContain('<button type="button" class="osh" data-cc-oshibka-btn aria-expanded="false">');
    expect(ROUTE).toContain('<form class="wd of" data-cc-oshibka-form hidden>');
    expect(ROUTE).toContain(".hdr,.z,.s,.hb,.of,.zm,.r,.f{grid-column:2;width:290px}");
    expect(ROUTE).toContain(".hdr,.z,.s,.hb,.of,.zm,.r,.f{width:360px}");
    expect(ROUTE).toContain(".of[hidden]{display:none}");
  });
  it("🔴 отправка прямым запросом с проверкой ответа; отказ — адрес почты; текст 2…2000; авто-поля", () => {
    expect(КЛИЕНТ).toContain('fetch("/api-backend/api/pricing/events",{method:"POST"');
    expect(КЛИЕНТ).toContain('if(!r.ok)throw new Error("status "+r.status)');
    expect(КЛИЕНТ).toContain('a.href="mailto:data@aevion.app"');
    expect(КЛИЕНТ).toContain("if(text.length<2||text.length>2000)return;");
    expect(КЛИЕНТ).toContain('meta:{feature:"oshibka",app:"cyberchess",kontekst:"puzzle",text:text.slice(0,2000),email:em.trim()||undefined,tester:tester,fen:C.fen,puzzleId:C.id,viewport:innerWidth+"x"+innerHeight');
  });
  it("тексты кнопки — восемь ключей в трёх языках", () => {
    for (const k of ["btn", "ask", "email", "tester", "send", "close", "thanks", "failed"]) {
      expect((СЛОВА.match(new RegExp(`"pz\\.oshibka\\.${k}": "`, "g")) || []).length, k).toBe(3);
    }
    expect(ROUTE).toContain('oshThanks: t("pz.oshibka.thanks"), oshFailed: t("pz.oshibka.failed")');
  });
});
