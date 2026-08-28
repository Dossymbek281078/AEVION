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

const SHOW = /(showToast|setError|setImgError|setMusicError|setThreeDError|setVideoError|setMediaTtsError|setSnippetError)\(\s*([`"])([^`"]{4,120})\2/g;

/**
 * Единственное законное исключение — с причиной.
 * «Vercel: <адрес>» это имя поставщика и ссылка: переводить нечего.
 */
const ALLOWED = new Set(["Vercel: ${d.deployUrl}"]);

function messages(): string[] {
  return [...code().matchAll(SHOW)].map((m) => m[3]);
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
    const english = messages()
      .filter((t) => /[A-Za-z]/.test(t) && !/[А-Яа-я]/.test(t))
      .filter((t) => !ALLOWED.has(t));
    expect(english, "сообщение на английском в русском окне").toEqual([]);
  });

  test("подстановки в переведённых строках уцелели", () => {
    // Перевод делался заменой строк целиком, и потерянная ${…} превратила бы
    // осмысленный текст в обрубок. Сравниваем: у каждого сообщения с фигурной
    // скобкой она должна быть парной.
    const broken = messages().filter((t) => {
      const open = (t.match(/\$\{/g) ?? []).length;
      const close = (t.match(/\}/g) ?? []).length;
      return open > close;
    });
    expect(broken, "подстановка потеряна при переводе").toEqual([]);
  });
});
