import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFY_DICT, VERIFY_KEYS, tVerify } from "../verify/[id]/i18n";

/**
 * 20.10.2026, окно «Приложения», развилка 2 по слову оркестратора: публичная
 * страница проверки /qsign/verify/[id] была целиком английской при любом языке
 * посетителя. Строки ушли в verify/[id]/i18n.ts (ru/en/kk; имя i18n.* читает сторож everyCalledKeyExists); серверная
 * страница берёт язык из getServerLang() (кука → Accept-Language), клиентские
 * кнопки — из useI18nOptional. Сторож — тот же, что у pageSpeaksVisitorLanguage:
 * ключи переведены и не равны английскому, подстановки совпадают, в разметке нет
 * английских текстовых узлов, контроль детектора — одна возвращённая фраза.
 */

const DIR = join(__dirname, "..", "verify", "[id]");
const PAGE = readFileSync(join(DIR, "page.tsx"), "utf8");
const BITS = readFileSync(join(DIR, "ClientBits.tsx"), "utf8");

const LATIN_OK = new Set([
  "qsign", "aevion", "planet", "hmac", "sha", "ed25519", "rfc", "jcs", "json", "utc", "api",
  "public", "id",
]);
function englishWords(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/[A-Za-z][A-Za-z’']{2,}/g)) {
    const w = m[0].toLowerCase().replace(/[’']/g, "");
    if (!LATIN_OK.has(w)) out.push(m[0]);
  }
  return out;
}
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}
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

describe("/qsign/verify/[id] говорит на языке посетителя", () => {
  test("у каждого ключа есть ru и kk, не равные английскому", () => {
    const same: string[] = [];
    for (const k of VERIFY_KEYS) {
      const en = tVerify("en", k);
      for (const lang of ["ru", "kk"] as const) {
        const v = VERIFY_DICT[lang]?.[k];
        if (!v || v === en) same.push(`${lang}:${k}`);
      }
    }
    expect(same, `ключи без перевода (всего ${VERIFY_KEYS.length})`).toEqual([]);
    expect(VERIFY_KEYS.length).toBeGreaterThan(40);
  });

  test("подстановки {name} в ru/kk совпадают с en", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const bad: string[] = [];
    for (const k of VERIFY_KEYS) {
      const en = vars(tVerify("en", k));
      for (const lang of ["ru", "kk"] as const) if (vars(VERIFY_DICT[lang]![k]) !== en) bad.push(`${lang}:${k}`);
    }
    expect(bad).toEqual([]);
  });

  test("неизвестный язык и отсутствие языка дают английский", () => {
    expect(tVerify("de", "banner.valid")).toBe("VALID SIGNATURE");
    expect(tVerify(undefined, "banner.valid")).toBe("VALID SIGNATURE");
    expect(tVerify("ru", "meta.desc", { id: "abc", status: "x" })).toBe("Подпись abc · x");
  });

  test("в page.tsx и ClientBits.tsx нет английских текстовых узлов", () => {
    expect(jsxTextLines(PAGE), "page.tsx").toEqual([]);
    expect(jsxTextLines(BITS), "ClientBits.tsx").toEqual([]);
  });

  test("ни строки баннера, ни статусы, ни метаданные не зашиты по-английски", () => {
    for (const s of ['"VALID SIGNATURE"', '"REVOKED"', '"not checked"', '"Signature not found"', 'title: "QSign verification — AEVION"', '"Link copied"', '"Share"']) {
      expect(PAGE + BITS, s).not.toContain(s);
    }
  });

  test("страница берёт язык сервером (getServerLang) и зовёт словарь; все ключи существуют", () => {
    expect(PAGE).toContain("getServerLang()");
    expect(PAGE).toContain('from "./i18n"');
    expect(BITS).toContain("useI18nOptional()");
    const keys = new Set<string>(VERIFY_KEYS);
    const called = [...(PAGE + BITS).matchAll(/\b(?:t|tVerify)\((?:lang, )?"([a-z]+\.[A-Za-z0-9.]+)"/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThanOrEqual(40);
    expect(called.filter((k) => !keys.has(k))).toEqual([]);
  });

  test("контроль: детектор видит английский, когда он есть", () => {
    expect(jsxTextLines(PAGE.replace('{t("geo.none")}', "No geo data attached to this signature."))).toEqual([
      "No geo data attached to this signature.",
    ]);
    expect(jsxTextLines('<b>Share this link</b><i>{t("x.y")}</i><u>AEVION Planet</u>')).toEqual(["Share this link"]);
  });
});
