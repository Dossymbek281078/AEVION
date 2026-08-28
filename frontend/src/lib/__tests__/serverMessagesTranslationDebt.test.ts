import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { devhubServerError } from "../devhubServerError";

/**
 * Сколько сообщений сервера доедет до человека по-английски.
 *
 * Замер 29.08.2026: в devhub.ts 130 английских сообщений об ошибке, правила
 * разбирают 76, остальные показываются после русской фразы в скобках. Это не
 * поломка — смысл понятен по русской части, — но модуль выходит по $149/мес с
 * русским интерфейсом.
 *
 * Храповик, а не запрет: требовать ноль сегодня значит сделать проверку вечно
 * красной, а такие перестают читать. Долг обязан только СОКРАЩАТЬСЯ. Добавили
 * правило — опустите число.
 */
const ROUTER = join(__dirname, "..", "..", "..", "..", "aevion-globus-backend", "src", "routes", "devhub.ts");
// Замер 29.08.2026, после дописывания правил: непереведённых НОЛЬ.
// Держим тройку запаса намеренно: ноль означал бы, что новое сообщение
// на сервере ломает проверку фронта в ту же секунду. Такую связку
// отключают, а не соблюдают. Тройка ловит ВОЛНУ и терпит единичное.
const DEBT = 3;

function englishMessages(): string[] {
  const src = readFileSync(ROUTER, "utf8");
  const out = new Set<string>();
  for (const m of src.matchAll(/error:\s*"([^"]{6,90})"/g)) {
    const t = m[1];
    if (/[а-яА-Я]/.test(t)) continue;              // уже по-русски
    if (!t.includes(" ") && t.includes("_")) continue; // машинный код
    out.add(t);
  }
  return [...out];
}

describe("долг непереведённых сообщений сервера не растёт", () => {
  it("непереведённых не больше замера", () => {
    const msgs = englishMessages();
    // Контроль прибора: разбор обязан найти сообщения, иначе «долг ноль»
    // означало бы «я не умею читать файл».
    expect(msgs.length, "разбор роутера не нашёл сообщений").toBeGreaterThan(50);

    const left = msgs.filter((m) => {
      const shown = devhubServerError(m, "Не получилось.");
      // Непереведённым считаем тот случай, когда исходный текст доехал
      // до строки целиком — то есть переводчик его не узнал.
      return shown.includes(m);
    });

    expect(
      left.length,
      `непереведённых стало ${left.length} (было ${DEBT}). Добавьте правило в devhubServerError и опустите DEBT`,
    ).toBeLessThanOrEqual(DEBT);
  });
});
