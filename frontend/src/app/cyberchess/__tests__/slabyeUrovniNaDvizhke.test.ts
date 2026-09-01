import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🔴 Замер 01.09.2026 на собранной версии, уровень «Клубный» (он же по
 * умолчанию): человек ждал фигуру соперника
 *
 *     3.9 · 6.5 · 8.5 · 19.9 · 28.9 секунды
 *
 * Профиль главного потока назвал причину: 16.6 секунды длинных задач за три
 * хода, одна на 7.75 с; наша функция держит ~70% потока, под ней генерация
 * ходов chess.js. Ход соперника на уровнях ниже 1600 считался ПЕРЕБОРОМ НА
 * ГЛАВНОМ ПОТОКЕ, то есть блокировал весь интерфейс.
 *
 * Движок умеет играть слабо сам, и делает это на порядки быстрее:
 *   сила 0, глубина 5 → 258 мс      сила 6, глубина 6 → 224 мс
 *
 * Здесь закрепляется, что слабые уровни считает движок, а перебор остался
 * только запасным путём.
 */

const KOD = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("слабые уровни считает движок, а не главный поток", () => {
  it("сила и глубина заданы для ВСЕХ семи уровней", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан
    for (const i of [0, 1, 2, 3, 4, 5, 6]) {
      expect(s).toMatch(new RegExp("SF_SILA[^;]*" + i + ":"));
      expect(s).toMatch(new RegExp("SF_GLUBINA[^;]*" + i + ":"));
    }
  });

  it("сила растёт вместе с уровнем", () => {
    const s = KOD();
    const vytashchit = (imya: string) => {
      const i = s.indexOf("const " + imya);
      const telo = s.slice(s.indexOf("{", i), s.indexOf("}", i));
      return telo.split(",").map((p) => Number(p.split(":")[1]));
    };
    const sila = vytashchit("SF_SILA");
    const glub = vytashchit("SF_GLUBINA");
    expect(sila).toHaveLength(7);
    for (let i = 1; i < sila.length; i++) {
      expect(sila[i]).toBeGreaterThan(sila[i - 1]);
      expect(glub[i]).toBeGreaterThan(glub[i - 1]);
    }
    // Слабейший уровень должен быть ДЕЙСТВИТЕЛЬНО слабым, сильнейший — полным.
    expect(sila[0]).toBe(0);
    expect(sila[6]).toBe(20);
  });

  it("ход соперника идёт через движок, если он поднялся", () => {
    const s = KOD();
    expect(s).toContain("if(sfR.current?.ready()){");
    expect(s).toContain("},undefined,true,SF_SILA[aiI]??6);");
  });

  it("перебор на главном потоке остался ЗАПАСНЫМ путём, а не удалён", () => {
    // Если движок не поднялся, медленный соперник лучше, чем никакого.
    const s = KOD();
    expect(s).toContain("const c=new Chess(fenAtTrigger);const b=best(c,lv.depth,lv.rand);");
  });

  it("сила задаётся ЗАПРОСОМ, а не один раз при старте", () => {
    // Иначе разбор партии считался бы в силу слабого соперника.
    const s = KOD();
    expect(s).toContain("`setoption name Skill Level value ${sila}`");
    expect(s).toContain("srochno=false,sila=20){");
  });
});
