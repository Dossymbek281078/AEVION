import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Храповик на английские слова в русском тексте: число не должно РАСТИ.
 *
 * Замер 29.08.2026: 312 мест по модулю, после дневных правок и с белым списком — 282. Это не
 * 290 дефектов: часть — шахматные термины, которые знает любой играющий
 * (endgame, mainline), часть — служебные строки. Но проверка десятка наугад
 * показала, что настоящих среди них много: описания характеров соперников,
 * сообщения при сбое, блок тарифов.
 *
 * ПОЧЕМУ ХРАПОВИК, А НЕ НОЛЬ. Сторож, краснеющий на 290 мест, отключат в
 * первый же день — и защиты не станет вовсе. Храповик держит достигнутое:
 * чинить можно постепенно, а вот добавить новое английское слово в русский
 * текст он не даст.
 *
 * ЕСЛИ СТОРОЖ ПОКРАСНЕЛ: вы добавили английское слово в текст, который читает
 * человек. Либо переведите, либо — если это принятое обозначение вроде ELO —
 * добавьте в БЕЛЫЙ СПИСОК ниже с пояснением, почему человек его поймёт.
 *
 * ЕСЛИ ПОЧИНИЛИ НЕСКОЛЬКО МЕСТ: опустите ПРЕДЕЛ до нового числа, иначе
 * храповик перестанет держать достигнутое.
 */
const PREDEL = 251;

const BELYJ = new Set([
  // Шахматные обозначения: их понимает любой играющий.
  "ELO", "PGN", "FEN",
  // Наши и чужие названия — переводить нечего.
  "AEVION", "CyberChess", "Chessy", "AEV", "AI", "CPI",
  "OBS", "Twitch", "YouTube", "Lichess", "Stockfish",
  // Имена людей в описаниях соперников.
  "Magnus", "Hikaru",
  // Названия тарифов — решение основателя, не язык.
  "Pro", "Free",
  // Технические, но неизбежные в строках.
  "QR", "SVG", "PNG", "URL", "API",
]);

function obojti(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__") obojti(p, acc); }
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

describe("английские слова в русском тексте", () => {
  test(`их не больше ${PREDEL} — храповик держит достигнутое`, () => {
    const najdeno: string[] = [];
    for (const f of obojti(path.join(__dirname, ".."))) {
      const stroki = fs.readFileSync(f, "utf-8").split("\n");
      for (const l of stroki) {
        const st = l.trim();
        if (st.startsWith("//") || st.startsWith("*") || st.startsWith("/*")) continue;
        if (st.startsWith("import") || st.startsWith("export type")) continue;
        for (const m of l.matchAll(/"([^"]{10,140})"/g)) {
          const t = m[1];
          if (!/[а-яА-Я]{4}/.test(t)) continue;
          const slova = t.match(/\b[A-Za-z][A-Za-z-]{3,}\b/g) || [];
          const chuzhoe = slova.find(
            (w) => !BELYJ.has(w) && !["http", "https", "none", "flex", "span", "div"].includes(w.toLowerCase()),
          );
          if (chuzhoe) { najdeno.push(`${path.basename(f)}: ${chuzhoe}`); break; }
        }
      }
    }
    // Нижняя граница — защита от поломки самой проверки: если она вдруг
    // перестанет что-либо находить, зелёный цвет будет означать слепоту.
    expect(najdeno.length, "проверка ослепла — находит подозрительно мало").toBeGreaterThan(100);
    expect(najdeno.length, `стало ${najdeno.length}, предел ${PREDEL}`).toBeLessThanOrEqual(PREDEL);
  });
});
