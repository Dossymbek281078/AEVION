import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Проверка доступа должна стоять ДО обращения к базе.
 *
 * Поймано 19.08.2026 смоуком ZTide: `GET /me without auth → expected 401,
 * got 500`. Причина — `await ensureTables()` первой строкой обработчика, а
 * возврат 401 после неё: когда база недоступна, инициализация таблиц падает,
 * и неавторизованный запрос получает «у нас сломалось» вместо «вам нельзя».
 *
 * Цена не косметическая. 4xx — ответ о запросе, 5xx поднимает людей и
 * засоряет Sentry; во время аварии базы шум идёт от запросов, которые надо
 * было отклонить сразу, не тронув базу вовсе.
 *
 * ЧЕМУ НАУЧИЛА ЭТА НАХОДКА, и почему список файлов такой короткий. Разбором
 * кода я насчитал 49 обработчиков «с тем же порядком строк» в семи файлах.
 * Проба показала 14: у `qpaynet` и `qcontract` тот же порядок, но их
 * `ensureTables` ПОГЛОЩАЕТ отказ, выполнение доходит до проверки доступа и
 * приходит честный 401. То есть форма кода была гипотезой, а не находкой —
 * решал `catch` внутри вызываемой функции. Сторож стоит только на тех файлах,
 * где поведение проверено пробой и починено.
 */
const GUARDED = ["qmaskcard.ts", "veilnetxLedger.ts"];

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes");

/** Позиции, на которых обработчик обращается к базе раньше, чем отказывает. */
export function dbBeforeAuth(src: string): number[] {
  const lines = src.split("\n");
  const bad: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/await ensureTables\(\)/.test(lines[i])) continue;
    // Заглядываем вперёд на несколько строк: между вызовом и проверкой
    // доступа обычно ничего нет, но пустая строка или комментарий бывают.
    const ahead = lines.slice(i + 1, i + 5).join("\n");
    if (/verifyBearer\w*\(req\)/.test(ahead) && /res\.status\(401\)/.test(ahead)) {
      bad.push(i + 1);
    }
  }
  return bad;
}

describe("отказ 401 не должен зависеть от доступности базы", () => {
  it.each(GUARDED)("%s: проверка доступа стоит до ensureTables", (file) => {
    const src = readFileSync(join(ROUTES_DIR, file), "utf8");
    expect(
      dbBeforeAuth(src),
      `в ${file} обращение к базе стоит перед возвратом 401 (строки ниже). ` +
        "Когда база недоступна, неавторизованный получит 500 вместо 401.",
    ).toEqual([]);
  });

  /**
   * Проверка САМОГО сторожа. Без неё пустой список выдаётся и когда всё в
   * порядке, и когда разбор ничего не находит.
   */
  it("сторож видит нарушение и молчит на исправленном порядке", () => {
    const broken = [
      "  try {",
      "    await ensureTables();",
      "    const auth = verifyBearerOptional(req);",
      '    if (!auth) return res.status(401).json({ error: "auth required" });',
    ].join("\n");
    const fixed = [
      "  try {",
      "    const auth = verifyBearerOptional(req);",
      '    if (!auth) return res.status(401).json({ error: "auth required" });',
      "    await ensureTables();",
    ].join("\n");
    expect(dbBeforeAuth(broken)).toHaveLength(1);
    expect(dbBeforeAuth(fixed)).toHaveLength(0);
  });
});
