// Коуч при исчерпанном лимите провайдера не обещает «через минуту»: лимит держится до даты
// сброса. Замер 22–24.09.2026: POST /api/coach/chat → 400 «You have reached your specified API
// usage limits. You will regain access on 2026-10-01». Человеку называется дата и работающая замена.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { лимитПровайдера, когдаВернётся } from "../coachOutage";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("коуч честен про лимит", () => {
  // 🔴 28.09.2026. Здесь стояли ДОСЛОВНЫЕ строки кода страницы. Правило
  // распознавания лимита и расчёт срока переехали в coachOutage.ts — их зовут
  // теперь все три места вызова тренера, а не одно, — и проверки по литералам
  // покраснели на ПОЧИНКЕ, ничего не сказав о поведении.
  //
  // Проверяем то, ради чего сторож заведён: правило работает на настоящем
  // ответе провайдера и не срабатывает на обычном сбое. Устройство (что
  // страница берёт правило из общего файла) — отдельной проверкой.
  it("признак лимита распознаётся по ответу провайдера", () => {
    const real =
      "You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.";
    expect(лимитПровайдера(real)).toBe(true);
    expect(лимитПровайдера("network error")).toBe(false);
  });

  it("дата сброса берётся из ответа и называется по-русски", () => {
    expect(когдаВернётся("regain access on 2026-10-01 at 00:00 UTC")).toContain("1 октября");
    // Нет даты — срок не выдумывается.
    expect(когдаВернётся("You have reached your specified API usage limits.")).toBe("");
  });

  it("страница берёт правило из общего файла, а не заводит своё", () => {
    // Вторая копия правила разошлась бы молча: расхождение видно только там,
    // куда никто не смотрит.
    expect(page).toContain("лимитПровайдера(");
    expect(page).not.toContain("credit balance");
  });


  it("при лимите нет обещания «через минуту», при обычном сбое — есть", () => {
    const i = page.indexOf("const base=лимитИсчерпан");
    const block = page.slice(i, i + 1200);
    expect(block).toContain("Разбор словами сейчас выключен");
    expect(block).toContain('${лимитИсчерпан?"":" Спроси ещё раз через минуту для развёрнутого разбора."}');
    expect(block).toContain('Нажми 🔍 Объясни или 📋 План — они считаются движком и работают.');
  });
  it("ход движка печатается шахматной нотацией тем же механизмом", () => {
    expect(page).toContain("const ходПоРусски=bestSan?hodPoRusski(fen,uciИзSan(fen,bestSan)||\"\"):\"\";");
    expect(page).toContain("const uciИзSan=(fen:string,san:string):string|null=>");
  });
});
