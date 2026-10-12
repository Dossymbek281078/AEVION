import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { denPoMestnomu, vcheraPoMestnomu, ЗОНА_ПЛАТФОРМЫ } from "../src/lib/denPoMestnomu";

/*
 * 🔴 Ключ суток в бэкенде — день по Алматы, а не по UTC.
 *
 * Повод 13.10.2026 (bd → оркестратор): multichatGuestPass.сутки() и ещё ~70 мест
 * писали день через toISOString() — до 05:00 по месту «сегодня» было вчера.
 * Сторож — свип по ВСЕМУ src со знаменателем и путём копии (на машине 100 копий
 * бэкенда — число без пути ничего не значит), плюс поведение помощника.
 */
const КОРЕНЬ = resolve(process.cwd(), "src");

function файлы(dir: string, acc: string[] = []): string[] {
  for (const имя of readdirSync(dir)) {
    const p = join(dir, имя);
    if (statSync(p).isDirectory()) файлы(p, acc);
    else if (/\.ts$/.test(имя)) acc.push(p);
  }
  return acc;
}

describe(`день по Алматы во всём бэкенде (${КОРЕНЬ})`, () => {
  it("🔴 ни одного toISOString().slice(0,10) в исходниках", () => {
    const список = файлы(КОРЕНЬ);
    expect(список.length, "знаменатель: файлов просмотрено").toBeGreaterThan(300);
    const нарушители = список
      .filter((f) => /toISOString\(\)\.slice\(0, ?10\)/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(КОРЕНЬ.length + 1));
    expect(нарушители).toEqual([]);
  });

  it("КОНТРОЛЬ: шаблон свипа ловит обе формы и не ловит помощник", () => {
    const ш = /toISOString\(\)\.slice\(0, ?10\)/;
    expect(ш.test("x.toISOString().slice(0,10)")).toBe(true);
    expect(ш.test("x.toISOString().slice(0, 10)")).toBe(true);
    expect(ш.test("denPoMestnomu(x)")).toBe(false);
  });

  it("🔴 граница суток — полночь по Алматы: 2026-10-12T22:30Z это уже 13-е", () => {
    expect(ЗОНА_ПЛАТФОРМЫ).toBe("Asia/Almaty");
    expect(denPoMestnomu(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
    expect(denPoMestnomu(new Date("2026-10-12T18:59:59Z"))).toBe("2026-10-12");
    // контроль прибора: прежний способ здесь давал вчера
    expect(new Date("2026-10-12T22:30:00Z").toISOString().slice(0, 10)).toBe("2026-10-12");
  });

  it("формат ГГГГ-ММ-ДД с нулями — записанные ключи читаются как раньше", () => {
    expect(denPoMestnomu(new Date("2026-01-05T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(denPoMestnomu(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });

  it("«вчера» — календарный день назад по Алматы, через границу месяца", () => {
    expect(vcheraPoMestnomu(new Date("2026-10-31T20:30:00Z"))).toBe("2026-10-31"); // 01.11 01:30 Алматы → вчера 31.10
    expect(vcheraPoMestnomu(new Date("2026-10-13T12:00:00Z"))).toBe("2026-10-12");
  });

  it("🔴 events.ts больше не складывает ручное смещение Алматы с днём", () => {
    const т = readFileSync(join(КОРЕНЬ, "routes/events.ts"), "utf8");
    expect(т).not.toContain("СМЕЩЕНИЕ_АЛМАТЫ_МС).toISOString()");
    expect(т).toContain("denPoMestnomu(");
  });
});
