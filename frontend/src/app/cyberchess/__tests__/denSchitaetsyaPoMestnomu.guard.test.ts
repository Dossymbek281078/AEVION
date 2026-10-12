import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { denPoMestnomu, vcheraPoMestnomu } from "../denPoMestnomu";

/*
 * 🔴 День человека считается по его часам, а не по UTC.
 *
 * Повод 13.10.2026 (bd, прод c17379338): lastDay серии входов записывался
 * через toISOString() — до 05:00 по месту это вчерашний день, серия росла
 * дважды за сутки. Класс, а не случай: 9 мест на странице + вопрос дня
 * тренера. Сторож — свип по всем исходникам шахмат со знаменателем, плюс
 * поведение помощника.
 */
const КОРЕНЬ = join(process.cwd(), "src/app/cyberchess");

function файлы(dir: string, acc: string[] = []): string[] {
  for (const имя of readdirSync(dir)) {
    const p = join(dir, имя);
    if (имя === "__tests__" || имя === "node_modules") continue;
    if (statSync(p).isDirectory()) файлы(p, acc);
    else if (/\.(ts|tsx)$/.test(имя)) acc.push(p);
  }
  return acc;
}

describe("день по местному времени", () => {
  it("🔴 в исходниках шахмат нет ни одного UTC-дня через toISOString().slice(0,10)", () => {
    const список = файлы(КОРЕНЬ);
    expect(список.length, "знаменатель: исходников просмотрено").toBeGreaterThan(50);
    const нарушители: string[] = [];
    for (const f of список) {
      const т = readFileSync(f, "utf8");
      if (/toISOString\(\)\.slice\(0, ?10\)/.test(т)) нарушители.push(f.slice(КОРЕНЬ.length + 1));
    }
    expect(нарушители, "UTC-день в исходниках").toEqual([]);
  });

  it("КОНТРОЛЬ: сам шаблон свипа находит нарушителя в выдуманном тексте", () => {
    expect(/toISOString\(\)\.slice\(0, ?10\)/.test("const t=new Date().toISOString().slice(0,10);")).toBe(true);
    expect(/toISOString\(\)\.slice\(0, ?10\)/.test("const t=new Date().toISOString().slice(0, 10);")).toBe(true);
    expect(/toISOString\(\)\.slice\(0, ?10\)/.test("denPoMestnomu()")).toBe(false);
  });

  it("формат совпадает с прежним ГГГГ-ММ-ДД с нулями — сохранённые ключи читаются", () => {
    expect(denPoMestnomu(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
    expect(denPoMestnomu(new Date(2026, 9, 13, 0, 30))).toBe("2026-10-13");
  });

  it("🔴 сразу после местной полуночи — уже новый день (там, где toISOString ещё даёт вчера)", () => {
    const d = new Date(2026, 9, 13, 0, 30); // 00:30 по месту
    expect(denPoMestnomu(d)).toBe("2026-10-13");
    // Контроль прибора: в поясе восточнее UTC прежний способ здесь врёт; в UTC он совпадает —
    // тогда это сравнение ничего не доказывает, и об этом сказано честно.
    const utc = d.toISOString().slice(0, 10);
    if (d.getTimezoneOffset() < 0) expect(utc).toBe("2026-10-12");
  });

  it("«вчера» — календарный день назад по месту, включая границу месяца", () => {
    expect(vcheraPoMestnomu(new Date(2026, 10, 1, 0, 10))).toBe("2026-10-31");
    expect(vcheraPoMestnomu(new Date(2026, 9, 13, 23, 59))).toBe("2026-10-12");
  });
});
