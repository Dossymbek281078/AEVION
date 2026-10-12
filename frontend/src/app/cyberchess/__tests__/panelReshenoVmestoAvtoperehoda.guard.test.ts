import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strokaTsennosti } from "../panelResheno";

/**
 * 🔴 ПРИШЁЛ ПО ССЫЛКЕ НА ЗАДАЧУ — ПОСЛЕ «РЕШЕНО!» НЕТ АВТОПЕРЕХОДА.
 *
 * Замер bd 12.10.2026: после решения человек видит свой мат 1,2 с (задержка
 * rush 550 / learn 1100 / иначе 1200), потом страница сама уходит к следующей
 * задаче. Для пришедшего с ролика — нашего единственного живого входа — это
 * значит, что экран успеха и любое предложение живут секунду. Слово
 * оркестратора: при заходе по ?puzzle= — панель «Решено!» + кнопка «Следующая
 * задача» + одна строка ценности; событие next_clicked даёт долю «взялись за
 * вторую». Rush и другие режимы не трогать.
 */
const СТР = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
const КОД = СТР.split("\n").filter((с) => !/^\s*(\/\/|\*|\/\*)/.test(с)).join("\n");

describe("строка ценности", () => {
  it("🔴 число задач — из живого ответа, без числа — без выдумки", () => {
    // toLocaleString("ru-RU") ставит НЕРАЗРЫВНЫЙ пробел (U+00A0/U+202F) между
    // тысячами — ловушка из §2е: строки выглядят одинаково и не равны. Сравниваем
    // с нормализованным пробелом; само число и порядок слов — предмет проверки.
    const норм = (т: string) => т.replace(/[  ]/g, " ");
    expect(норм(strokaTsennosti(502584))).toBe("Ещё 502 584 задач и ИИ-тренер");
    expect(strokaTsennosti(null)).toBe("Ещё задачи и ИИ-тренер");
    expect(strokaTsennosti(0)).toBe("Ещё задачи и ИИ-тренер");
    expect(strokaTsennosti(Number.NaN)).toBe("Ещё задачи и ИИ-тренер");
    // Ни одного литерала размера банка в тексте: он менялся (500 000 → 502 584).
    expect(strokaTsennosti(null)).not.toMatch(/\d/);
  });
});

describe("панель «Решено!» при заходе по ссылке", () => {
  it("🔴 автопереход выключен ровно для захода по ссылке, rush не тронут", () => {
    expect(КОД).toContain('if(зашёлЗаЗадачей&&pzMode!=="rush")return;');
    // Строка задержки на месте — другие режимы переходят сами, как прежде.
    expect(КОД).toContain('const delay=pzMode==="rush"?550:pzMode==="learn"?1100:1200;');
  });

  it("🔴 панель рисуется только под флагом и после верного решения", () => {
    expect(КОД).toContain('{зашёлЗаЗадачей&&pzAttempt==="correct"&&pzCurrent&&pzMode!=="rush"&&<div data-cc-resheno="1"');
    expect((КОД.match(/data-cc-resheno="1"/g) || []).length, "панель ровно одна").toBe(1);
  });

  it("🔴 кнопка «Следующая задача» шлёт next_clicked и грузит следующую", () => {
    const i = КОД.indexOf('data-cc-resheno="1"');
    const окно = КОД.slice(i, i + 1400);
    expect(окно).toContain('meta:{feature:"next_clicked",app:"cyberchess"}');
    expect(окно).toContain("loadNextPuzzleRef.current();");
    expect(окно).toContain("Следующая задача");
    expect(окно).toContain("{strokaTsennosti(pzTotal)}");
  });

  it("страница зовёт строку ценности из модуля, а не пишет своё число", () => {
    expect(КОД).toContain('import { strokaTsennosti } from "./panelResheno";');
    expect(КОД).not.toMatch(/Ещё 50\d \d{3} задач/);
  });
});
