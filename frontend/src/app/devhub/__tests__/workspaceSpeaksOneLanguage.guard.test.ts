import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Рабочее окно DevHub говорит на одном языке.
 *
 * Замер 28.08.2026: из 59 сообщений, которые видит человек, **38 были только
 * латиницей** при 21 русском. То есть покупатель платного модуля получал окно,
 * где половина подсказок на английском, а половина на русском — вперемешку, в
 * одном и том же сценарии.
 *
 * Это не вопрос «какие языки поддерживаем». Словаря в этом файле нет вовсе, и
 * соседние сообщения давно русские: выбор уже сделан, просто половину строк
 * забыли. Половинчатость хуже любого из двух последовательных вариантов —
 * человек не понимает, сломалось что-то или так задумано.
 *
 * Сторож следит за ОДНОРОДНОСТЬЮ, а не за конкретным языком: когда окно
 * подключат к словарю, правило снимут вместе с хардкодом.
 */

const FILE = path.join(__dirname, "..", "[id]", "page.tsx");

/** Исходник без комментариев: они по-английски и по-русски, и это нормально. */
function code(): string {
  const raw = fs.readFileSync(FILE, "utf8");
  let out = "";
  for (let i = 0; i < raw.length; ) {
    if (raw.startsWith("/*", i)) { const j = raw.indexOf("*/", i + 2); i = j < 0 ? raw.length : j + 2; out += " "; continue; }
    if (raw.startsWith("//", i)) { const j = raw.indexOf("\n", i); i = j < 0 ? raw.length : j; continue; }
    out += raw[i++];
  }
  return out;
}

const FN = /\b(showToast|setError|setImgError|setMusicError|setThreeDError|setVideoError|setMediaTtsError|setSnippetError|confirm)\(/g;

/**
 * Уровни всплывающих сообщений и идентификаторы возможностей — не текст для
 * человека, а аргументы. Список поимённый: без него сторож требовал бы
 * переводить слово "error", которое никто не читает.
 */
const NOT_TEXT = new Set([
  "error", "info", "success", "warning",
  "image", "video", "pages", "railway", "vercel", "database", "audio_tts", "audio_music", "3d",
]);

/**
 * Законные исключения — поимённо и с причиной.
 */
const ALLOWED = new Set([
  // Имя поставщика и адрес: переводить нечего.
  "Vercel: ${d.deployUrl}",
  // Чистые подстановки, ни одного английского слова.
  "${d.error} → ${d.topUpUrl}",
  // Префикс data-URI, а не сообщение.
  "data:",
]);

/**
 * Разбираем АРГУМЕНТЫ вызова целиком, а не первый литерал.
 *
 * Первая версия искала `showToast("строка")` — и пропускала
 * `showToast(e.message || "Generation failed")`, где литерал стоит вторым. Так
 * из виду ушли 37 сообщений, все на путях ошибок: именно там человек и
 * читает текст внимательнее всего.
 */
function messages(): string[] {
  const src = code();
  const out: string[] = [];
  for (const m of src.matchAll(FN)) {
    let i = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let buf = "";
    while (i < src.length && depth > 0 && buf.length < 400) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth > 0) buf += c;
      i++;
    }
    for (const lit of buf.matchAll(/["`]([^"`\n]{4,120})["`]/g)) {
      if (!NOT_TEXT.has(lit[1])) out.push(lit[1]);
    }
  }
  return out;
}

describe("рабочее окно не смешивает языки", () => {
  test("прибор работает: сообщения находятся и среди них есть русские", () => {
    const all = messages();
    expect(all.length, "сообщений не найдено — сторож смотрит не туда").toBeGreaterThan(30);
    expect(
      all.filter((t) => /[А-Яа-я]/.test(t)).length,
      "русских сообщений нет — разбор сломан",
    ).toBeGreaterThan(20);
  });

  test("ни одно сообщение не осталось только на латинице", () => {
    // Строка, чьи буквы целиком приходят подстановками из словаря GEN_UI
    // (`${GL.created}: ${n}`), локализована ПО ПОСТРОЕНИЮ — вырезаем ${…} и,
    // если букв не осталось, это не зашитый английский. Сам словарь проверяет
    // тест «прибор работает»: русские строки GEN_UI.ru входят в общий счёт.
    const stripInterp = (t: string) => t.replace(/\$\{[^}]*\}/g, "");
    const english = messages()
      .filter((t) => /[A-Za-z]/.test(t) && !/[А-Яа-я]/.test(t))
      .filter((t) => /[A-Za-zА-я]/.test(stripInterp(t)))
      .filter((t) => !ALLOWED.has(t));
    expect(english, "сообщение на английском в русском окне").toEqual([]);
  });

  // ПРОВЕРКИ ПОДСТАНОВОК ЗДЕСЬ НЕТ, и это осознанно. Она была: «у каждого
  // сообщения с ${ должна быть парная }». Но извлечение режет шаблонную строку
  // по ВНУТРЕННЕЙ кавычке (`Файл НЕ удалён — ${e?.message || "…"}`), и проверка
  // краснела на обрубке СВОЕГО ЖЕ разбора, а не на коде. Сторож, ловящий
  // собственную неточность, даёт ложные тревоги там, где кода касаться не надо.
});
