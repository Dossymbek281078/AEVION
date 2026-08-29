import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Один сетевой запрос за счётчиком экономии — один источник в коде.
//
// `lib/aiSavings.ts` разделяет in-flight запрос между всеми потребителями
// страницы, но помогает это ровно настолько, насколько все через него ходят.
// На 27.07.2026 мимо ходили `/acquire` и `/studio` — каждая делала свой fetch,
// и вместе с виджетом в шапке получалось два запроса за одним и тем же числом
// (issue #1016).
//
// Страж существует потому, что писать `fetch(apiUrl("/api/qcoreai/smart/savings"))`
// естественнее, чем искать готовую функцию: без проверки прямые вызовы вернутся
// на следующей странице, которой понадобится этот счётчик.

const SRC = path.join(process.cwd(), "src");
const ENDPOINT = "qcoreai/smart/savings";
/**
 * Ровно эта ручка, а не всё, что с неё начинается. Рядом живут
 * `smart/savings/daily` (разбивка по дням) и `smart/savings.csv` (экспорт) —
 * это другие данные, дедупликации не требуют, и страж, ловивший их по префиксу,
 * краснел бы на честном коде. Проверять надо условие, а не форму записи.
 */
const DIRECT_CALL = /qcoreai\/smart\/savings(?![/.\w])/;
/** Единственное место, которому положено обращаться к ручке напрямую. */
const ALLOWED = path.join("lib", "aiSavings.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("счётчик экономии запрашивается из одного места", () => {
  test("никто, кроме lib/aiSavings.ts, не дёргает ручку напрямую", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file);
      if (rel === ALLOWED) continue;

      const text = readFileSync(file, "utf8");
      if (!text.includes(ENDPOINT)) continue;

      // Упоминание в подписи под цифрой или в комментарии — не запрос.
      // Ищем именно сетевой вызов: fetch(...) с этим путём внутри.
      for (const line of text.split("\n")) {
        if (!DIRECT_CALL.test(line)) continue;
        if (/\bfetch\s*\(/.test(line)) {
          offenders.push(`${rel}: ${line.trim().slice(0, 100)}`);
        }
      }
    }

    expect(
      offenders,
      "Эти файлы запрашивают счётчик мимо fetchAiSavings — будет лишний запрос:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  test("страж не срабатывает на упоминания в тексте и комментариях", () => {
    // Проверка самого стража: на продающих страницах путь ручки печатается как
    // подпись под цифрой («источник: /api/qcoreai/smart/savings»). Если бы
    // страж ловил любое упоминание, он краснел бы на честном тексте и его
    // отключили бы целиком.
    const mentions = walk(SRC).filter((f) => {
      const rel = path.relative(SRC, f);
      return rel !== ALLOWED && readFileSync(f, "utf8").includes(ENDPOINT);
    });
    expect(mentions.length, "ожидаем, что упоминания в подписях остались").toBeGreaterThan(0);
  });
});
