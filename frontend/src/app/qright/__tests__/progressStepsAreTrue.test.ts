import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Шаги регистрации утверждают действия ПРЯМО СЕЙЧАС — и потому обязаны быть
// правдой строже, чем текст договора: человек видит их при каждой регистрации.
//
// До 21.08.2026 третьим шагом показывалось «Splitting key, anchoring to
// Bitcoin...». Проверено с обеих сторон:
//   хеш SHA-256            — есть;
//   подпись автора Ed25519 — есть (ключ в браузере, сервер её проверяет);
//   подпись платформы      — есть;
//   якорение в биткойне    — НЕТ: код живёт в демонстрационном конвейере,
//                            отключённом на проде (DEMO_DISABLED), обычная
//                            регистрация его не зовёт, отложенных задач нет.
//
// Сторож держит границу: слова о действиях, которых у QRight нет, в шагах
// не появятся. Список сознательно узкий — только однозначные технические
// утверждения, иначе он начнёт краснеть на правде.

const PAGE = readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8");

/** Только тело шагов: в комментариях рядом объясняется, ЧТО убрано и почему. */
function stepLabels(): string[] {
  const m = PAGE.match(/const PROCESSING_STEPS = \[([\s\S]*?)\];/);
  if (!m) throw new Error("PROCESSING_STEPS не найдены");
  return [...m[1].matchAll(/label:\s*"([^"]+)"/g)].map((x) => x[1]);
}

const FORBIDDEN = [
  { word: "Bitcoin", why: "якорения в блокчейне при регистрации нет" },
  { word: "OpenTimestamps", why: "модуль якорения о QRight не знает" },
  { word: "Splitting key", why: "разделения ключа в этом пути нет" },
];

describe("шаги регистрации QRight не утверждают несуществующего", () => {
  test("контроль прибора: шаги найдены и среди них есть правдивые", () => {
    const steps = stepLabels();
    expect(steps.length).toBeGreaterThanOrEqual(3);
    // Если бы разбор смотрел не туда, правдивых слов он бы тоже не увидел.
    expect(steps.join(" ")).toMatch(/SHA-256/);
  });

  for (const { word, why } of FORBIDDEN) {
    test(`шаги не обещают «${word}» — ${why}`, () => {
      for (const label of stepLabels()) {
        expect(label).not.toContain(word);
      }
    });
  }
});
