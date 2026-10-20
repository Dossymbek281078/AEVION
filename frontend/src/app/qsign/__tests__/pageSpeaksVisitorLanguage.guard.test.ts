import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QSIGN_DICT, QSIGN_KEYS, tQsign } from "../i18n";

/**
 * 20.10.2026, окно «Приложения», пункт 1а очереди QSign.
 *
 * До этого дня /qsign была целиком английской (словарь был только у семи подписей
 * «занято»), и гость с ru-RU/kk видел первый экран, форму подписи и ошибки на чужом
 * языке. Строки ушли в модульный словарь ./i18n.ts. Сторож держит три вещи:
 *  1) у каждого ключа есть русское и казахское значение, и оно НЕ английское;
 *  2) в page.tsx не осталось видимого английского текста хардкодом — ни текстовых
 *     узлов JSX, ни aria-label/placeholder латиницей, ни английских тостов;
 *  3) подстановки {name} в ru/kk совпадают с en (иначе число или id пропадёт).
 * Контроль: тот же детектор на исходнике ДО правки находит десятки строк
 * (в этом тесте — на искусственной строке с «Sign in →»).
 */

const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

/** Имена и технические слова, которые на любом языке пишутся латиницей. */
const LATIN_OK = new Set([
  "qsign", "qright", "aevion", "globus", "planet", "bureau", "hmac", "sha", "ed25519",
  "rfc", "jcs", "json", "gps", "api", "sdk", "pdf", "kid", "hex", "utc", "http", "https",
  "url", "curl", "typescript", "python", "openapi", "dilithium", "dsa",
  // $TOKEN — имя переменной в примере кода, не фраза
  "token",
]);

/** Английские слова в строке — латинские слова от 3 букв, кроме имён и терминов. */
function englishWords(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/[A-Za-z][A-Za-z’']{2,}/g)) {
    const w = m[0].toLowerCase().replace(/[’']/g, "");
    if (!LATIN_OK.has(w)) out.push(m[0]);
  }
  return out;
}

/** Исходник без комментариев: блочных, JSX-блочных и строчных. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Текстовые узлы JSX: спаны между «>» тега и следующим «<», в которых нет
 * выражений ({ }), присваиваний (=) и точек с запятой — то есть чистый текст,
 * а не код внутри атрибутов. Возвращает те, где есть английские слова.
 */
function jsxTextLines(src: string): string[] {
  const out: string[] = [];
  for (const m of stripComments(src).matchAll(/>([^<]*)</g)) {
    const span = m[1];
    if (/[{}=;]/.test(span)) continue;
    const text = span.replace(/\s+/g, " ").trim();
    if (text && englishWords(text).length > 0) out.push(text);
  }
  return out;
}

describe("/qsign говорит на языке посетителя (словарь ./i18n.ts)", () => {
  test("у каждого ключа есть ru и kk, и они не равны английскому", () => {
    const same: string[] = [];
    for (const k of QSIGN_KEYS) {
      const en = tQsign("en", k);
      for (const lang of ["ru", "kk"] as const) {
        const v = QSIGN_DICT[lang]?.[k];
        if (!v || v === en) same.push(`${lang}:${k}`);
      }
    }
    expect(same, `ключи без перевода (всего ключей ${QSIGN_KEYS.length})`).toEqual([]);
    expect(QSIGN_KEYS.length).toBeGreaterThan(100);
  });

  test("подстановки {name} в ru/kk совпадают с en", () => {
    const bad: string[] = [];
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const k of QSIGN_KEYS) {
      const en = vars(tQsign("en", k));
      for (const lang of ["ru", "kk"] as const) {
        if (vars(QSIGN_DICT[lang]![k]) !== en) bad.push(`${lang}:${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("в page.tsx нет видимого английского текста хардкодом", () => {
    const found = jsxTextLines(SRC);
    expect(found, `английские текстовые узлы: ${found.length}`).toEqual([]);
  });

  test("aria-label и placeholder — не английские литералы", () => {
    const found: string[] = [];
    for (const m of SRC.matchAll(/(aria-label|placeholder)="([^"]*)"/g)) {
      // Адрес-пример в поле вебхука — не фраза, а образец URL.
      if (/^https?:\/\//.test(m[2])) continue;
      if (englishWords(m[2]).length > 0) found.push(m[0]);
    }
    expect(found).toEqual([]);
  });

  test("тосты не содержат английских литералов", () => {
    const found: string[] = [];
    for (const m of SRC.matchAll(/showToast\(\s*(["'`])([^"'`]*)\1/g)) {
      if (englishWords(m[2]).length > 0) found.push(m[2]);
    }
    expect(found).toEqual([]);
  });

  test("страница берёт словарь и зовёт его (useQsignT, ≥100 вызовов t())", () => {
    expect(SRC).toContain('from "./i18n"');
    const calls = SRC.match(/\bt\("[a-z]+\.[A-Za-z0-9]+"/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(100);
    // каждый вызванный ключ есть в словаре
    const keys = new Set<string>(QSIGN_KEYS);
    const missing = calls.map((c) => c.slice(3, -1)).filter((k) => !keys.has(k));
    expect(missing).toEqual([]);
  });

  test("контроль: детектор видит английский текст, когда он есть", () => {
    const sample = '      <Link href="/auth">\n        Sign in →\n      </Link>\n      <b>token loaded</b>\n';
    expect(jsxTextLines(sample)).toEqual(["Sign in →", "token loaded"]);
    expect(jsxTextLines('      <b>Planet</b>\n      <i>QSign · HMAC</i>\n')).toEqual([]);
  });

  test("гостю на первом экране — кнопка входа с возвратом на /qsign; вошедшему — якорь на форму", () => {
    expect(SRC).toContain('data-qsign-cta="guest"');
    expect(SRC).toContain('href="/auth?next=/qsign" data-qsign-cta="guest"');
    expect(SRC).toContain('href="#qsign-sign" data-qsign-cta="user"');
    expect(SRC).toContain('id="qsign-sign"');
  });
});
