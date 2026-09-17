// Отправка решения задачи дня из главной страницы (otpravitDaily): отказ сервера
// (не-2xx) обязан быть показан человеку, а не проглочен.
// До 17.09.2026: `await fetch(...)` без проверки r.ok — 400 wrong_day (вкладка открыта
// через UTC-полночь, 05:00 Алматы), 429 и 5xx проходили молча: человек решил, в таблице
// лидеров его нет, тост был только на обрыв связи. Класс §16 «молчаливый отказ выглядит
// успехом». Сервер шлёт человеческую подсказку (hint) рядом с кодом — её и показываем,
// как уже делает /cyberchess/daily.
// Сторож ИСХОДНИКА (форма); что тост реально появляется — браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const i = src.indexOf("const otpravitDaily=useCallback(");
const block = src.slice(i, i + 1800);

describe("otpravitDaily: отказ сервера показан, а не проглочен", () => {
  it("функция найдена", () => { expect(i).toBeGreaterThan(0); });
  it("ответ fetch сохраняется и проверяется r.ok", () => {
    expect(block).toMatch(/const r=await fetch\("\/api-backend\/api\/cyberchess-daily\/solve"/);
    expect(block).toContain("if(!r.ok){");
  });
  it("при отказе — тост error с подсказкой сервера (hint), код в консоль", () => {
    expect(block).toMatch(/typeof j\?\.hint==="string"&&j\.hint\)podskazka=j\.hint/);
    expect(block).toMatch(/showToast\(`Решение не попало в таблицу лидеров: \$\{podskazka\}`,"error"\)/);
    expect(block).toContain('console.warn("[daily] сервер отказал:"');
  });
  it("прежняя форма «await fetch без ответа» не вернулась", () => {
    expect(block).not.toMatch(/\n\s*await fetch\("\/api-backend\/api\/cyberchess-daily\/solve"/);
  });
  it("тост на обрыв связи (catch) остался", () => {
    expect(block).toContain('showToast("Решение не дошло до таблицы лидеров — проверьте связь","error")');
  });
});
