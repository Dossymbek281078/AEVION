// 🔴 16.10.2026: отзыв одной строкой после результата (задача решена / партия окончена).
// Повод: к 20.10 нужны ≥ 3 отзыва живых игроков, а пути оставить отзыв в шахматах не было.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OtzyvPosleRezultata, sobytieOtzyva, tekstOtzyvaGoden, ОТЗЫВ_МАКС } from "../OtzyvPosleRezultata";
import { tFor } from "../i18n";

const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("отзыв после результата", () => {
  it("🔴 тело события — то, что воронка сложит в cyberchess/board|otzyv, текст обрезан до предела сервера", () => {
    const e = sobytieOtzyva("puzzle", "  Классно, но подсказка дорогая  ");
    expect(e).toEqual({ type: "feature_use", source: "cyberchess/board", meta: { feature: "otzyv", app: "cyberchess", kontekst: "puzzle", text: "Классно, но подсказка дорогая" } });
    const длинный = "х".repeat(ОТЗЫВ_МАКС + 50);
    expect(String(sobytieOtzyva("game", длинный).meta!.text).length).toBe(ОТЗЫВ_МАКС);
    expect(ОТЗЫВ_МАКС).toBe(200); // предел строки meta на сервере (events.ts: v.slice(0, 200))
  });

  it("годность текста: пусто и один знак — нет; 2..200 — да; пробелы не считаются", () => {
    expect(tekstOtzyvaGoden("")).toBe(false);
    expect(tekstOtzyvaGoden(" а ")).toBe(false);
    expect(tekstOtzyvaGoden("ок")).toBe(true);
    expect(tekstOtzyvaGoden("х".repeat(200))).toBe(true);
    expect(tekstOtzyvaGoden("х".repeat(201))).toBe(false);
  });

  it("разметка: форма с полем и кнопкой на языке гостя, кнопка выключена до годного текста", () => {
    const html = renderToStaticMarkup(<OtzyvPosleRezultata kontekst="puzzle" t={(k) => tFor("en", k)} otpravit={(() => undefined) as never} />);
    expect(html).toContain('data-cc-otzyv="puzzle"');
    expect(html).toContain('placeholder="How was it? One-line review"');
    expect(html).toContain("disabled");
    expect(/[а-яА-ЯёЁ]/.test(html), "en без кириллицы").toBe(false);
  });

  it("🔴 форма не отдаёт pointerdown доске (иначе поле на плашке после партии не фокусируется)", () => {
    const src = readFileSync(join(process.cwd(), "src/app/cyberchess/OtzyvPosleRezultata.tsx"), "utf8");
    const i = src.indexOf("<form data-cc-otzyv={kontekst}");
    expect(src.slice(i, src.indexOf(">", src.indexOf("style=", i)))).toContain("onPointerDown={(e) => e.stopPropagation()}");
  });

  it("ключи pz.otzyv.* есть во всех трёх языках", () => {
    for (const k of ["pz.otzyv.ask", "pz.otzyv.send", "pz.otzyv.thanks"]) {
      for (const loc of ["ru", "en", "kk"] as const) expect(tFor(loc, k), `${loc}:${k}`).not.toBe(k);
    }
  });

  it("🔴 страница ставит поле после результата: панель «Решено!», плашка после партии, окно «Итог партии»", () => {
    expect(СТРАНИЦА.split('<OtzyvPosleRezultata kontekst="puzzle" t={cc.t} otpravit={track} onSent={показатьПодпискуПослеОтзыва}/>').length - 1).toBe(1);
    // партия: плашка на доске (там человек оказывается сразу) и окно «Итог партии» (по кнопке)
    expect(СТРАНИЦА.split('<OtzyvPosleRezultata kontekst="game" t={cc.t} otpravit={track} tyomnyy onSent={показатьПодпискуПослеОтзыва}/>').length - 1).toBe(2);
    const k = СТРАНИЦА.indexOf("📊 Разобрать партию");
    expect(СТРАНИЦА.slice(k - 900, k)).toContain('<OtzyvPosleRezultata kontekst="game"');
    const i = СТРАНИЦА.indexOf('data-cc-resheno="1"');
    expect(СТРАНИЦА.slice(i, i + 2500)).toContain('<OtzyvPosleRezultata kontekst="puzzle"');
    const j = СТРАНИЦА.indexOf('aria-label="Итог партии"');
    expect(СТРАНИЦА.slice(j)).toContain('<OtzyvPosleRezultata kontekst="game"');
  });
});
