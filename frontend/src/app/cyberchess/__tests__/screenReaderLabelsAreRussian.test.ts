import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * aria-label и title читает экранный диктор незрячему человеку и показывает
 * браузер при наведении. На русской странице они должны быть по-русски.
 *
 * 28.08.2026 на платформе таких английских подписей нашлось 204 в 70 файлах.
 * В шахматах — пять; одну исправил, четыре остались в файлах, которые ведут
 * чужие ветки.
 *
 * Поэтому здесь ЗАМОК С ХРАПОВИКОМ, а не ноль: сторож не краснеет на том, что
 * мне сейчас нельзя чинить, но не даёт числу расти. Появится новая английская
 * подпись — тест упадёт. Починят старые — уменьшите число, и оно зафиксируется
 * на новом уровне.
 */
const ROOT = path.join(__dirname, "..");

/** Столько английских подписей в модуле на 28.08.2026. Только вниз. */
const ПРЕДЕЛ = 4;

const ПОДПИСЬ = /(title|aria-label)=\{?"([A-Za-z][A-Za-z0-9 ,.$·:%-]{8,60})"/g;

/** Собственные имена и форматы: их не переводят. */
const ИМЕНА = ["Stockfish", "Lichess", "Chessy", "AEVION", "CyberChess", "PGN", "FEN", "ELO", "Puzzle Rush"];

function fajly(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") fajly(p, acc);
    } else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function anglijskie(): string[] {
  const out: string[] = [];
  for (const f of fajly(ROOT)) {
    for (const m of fs.readFileSync(f, "utf8").matchAll(ПОДПИСЬ)) {
      const t = m[2];
      if (ИМЕНА.some((n) => t.includes(n))) continue;
      out.push(`${path.relative(ROOT, f)}: ${t}`);
    }
  }
  return out;
}

describe("подписи для экранного диктора — по-русски", () => {
  it("английских подписей не больше, чем было", () => {
    const najdeno = anglijskie();
    expect(
      najdeno.length,
      `английских aria-label/title стало больше (${najdeno.length} > ${ПРЕДЕЛ}):\n${najdeno.join("\n")}`,
    ).toBeLessThanOrEqual(ПРЕДЕЛ);
  });

  it("замок не декоративный: он действительно что-то считает", () => {
    // Если бы шаблон ничего не находил, первый тест был бы зелёным всегда.
    expect(anglijskie().length, "сторож обязан видеть оставшиеся четыре").toBeGreaterThan(0);
  });
});
