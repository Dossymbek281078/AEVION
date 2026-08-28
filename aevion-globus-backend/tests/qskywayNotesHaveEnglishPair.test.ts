import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Модуль держит соглашение note/noteEn: «обе версии, потому что защищает та,
 * которую читатель понимает» — это написано в самом qskyway.ts рядом с полем
 * scope. Соглашение соблюдалось не везде: замер 28.08.2026 дал 18 полей с
 * русским текстом без английской пары.
 *
 * Нашлось не глазами. Я чинил СВОЮ оплошность — добавленное этой же ночью поле
 * blindHeight.note английской пары не имело, то есть я нарушил собственное
 * правило через два часа после того, как его записал, — и задал тот же вопрос
 * всему файлу.
 *
 * Это ХРАПОВИК: обнаружение автоматическое, список ниже лишь помнит оставшиеся.
 * Требовать ноль сегодня значит сделать проверку вечно красной, а такие
 * перестают читать. Новое поле без пары краснеет сразу.
 *
 * Отличие от списка KEYS в i18nKeys.test.ts принципиальное: там список НУЖЕН,
 * чтобы ключ вообще проверялся, и новый ключ без него не покрыт ничем
 * (проверено мутацией 28.08 — сторож остался зелёным). Здесь наоборот.
 *
 * Ни одной регулярки на кириллицу: диапазоны в шаблонах на этой машине
 * раскрываются не так, как ожидаешь, и молчаливо дают ноль.
 */

// ── ЧЕГО ЭТОТ СТОРОЖ НЕ УВИДИТ ───────────────────────────────────────────
//
// Утверждение «пояснений без пары нет» при маскировке остаётся ЗЕЛЁНЫМ.
// Экранированные коды закрыты (проверено мутацией). Не закрыто и названо:
//
//   пояснение, собранное из кусков или из кодов символов
//   поле с ДРУГИМ именем (ищем строго `note:`; `message:`, `hint:` мимо)
//   пара, стоящая дальше 12 строк — окно выбрано по факту, не по теории
//   русский текст в ДРУГИХ файлах модуля: сторож читает только qskyway.ts
//
// Два сообщения ограничителя намеренно двуязычны ОДНОЙ строкой (общий
// лимитер кладёт одно поле), и сторож их не видит — это не дыра, а форма.

const SRC = readFileSync(path.join(__dirname, "..", "src", "routes", "qskyway.ts"), "utf8");
const NL = String.fromCharCode(10);

// Кириллица бывает записана экранированными кодами — тогда посимвольный поиск
// её не видит. Проверено мутацией на сторожа-близнеце для страницы: без
// раскрытия он ЗЕЛЁНЫЙ на русской строке, написанной кодами.
//
// Шаблон собирается из кода символа: обратный слэш в передаваемом тексте
// съедается на границе инструмента.
const ESCAPED = new RegExp(String.fromCharCode(92) + "u([0-9a-fA-F]{4})", "g");

function decodeEscapes(s: string): string {
  return s.replace(ESCAPED, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

// Комментарии вырезаем, СОХРАНЯЯ переводы строк: иначе окно поиска пары
// разъезжается с файлом и сторож начинает врать в обе стороны.
function codeLines(src: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of src.split(NL)) {
    let l = raw;
    if (inBlock) {
      const end = l.indexOf("*/");
      if (end === -1) { out.push(""); continue; }
      l = l.slice(end + 2); inBlock = false;
    }
    for (;;) {
      const open = l.indexOf("/*");
      if (open === -1) break;
      const close = l.indexOf("*/", open + 2);
      if (close === -1) { l = l.slice(0, open); inBlock = true; break; }
      l = l.slice(0, open) + " " + l.slice(close + 2);
    }
    const line = l.indexOf("//");
    if (line !== -1) l = l.slice(0, line);
    out.push(l);
  }
  return out;
}

// Оставшиеся на 28.08.2026 — справочные пояснения слоя потолков и подстановки
// высот. Отказы и платный контур QRight уже переведены.
// ✅ Пусто, и это ЦЕЛЬ, а не забытый список: на 28.08.2026 все пояснения
// модуля имеют английскую пару. Пустое множество здесь означает «долга нет»,
// а проверка «список не оторвался от файла» ниже не даст ему тихо ожить:
// вернуть сюда строку можно только вместе с объяснением, почему её нельзя
// перевести сейчас.
const KNOWN_WITHOUT_PAIR = new Set<string>([
]);

const WINDOW = 12;

function unpaired(): string[] {
  const lines = codeLines(SRC);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!hasCyrillic(decodeEscapes(l))) continue;
    if (!l.trimStart().startsWith("note:")) continue;
    const from = Math.max(0, i - WINDOW);
    const to = Math.min(lines.length, i + WINDOW);
    if (lines.slice(from, to).some((x) => x.includes("noteEn"))) continue;
    out.push(l.split(" ").filter(Boolean).join(" "));
  }
  return out;
}

describe("русские пояснения QSkyway имеют английскую пару", () => {
  it("контроль прибора: файл прочитан, кириллица в нём есть, note находится", () => {
    // Без этого «новых нет» неотличимо от «поиск не работает» — сегодня свип
    // уже соврал один раз, насчитав 90 строк вместо 23.
    expect(SRC.length).toBeGreaterThan(10000);
    expect(hasCyrillic(SRC)).toBe(true);
    expect(SRC.includes("noteEn:")).toBe(true);
    expect(unpaired().length + 1).toBeGreaterThan(0);
  });

  it("новых пояснений без английской пары нет", () => {
    const fresh = unpaired().filter((l) => !KNOWN_WITHOUT_PAIR.has(l));
    expect(fresh).toEqual([]);
  });

  it("список не оторвался от файла: переведённое из него ушло", () => {
    // Иначе долг выглядит больше настоящего, и цифрам перестают верить.
    const now = unpaired();
    const stale = Array.from(KNOWN_WITHOUT_PAIR).filter((k) => !now.includes(k));
    expect(stale).toEqual([]);
  });
});
