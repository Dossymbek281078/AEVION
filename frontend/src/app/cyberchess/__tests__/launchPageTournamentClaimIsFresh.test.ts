/**
 * Обещание про турниры на странице запуска считается ЗАНОВО, а не из кэша.
 *
 * 🔴 ПОВОД 30.09.2026, утро запуска. Посевные турниры скрыли, ручка стала
 * отдавать count 0 — а страница ещё показывала «Турниры с сеткой и рейтингом»
 * под заголовком «Что уже работает». Кэш СТРАНИЦЫ был ни при чём: она
 * отдавалась с x-vercel-cache MISS. Держал кэш ДАННЫХ — `revalidate: 3600` у
 * самого запроса. Настройка, которая выглядит как «скорость», задавала срок,
 * в течение которого страница повторяет устаревшее утверждение.
 *
 * Проверка по исходнику осознанно: и условие показа, и режим кэша живут в
 * серверном компоненте, который в тесте не поднять.
 *
 * ⚠️ И первая версия этого сторожа сама попалась: она искала слово
 * «revalidate» в теле функции и краснела на МОЁМ ЖЕ КОММЕНТАРИИ, где это
 * слово объясняет, чего делать нельзя. Поэтому комментарии снимаются перед
 * любой проверкой — текст о вещи не должен считаться вещью.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Убрать комментарии: `//` внутри `https://` комментарием не считается. */
function безКомментариев(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const два = src.slice(i, i + 2);
    if (два === "/*") {
      const к = src.indexOf("*/", i + 2);
      i = к < 0 ? src.length : к + 2;
      continue;
    }
    if (два === "//" && src[i - 1] !== ":") {
      const к = src.indexOf("\n", i);
      i = к < 0 ? src.length : к;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const сырой = readFileSync(join(__dirname, "..", "launch", "page.tsx"), "utf8");
const код = безКомментариев(сырой);

function кусок(от: string, длина: number): string {
  const н = код.indexOf(от);
  expect(н, `«${от}» не найдено — тест смотрит не туда`).toBeGreaterThan(-1);
  return код.slice(н, н + длина);
}

describe("обещание про турниры не приходит из кэша", () => {
  test("прибор исправен: комментарии действительно снимаются", () => {
    expect(безКомментариев('a /* revalidate */ b')).not.toContain("revalidate");
    expect(безКомментариев('const u = "https://a.app"; // revalidate')).toContain("https://a.app");
    expect(безКомментариев('const u = "https://a.app"; // revalidate')).not.toContain("revalidate");
  });

  test("🔴 запрос за числом турниров не кэшируется", () => {
    const тело = кусок("async function fetchTournamentCount", 900);
    expect(тело).toContain('cache: "no-store"');
    expect(
      /revalidate/.test(тело),
      "у счётчика турниров снова стоит revalidate — страница будет держать устаревшее обещание до часа",
    ).toBe(false);
  });

  test("контроль: у счётчика ЗАДАЧ кэш остаётся — он не обещает активности", () => {
    expect(кусок("async function fetchPuzzleBank", 600)).toContain("revalidate");
  });

  test("блок турниров показывается только при ненулевом счёте", () => {
    expect(код).toMatch(/\{tournaments \?[\s\S]{0,200}Турниры с сеткой/);
    expect(код).toContain("return n > 0 ? n : null;");
  });

  test("заголовок и описание не зовут ждать письма и не обещают турниры", () => {
    const мета = кусок("export const metadata", 700);
    expect(мета).not.toContain("напишем в день запуска");
    expect(мета).not.toContain("раннего доступа");
    expect(мета).not.toMatch(/description:[\s\S]{0,160}турнир/);
  });
});
