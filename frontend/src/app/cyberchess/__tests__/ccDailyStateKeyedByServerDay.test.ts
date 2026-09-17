// «Решено сегодня» у задачи дня на главной странице ключуется ДНЁМ СЕРВЕРА (UTC из
// /puzzle), а не местной датой. Разбор 17.09.2026: задача дня сменяется в 00:00 UTC =
// 05:00 Алматы; по местному ключу с 00:00 до 05:00 «сегодня» уже 18-е, а сервер отдаёт
// задачу 17-го. Решив её, человек помечал 18-е решённым, и настоящую задачу 18-го в
// 06:00 награда и отправка в таблицу не принимали — серия на сервере рвалась молча.
// Вторая половина: пока ответ сервера не пришёл, состояние НЕ пишется — иначе местный
// ключ перетирал сохранённое «решено» серверного дня (награда дважды).
// Сторож ИСХОДНИКА (форма). Смена дня на проде — контроль curl 18.09.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const i = src.indexOf("const tk=srvDaily?.day||todayKey();const saved=ldDaily();");
const block = src.slice(Math.max(0, i - 900), i + 400);

describe("состояние задачи дня ключуется днём сервера", () => {
  it("ключ дня = srvDaily.day, местная дата — только запасной вариант", () => {
    expect(i).toBeGreaterThan(0);
    expect(block).not.toContain("const tk=todayKey();const saved=ldDaily();");
  });
  it("до ответа сервера (ни srvDaily, ни отказа) состояние не пишется", () => {
    expect(block).toContain("if(!srvDaily&&!srvDailyFailed)return;");
  });
  it("эффект пересчитывается при приходе дня сервера и при отказе", () => {
    expect(block).toMatch(/\},\[PUZZLES\.length,srvDaily\?\.day,srvDailyFailed\]\);/);
  });
  it("якорь: награда и отправка по-прежнему требуют !dailyState.solved и совпадение fen с серверной задачей", () => {
    expect(src).toContain("if(dailyState&&!dailyState.solved&&srvDaily?.fen===pzCurrent.fen){");
  });
});
