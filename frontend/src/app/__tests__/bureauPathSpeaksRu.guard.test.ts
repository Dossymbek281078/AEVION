import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tv } from "../verify/[id]/verifyI18n";
import { tCert, CERT_TEXT } from "../bureau/cert/[certId]/certText";
import { tNot, NOTARIES_TEXT } from "../bureau/notaries/notariesText";
import { tq } from "../qright/qrightI18n";

// 30.10.2026, замер прода: ru-страницы пути «бюро» показывали английские узлы —
// плитки /verify, весь /bureau/cert, /bureau/notaries, «registered · active»
// на /qright. Сторож читает исходник: перечисленные литералы напрямую не выводятся.
const read = (...p: string[]) =>
  readFileSync(join(__dirname, "..", ...p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("путь бюро говорит по-русски", () => {
  test("/verify: плитки целостности, тип работы и «не найден» идут через tv", () => {
    const page = read("verify", "[id]", "page.tsx");
    expect(page).toContain('tv(lang, error || "Certificate not found")');
    expect(page).not.toMatch(/\{error \|\| tv\(/);
    expect(page).toContain("tv(lang, KIND_LABELS[cert.kind] || cert.kind)");
    expect(page).toContain("tv(lang, check.detail)");
    for (const s of [
      "SHA-256 verified",
      "HMAC-SHA256 re-verified",
      "Signed under v1 · current key",
      "Status: active",
      "Verified · author key ed25519:abcd",
      "Text / Article",
      "Certificate not found or invalid",
    ]) {
      expect(tv("ru", s), s).not.toBe(s);
      expect(tv("kk", s), s).not.toBe(s);
      expect(tv("en", s), s).toBe(s);
    }
    expect(tv("ru", "Signed under v1 · current key")).toBe("Подписано ключом v1 · текущий ключ");
  });

  test("/bureau/cert: английские узлы больше не выводятся напрямую", () => {
    const page = read("bureau", "cert", "[certId]", "page.tsx");
    for (const lit of [
      />\s*Author identity has not been verified\.\s*</,
      />\s*Protected on\s*</,
      />\s*Embed badge →\s*</,
      />\s*Embed JSON ↗\s*</,
      />\s*Public badge\s*</,
      />\s*Certificate ID\s*</,
      />\s*\{theme\.label\}\s*</,
      /\{KIND_LABELS\[data\.kind\] \|\| data\.kind\}/,
    ]) expect(page, String(lit)).not.toMatch(lit);
    expect(tCert("ru", "ANONYMOUS")).not.toBe("ANONYMOUS");
    for (const [k, v] of Object.entries(CERT_TEXT)) {
      expect(v.ru && v.kk, k).toBeTruthy();
    }
  });

  test("/bureau/notaries: заголовок, пустое состояние и «как работает» переведены", () => {
    const page = read("bureau", "notaries", "page.tsx");
    for (const lit of [
      />Notary Registry</,
      />No notaries found</,
      />How Notarized tier works</,
      /<li>Your certificate must first reach/,
      /: "The notary registry is empty/,
    ]) expect(page, String(lit)).not.toMatch(lit);
    expect(page).toMatch(/translate="no"[^>]*>Verified<\/span>/);
    expect(tNot("ru", "Notary Registry")).toBe("Реестр нотариусов");
    for (const [k, v] of Object.entries(NOTARIES_TEXT)) expect(v.ru && v.kk, k).toBeTruthy();
  });

  test("/bureau: «3-Layer» и автор карточки идут через tb", () => {
    const page = read("bureau", "page.tsx");
    expect(page).not.toMatch(/value: "3-Layer"/);
    expect(page).not.toMatch(/>by \{cert\.author\}/);
  });

  test("/qright: registered/active, ссылка на реестр и язык виджета конституции", () => {
    const page = read("qright", "page.tsx");
    expect(page).not.toMatch(/<\/strong> registered/);
    expect(page).not.toMatch(/<\/strong> active\s*$/m);
    expect(page).not.toMatch(/<\/span> View QRight Registry/);
    expect(page).toMatch(/<ConstitutionEmbed[\s\S]*?lang=\{lang === "ru"/);
    for (const k of ["registered", "active", "View QRight Registry"]) {
      expect(tq("ru", k), k).not.toBe(k);
      expect(tq("kk", k), k).not.toBe(k);
    }
  });
});
