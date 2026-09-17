// Конец матча с человеком (POST /matchmaking/match/:id/end): отказ сервера и обрыв связи
// обязаны быть показаны игроку — это ЕДИНСТВЕННЫЙ путь записи результата и рейтинга.
// До 17.09.2026: `.then(r=>r.json()).then(data=>{ if(!data?.ratingDelta) return; })` и
// `.catch(()=>{})` — 404/403/400/409 читались как «данные без ratingDelta», обрыв — в
// никуда. Рейтинг не записан, игрок не узнаёт. Класс §16 «молчаливый отказ выглядит успехом».
// Законное молчание остаётся: ok без ratingDelta (матч уже закрыт другой стороной / без БД).
// Сторож ИСХОДНИКА (форма); что тост реально появляется — браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const i = src.indexOf("fetch(`/api-backend/api/cyberchess/matchmaking/match/${matchmakingId}/end`");
const block = src.slice(i, i + 2200);

describe("конец матча: отказ сервера и обрыв связи показаны игроку", () => {
  it("вызов найден и он один", () => {
    expect(i).toBeGreaterThan(0);
    // от i+120, чтобы не найти ТО ЖЕ вхождение (подстрока начинается на ~40 знаков позже i)
    expect(src.indexOf("matchmaking/match/${matchmakingId}/end", i + 120)).toBe(-1);
  });
  it("не-2xx → тост error с hint сервера, код в консоль, дальше не идём", () => {
    expect(block).toContain("if(!r.ok){");
    expect(block).toContain('console.warn("[matchmaking/end] сервер отказал:"');
    expect(block).toMatch(/showToast\(`Результат матча не записан: \$\{j\?\.hint\|\|j\?\.error\|\|`ошибка \$\{r\.status\}`\}`,"error"\)/);
  });
  it("обрыв связи → тост, а не пустой catch", () => {
    expect(block).toContain('showToast("Результат матча не дошёл до сервера — проверьте связь","error")');
    expect(block).not.toMatch(/\}\)\.catch\(\(\)=>\{\}\);\s*\n\s*\},\[over,matchmakingId,pCol\]\)/);
  });
  it("законное молчание осталось: ok без ratingDelta — тихо", () => {
    expect(block).toMatch(/if\(!rd\)return; \/\/ ok без ratingDelta/);
  });
  it("прежняя форма «r.json() без проверки ok» не вернулась", () => {
    expect(block).not.toContain("}).then(r=>r.json()).then(data=>{");
  });
});
