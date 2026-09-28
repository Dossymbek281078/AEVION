import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Публичная воронка отдаёт ЧИСЛА и ничего больше.
 *
 * Ручка открыта без ключа намеренно: закрытая сводка (/summary под
 * ADMIN_TOKEN) четыре месяца была недоступна ни одному окну, и разговор о
 * воронке шёл мнениями вместо чисел. Плата за открытость — обязанность НЕ
 * отдать ничего личного.
 *
 * Сторож смотрит на то, что кладётся в ответ, а не «вычищается» из него:
 * вычистка на выходе — место, где однажды забывают поле. В накопителе не
 * должно появляться ip, ua, sid и почты вовсе.
 */
const код = readFileSync(join(__dirname, "..", "src", "routes", "events.ts"), "utf8");
const начало = код.indexOf('eventsRouter.get("/funnel"');
const конец = код.indexOf('eventsRouter.get("/aggregate"');
const ручка = код.slice(начало, конец);

describe("публичная воронка не отдаёт личного", () => {
  it("контроль: тело ручки вообще найдено", () => {
    expect(начало).toBeGreaterThan(0);
    expect(ручка.length).toBeGreaterThan(500);
    expect(ручка).toContain("res.json");
  });

  it("в ответ не кладутся ip, ua и почта", () => {
    // Ищем присвоение полей в объект ответа, а не любое упоминание: ev.ua
    // ЧИТАЕТСЯ для отсева роботов, и это законно.
    for (const поле of ["ip:", "ua:", "email:", "sid:"]) {
      expect(ручка.includes(поле), `поле ${поле} не должно попадать в ответ`).toBe(false);
    }
  });

  it("роботы отсеиваются тем же классификатором, что и везде", () => {
    expect(ручка).toContain("видОтправителя(ev.ua)");
  });

  it("пустое хранилище отвечает «не знаю», а не нулями", () => {
    expect(ручка).toContain('known: false');
    expect(ручка).toContain("store_missing");
    expect(ручка).toContain("store_unreadable");
  });

  it("ручка НЕ требует админского ключа — иначе её снова никто не увидит", () => {
    expect(ручка.includes("ADMIN_TOKEN")).toBe(false);
    expect(ручка.includes("x-admin-token")).toBe(false);
  });
});
