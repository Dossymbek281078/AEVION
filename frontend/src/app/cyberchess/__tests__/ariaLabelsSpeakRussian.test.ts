import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Подпись для экранного диктора — единственный текст, который слышит
 * незрячий: он не видит иконку, он слышит aria-label. Поэтому «Развернуть
 * AI Voice Coach» и «Сменить layout» для него хуже, чем для зрячего:
 * зрячий догадается по значку, слушающий — нет.
 *
 * Сторож проверяет ТОЛЬКО подписи (aria-label/title), а не весь текст: у
 * видимого текста свой храповик. Значения внутри ${...} вырезаются — это
 * имена переменных, а не слова; без этого проверка даёт 115 «находок»
 * вместо 29 и становится бесполезной.
 */
const KOREN = join(__dirname, "..");
const RAZRESHENO = new Set([
  "ELO", "PGN", "FEN", "AEVION", "CyberChess", "Chessy", "AEV", "CPI",
  "QR", "ID", "AI", "YouTube", "Twitch", "FIDE", "Lichess", "Stockfish",
  "Change", "language", "Ctrl", "Puzzle", "Rush", "Random", "PiP",
]);
const ZAPRESHENO = [
  "Voice Coach", "Сменить layout", "Развернуть PiP", "Coach объяснит",
  "Mirror Mode", "Heatmap", "Custom (", "запретил iframe",
];

function fajly(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "__tests__") continue;
    // картинки для соцсетей вне охвата: там названия возможностей в
    // маркетинговом виде, а экранный диктор их не читает — это изображение
    if (e.startsWith("opengraph-image")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fajly(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}

describe("подписи для экранного диктора говорят по-русски", () => {
  const spisok = fajly(KOREN);

  it("обход нашёл файлы модуля", () => {
    expect(spisok.length).toBeGreaterThan(50);
  });

  it("исправленные подписи не вернулись", () => {
    const vernulis: string[] = [];
    for (const p of spisok) {
      // комментарии разработчику вырезаем: они не звучат для человека,
      // а «AI Voice Coach» в пояснении к коду — не подпись, а название
      // комментарии разработчику вырезаем: они не звучат для человека,
      // а «AI Voice Coach» в пояснении к коду — название, а не подпись
      const syroe = readFileSync(p, "utf8");
      const kod = bezKommentariev(readFileSync(p, "utf8"));
      for (const zapret of ZAPRESHENO) {
        if (kod.includes(zapret)) vernulis.push(`${p}: «${zapret}»`);
      }
    }
    expect(vernulis).toEqual([]);
  });

  it("проверка видит подписи вообще — иначе она пустая", () => {
    const vsego = spisok.reduce(
      (n, p) => n + (readFileSync(p, "utf8").match(/aria-label=/g)?.length ?? 0),
      0,
    );
    expect(vsego).toBeGreaterThan(20);
    expect(RAZRESHENO.size).toBeGreaterThan(10);
  });
});
