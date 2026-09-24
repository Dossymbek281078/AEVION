// Коуч при исчерпанном лимите провайдера не обещает «через минуту»: лимит держится до даты
// сброса. Замер 22–24.09.2026: POST /api/coach/chat → 400 «You have reached your specified API
// usage limits. You will regain access on 2026-10-01». Человеку называется дата и работающая замена.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("коуч честен про лимит", () => {
  it("признак лимита распознаётся по ответу провайдера", () => {
    const re = /usage limit|quota|credit balance|regain access/;
    expect(page).toContain('const лимитИсчерпан=/usage limit|quota|credit balance|regain access/i.test(сообщениеОшибки);');
    // тот же образец, применённый к настоящему ответу провайдера
    const real = "You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.";
    expect(new RegExp(re.source, "i").test(real)).toBe(true);
    expect(new RegExp(re.source, "i").test("network error")).toBe(false); // контроль: обычный сбой не считается лимитом
  });
  it("дата сброса берётся из ответа и называется по-русски", () => {
    expect(page).toContain('const датаВозврата=(сообщениеОшибки.match(/(\\d{4}-\\d{2}-\\d{2})/)||[])[1];');
    expect(page).toContain('return ` — вернётся ${d.getUTCDate()} ${м[d.getUTCMonth()]}`');
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
