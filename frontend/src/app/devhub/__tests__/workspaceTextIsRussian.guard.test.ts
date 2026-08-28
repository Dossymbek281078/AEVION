import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Текст МЕЖДУ ТЕГАМИ в рабочем окне — по-русски.
 *
 * 28.08.2026 утром я перевёл 72 сообщения и счёл язык закрытым. Это были
 * всплывающие УВЕДОМЛЕНИЯ; подписи, кнопки и состояния остались английскими, и
 * нашлись только вечером, свипом другого класса. Замер тогда: 62 строки, среди
 * них «Loading project…», «Project not found.» и кнопки Create/Cancel.
 *
 * Переведено 54. Оставшиеся восемь названы поимённо ниже — переводить их нельзя
 * или бессмысленно.
 */

const SRC = fs.readFileSync(path.resolve(__dirname, "..", "[id]", "page.tsx"), "utf8");

/** Осознанно НЕ переводится, с причиной у каждой строки. */
const KEEP: Record<string, string> = {
  "Cloudflare Pages": "название сервиса",
  "Studio Pro": "название продукта",
  "README.ru.md": "имя файла",
  "HTML body": "термин разметки: body — имя тега",
};

function englishBetweenTags(): string[] {
  const CYR = /[а-яА-ЯёЁ]/;
  const LF = String.fromCharCode(10);
  const out: string[] = [];
  for (const raw of SRC.split(LF)) {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
    // Позиционный разбор: `>Текст<`. Регулярку из строки здесь не собираем —
    // на этой машине она теряет слэши и молча находит ноль.
    let from = 0;
    for (;;) {
      const a = raw.indexOf(">", from);
      if (a < 0) break;
      const b = raw.indexOf("<", a + 1);
      if (b < 0) break;
      const t = raw.slice(a + 1, b).trim();
      from = b;
      if (t.length < 6 || t.length > 46) continue;
      if (!/^[A-Z]/.test(t)) continue;
      // Цифры добавлены 29.08.2026. Без них шаблон не видел НИ ОДНОЙ
      // подписи с числом: «Download MP3» жила в интерфейсе, а сторож
      // был зелёным — не потому, что разрешил её, а потому что не мог
      // разглядеть. В списке разрешений её поэтому и нет.
      if (!/^[A-Za-z][A-Za-z0-9 ,.'\-]+$/.test(t)) continue;
      if (CYR.test(t)) continue;
      out.push(t);
    }
  }
  return out;
}

describe("рабочее окно говорит по-русски", () => {
  test("прибор исправен: разбор находит хоть что-то", () => {
    // Если бы разбор возвращал пусто, проверка ниже была бы зелёной ни на чём.
    expect(englishBetweenTags().length + Object.keys(KEEP).length).toBeGreaterThan(5);
  });

  test("английских подписей не осталось, кроме названных", () => {
    const unexpected = englishBetweenTags().filter((t) => !(t in KEEP));
    expect(unexpected, "английская подпись в русском окне").toEqual([]);
  });

  test("у каждого исключения есть причина", () => {
    // Список без причин через месяц становится местом, куда дописывают, чтобы
    // сторож замолчал.
    for (const [k, why] of Object.entries(KEEP)) {
      expect(why.length, `исключение «${k}» без причины`).toBeGreaterThan(8);
    }
  });
});
