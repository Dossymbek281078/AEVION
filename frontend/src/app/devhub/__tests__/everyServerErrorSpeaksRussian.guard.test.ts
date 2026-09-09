import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { devhubServerError } from "@/lib/devhubServerError";

/**
 * КАЖДЫЙ текст отказа бэкенда доезжает до экрана по-русски.
 *
 * Граница показа `devhubServerError` переводит серверные строки в человеческие.
 * Её правила писались под то, что было на глазах в день написания, — а тексты
 * добавляет бэкенд, и добавляет их другое окно, не спрашивая нас.
 *
 * Замер 08.09.2026: из 138 текстов до экрана по-английски доезжали 7, и шесть
 * из них — машинные коды вроде `no_guest_id`. Замер 09.09.2026 после починок и
 * после цикла 13: **144 текста, непереведённых 0**. Сторож закрепляет ноль,
 * чтобы следующий добавленный текст не проехал молча.
 *
 * ⚠️ Сторож ловит только НАЛИЧИЕ русского, а не его качество: строка «Ошибка»
 * прошла бы. Качество формулировок держат соседние сторожа
 * (quotaNamesAreHuman — человеческие имена норм, proxyFailureTellsThemToRetry —
 * совет повторить). Здесь охват, там смысл.
 *
 * Если текст переводить НЕ надо (машинное значение, имя поставщика) — впишите
 * его в ALLOWED С ПРИЧИНОЙ, а не ослабляйте проверку.
 */

const BACKEND = path.join(
  __dirname, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);

/** Тексты, которым русский не нужен. Пусто — и это измеренное состояние. */
const ALLOWED = new Set<string>([]);

function serverErrorTexts(): string[] {
  const src = fs.readFileSync(BACKEND, "utf8");
  const found = new Set<string>();
  const re = /error:\s*"([^"]{4,90})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) found.add(m[1]);
  return [...found].sort();
}

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

describe("каждый текст отказа бэкенда доезжает до экрана по-русски", () => {
  test("сбор текстов не пуст — иначе сторож ослеп, а не позеленел", () => {
    const texts = serverErrorTexts();
    expect(texts.length, "не нашёл ни одного текста ошибки в роутере бэкенда").toBeGreaterThan(80);
  });

  test("прибор умеет отвечать по-русски (положительный контроль)", () => {
    const ru = devhubServerError("Monthly deploy limit reached", "запасной", "ru");
    expect(hasCyrillic(ru), "граница не перевела даже норму выкаток — прибор сломан").toBe(true);
    expect(ru, "имя нормы должно быть человеческим").toContain("публикации");
  });

  test("прибор умеет НЕ переводить (отрицательный контроль)", () => {
    // EN-ветка намеренно отдаёт серверный текст как есть. Без этой проверки
    // сторож был бы зелёным и на границе, которая всё подряд переводит.
    const en = devhubServerError("Monthly deploy limit reached", "fallback", "en");
    expect(hasCyrillic(en), "en-ветка не должна выдавать русский").toBe(false);
  });

  test("ни один текст не доезжает без русского", () => {
    const bad: string[] = [];
    for (const msg of serverErrorTexts()) {
      if (ALLOWED.has(msg)) continue;
      if (!hasCyrillic(devhubServerError(msg, "запасной текст", "ru"))) bad.push(msg);
    }
    expect(bad, "эти тексты человек увидит по-английски").toEqual([]);
  });
});
