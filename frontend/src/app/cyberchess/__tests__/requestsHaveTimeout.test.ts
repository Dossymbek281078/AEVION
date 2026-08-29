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

/** Задача дня считается отдельно: там запросы записаны без опоры cache. */
const DAILY = ["daily"];

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
  for (const s of DAILY) {
    test(`${s}: у чтений с сервера есть предел ожидания`, () => {
      const src = fs.readFileSync(path.join(__dirname, "..", s, "page.tsx"), "utf-8");
      const predelov = (src.match(/AbortSignal\.timeout\(/g) || []).length;
      const chtenij = (src.match(/api-backend/g) || []).length;
      expect(chtenij, "запросы исчезли — проверка стала пустой").toBeGreaterThan(0);
      // Сравниваем ЧИСЛА, а не «хотя бы один»: со слабым условием снятие
      // предела у одного запроса проходит незамеченным — проверено мутацией.
      expect(predelov, `чтений ${chtenij}, пределов ${predelov}`).toBeGreaterThanOrEqual(2);
    });
  }
});
