import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * У запросов к серверу должен стоять предел ожидания.
 *
 * Замер 29.08.2026: страницы умели показать «не удалось загрузить», но только
 * когда сервер ОТВЕТИЛ ошибкой. Если он молчит — перегружен, тормозит, — ошибки
 * нет вовсе, catch не срабатывает, и человек видит пустой экран с бесконечным
 * ожиданием. Это хуже честного сообщения: непонятно, сломалось или грузится.
 *
 * Нашлось случайно: страница зрительского режима не открылась за 45 секунд без
 * запущенного сервера, при 0.8 секунды на проде.
 *
 * Десять секунд выбраны как заведомо больше обычного ответа (доли секунды) и
 * заведомо меньше человеческого терпения.
 */
const STRANICY = ["spectator", "replays", "tournaments", "leaderboard"];

describe("запросы к серверу не ждут вечно", () => {
  for (const s of STRANICY) {
    test(`${s}: у каждого запроса есть предел ожидания`, () => {
      const p = path.join(__dirname, "..", s, "page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      const zaprosov = (src.match(/cache:\s*"no-store"/g) || []).length;
      const predelov = (src.match(/AbortSignal\.timeout\(/g) || []).length;
      expect(zaprosov, `на странице ${s} исчезли запросы — проверка стала пустой`).toBeGreaterThan(0);
      expect(predelov, `запросов ${zaprosov}, пределов ожидания ${predelov}`).toBeGreaterThanOrEqual(zaprosov);
    });
  }
});
