import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Пути ОШИБОК и СООБЩЕНИЙ страницы проекта DevHub говорят на языке читателя.
 *
 * Замер 30.10.2026: видимые подписи страницы уже шли через словари, а около
 * ста пятидесяти текстов на путях ошибок — тосты, setError, запасные тексты
 * serverError, строки результата отправки — оставались русскими литералами.
 * Человек на en нажимал кнопку, у него что-то не получалось, и именно тут, в
 * самый растерянный момент, страница заговаривала по-русски.
 *
 * Правило: русский текст вызова не пишется литералом — он живёт в TOAST_UI
 * (ru/en/kk), а в вызове стоит TL.ключ или fill(TL.ключ, { подстановки }).
 */

const FILE = path.join(__dirname, "..", "[id]", "page.tsx");
const RAW = fs.readFileSync(FILE, "utf8");
const CYR = /[А-Яа-яЁё]/;

/** Исходник без комментариев (строковые литералы не трогаем). */
function code(): string {
  let out = "";
  let i = 0;
  while (i < RAW.length) {
    const c = RAW[i];
    if (c === '"' || c === "'" || c === "`") {
      // пропускаем строку целиком, чтобы «//» внутри адреса не считался комментарием
      let j = i + 1;
      while (j < RAW.length && RAW[j] !== c) { if (RAW[j] === "\\") j++; if (c !== "`" && RAW[j] === "\n") break; j++; }
      out += RAW.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (RAW.startsWith("/*", i)) { const j = RAW.indexOf("*/", i + 2); i = j < 0 ? RAW.length : j + 2; out += " "; continue; }
    if (RAW.startsWith("//", i)) { const j = RAW.indexOf("\n", i); i = j < 0 ? RAW.length : j; continue; }
    out += c;
    i++;
  }
  return out;
}

/** Без самого словаря: в нём русский текст законен. */
function codeOutsideDictionaries(): string {
  let s = code();
  for (const name of ["TOAST_UI", "GEN_UI", "ATTR_UI"]) {
    const a = s.indexOf("const " + name);
    if (a < 0) continue;
    const b = s.indexOf("\n};", a);
    s = s.slice(0, a) + s.slice(b + 3);
  }
  return s;
}

// Вызовы, чей аргумент человек потом читает.
const CALLS = /\b(showToast|setError|set[A-Za-z]*Error|set[A-Za-z]*Msg|setBuildLog|confirm|alert|prompt|serverError|devhubServerError|throw new Error)\(/g;

function callArgs(src: string): { fn: string; args: string }[] {
  const out: { fn: string; args: string }[] = [];
  for (const m of src.matchAll(CALLS)) {
    let i = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let buf = "";
    while (i < src.length && depth > 0 && buf.length < 1500) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth > 0) buf += c;
      i++;
    }
    out.push({ fn: m[1], args: buf });
  }
  return out;
}

/** Русские строковые литералы внутри аргументов. */
function russianLiterals(args: string): string[] {
  const lits = [...args.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? "");
  return lits.filter((t) => CYR.test(t));
}

type Dict = Record<string, string>;
function toastDict(): Record<"ru" | "en" | "kk", Dict> {
  const a = RAW.indexOf("const TOAST_UI");
  const b = RAW.indexOf("\n};", a);
  const block = RAW.slice(a, b);
  const out: Record<string, Dict> = {};
  let cur: Dict | null = null;
  for (const line of block.split("\n")) {
    const head = line.match(/^  (ru|en|kk): \{$/);
    if (head) { cur = out[head[1]] = {}; continue; }
    if (/^  \},?$/.test(line)) { cur = null; continue; }
    const kv = line.match(/^    (\w+): ("(?:[^"\\]|\\.)*"),?$/);
    if (kv && cur) cur[kv[1]] = JSON.parse(kv[2]);
  }
  return out as Record<"ru" | "en" | "kk", Dict>;
}

describe("пути ошибок страницы проекта не несут русских литералов", () => {
  test("прибор исправен: вызовы находятся, словарь читается", () => {
    const calls = callArgs(codeOutsideDictionaries());
    expect(calls.length, "вызовов не найдено — разбор сломан").toBeGreaterThan(150);
    const d = toastDict();
    expect(Object.keys(d.ru).length, "словарь TOAST_UI не прочитан").toBeGreaterThan(100);
    // контроль на известном ответе: русский литерал разбор ловит
    expect(russianLiterals('"Не удалось", x')).toEqual(["Не удалось"]);
    expect(russianLiterals("TL.sendFail, `${a}`")).toEqual([]);
  });

  test("в showToast / setError / set…Error / set…Msg / confirm / serverError / throw new Error нет русских литералов", () => {
    const bad: string[] = [];
    for (const { fn, args } of callArgs(codeOutsideDictionaries())) {
      for (const t of russianLiterals(args)) bad.push(`${fn}(… ${t.slice(0, 70)} …)`);
    }
    expect(bad, "русский текст в вызове: перенесите в TOAST_UI (ru/en/kk) и вызывайте через TL.ключ").toEqual([]);
  });

  test("каждый TL.ключ и tlModule().ключ есть в ru, en и kk; en без кириллицы; kk не копия ru", () => {
    const d = toastDict();
    const src = codeOutsideDictionaries();
    const used = new Set<string>();
    for (const m of src.matchAll(/\bTL\.(\w+)/g)) used.add(m[1]);
    for (const m of src.matchAll(/\btlModule\(\)\.(\w+)/g)) used.add(m[1]);
    expect(used.size, "ключей не найдено — разбор сломан").toBeGreaterThan(100);
    const missing: string[] = [];
    const cyrEn: string[] = [];
    const copyKk: string[] = [];
    const holes: string[] = [];
    for (const k of used) {
      for (const lang of ["ru", "en", "kk"] as const) if (!d[lang][k]) missing.push(`${lang}.${k}`);
      if (d.en[k] && CYR.test(d.en[k])) cyrEn.push(k);
      if (d.kk[k] && d.ru[k] && d.kk[k] === d.ru[k]) copyKk.push(k);
      // подстановки {name} должны совпадать во всех трёх языках
      const ph = (s: string) => [...(s ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
      if (d.ru[k] && (ph(d.ru[k]) !== ph(d.en[k]) || ph(d.ru[k]) !== ph(d.kk[k]))) holes.push(k);
    }
    expect(missing, "ключ используется, но не заведён во всех трёх языках").toEqual([]);
    expect(cyrEn, "английский текст с кириллицей").toEqual([]);
    expect(copyKk, "казахский текст совпадает с русским — это копия, не перевод").toEqual([]);
    expect(holes, "наборы {подстановок} в ru/en/kk расходятся").toEqual([]);
  });

  test("в en и kk у ключей нет лишнего: тот же набор ключей, что в ru", () => {
    const d = toastDict();
    const ru = Object.keys(d.ru).sort();
    expect(Object.keys(d.en).sort()).toEqual(ru);
    expect(Object.keys(d.kk).sort()).toEqual(ru);
  });
});
