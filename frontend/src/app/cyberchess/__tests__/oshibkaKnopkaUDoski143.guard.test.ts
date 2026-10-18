import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sobytieOshibki, tekstOshibkiGoden, ОШИБКА_ТЕКСТ_МАКС, ОШИБКА_АДРЕС } from "../OshibkaForma";

/*
 * 🔴 143 (18.10.2026): «Нашли ошибку?» у доски (заказ Продаж, слово оркестратора). Правила: кнопка — в ряду под
 * доской (и в ряду масштаба в панели на низком desktop), не поверх клеток; форма раскрывается строкой ниже
 * (ряд переносится); отчёт идёт тем же путём, что отзыв 16.10 — событие feature_use через /api/pricing/events,
 * но прямым fetch с проверкой ответа; при отказе показывается адрес data@, а не вид успеха; текст 2…2000;
 * авто-поля: fen, id задачи, окно, метка, страница; тексты из словаря в трёх языках.
 */
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const FORMA = readFileSync(join(__dirname, "..", "OshibkaForma.tsx"), "utf8");
const I18N = readFileSync(join(__dirname, "..", "i18n.ts"), "utf8");

describe("«Нашли ошибку?» у доски (143)", () => {
  it("🔴 кнопка стоит в ряду под доской после палитры и в ряду масштаба в панели; ряд переносится", () => {
    expect(PAGE).toContain('<OshibkaForma dannye={dannyeOshibki} t={cc.t} cc={CC} width="100%"/>\n          </div>}');
    expect(PAGE).toContain('{рядМасштабаВПанели&&<div data-cc-masshtab-v-paneli="1" style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",justifyContent:"flex-end",padding:"6px 8px 2px",flexShrink:0}}><OshibkaForma');
    expect(PAGE).toContain('paddingLeft:обвязкаДоскиPx+3,width:bw,gap:4,flexWrap:PERENOS_RYADA}}>');
    expect(PAGE).toContain("puzzleId:pzCurrent?.id??null");
    // кнопки нет внутри доски: между data-cc-board и концом клеток её быть не должно
    const доска = PAGE.indexOf('data-cc-board="1"');
    expect(PAGE.slice(доска, доска + 6000)).not.toContain("OshibkaForma");
  });
  it("🔴 отчёт — событие с признаком ошибки и авто-полями; текст 2…2000", () => {
    expect(tekstOshibkiGoden(" ")).toBe(false);
    expect(tekstOshibkiGoden("ок")).toBe(true);
    expect(tekstOshibkiGoden("я".repeat(ОШИБКА_ТЕКСТ_МАКС + 1))).toBe(false);
    const e = sobytieOshibki({ fen: "8/8/8/8/8/8/8/K6k w - - 0 1", puzzleId: "li_075iw", kontekst: "puzzle" }, "  доска зависла ", "a@b.co", true, "s_1") as { type: string; source: string; meta: Record<string, unknown> };
    expect(e.type).toBe("feature_use");
    expect(e.source).toBe("cyberchess/board");
    expect(e.meta).toMatchObject({ feature: "oshibka", app: "cyberchess", kontekst: "puzzle", text: "доска зависла", email: "a@b.co", tester: true, fen: "8/8/8/8/8/8/8/K6k w - - 0 1", puzzleId: "li_075iw" });
  });
  it("🔴 отправка — прямым запросом с проверкой ответа; отказ показывает адрес почты, а не успех", () => {
    expect(FORMA).toContain('const r = await fetch(apiUrl("/api/pricing/events")');
    expect(FORMA).toContain('sState(r.ok ? "sent" : "failed");');
    expect(FORMA).toContain('} catch { sState("failed"); }');
    expect(FORMA).toContain('data-cc-oshibka-state="failed"');
    expect(FORMA).toContain("href={`mailto:${ОШИБКА_АДРЕС}`}");
    expect(ОШИБКА_АДРЕС).toBe("data@aevion.app");
    expect(FORMA).toContain('data-cc-oshibka-btn="1"');
    expect(FORMA).toContain('data-cc-oshibka-form="1"');
  });
  it("словарь: восемь ключей кнопки в трёх языках", () => {
    for (const k of ["btn", "ask", "email", "tester", "send", "close", "thanks", "failed"]) {
      expect((I18N.match(new RegExp(`"oshibka\\.${k}": "`, "g")) || []).length, k).toBe(3);
    }
  });
});
