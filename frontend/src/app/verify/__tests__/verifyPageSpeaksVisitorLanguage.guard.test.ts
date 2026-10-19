/**
 * 🔴 19.10.2026, заявка Продаж: /verify/<cert> при выбранном RU был целиком английским
 * (111 строк «только латиница» из 178; письма 6 бюро ведут ровно сюда). Теперь подписи
 * страницы идут через tv(lang, …) со словарём ru/kk; хеши и алгоритмы не переводятся.
 * Плюс: /ru/verify/<cert> → редирект на /verify (был 404); кнопки контакта несут topic=bureau.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tv, VERIFY_DICT, verifyDictCoverage } from "../[id]/verifyI18n";

const SRC = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");
const VERDICT = readFileSync(join(__dirname, "..", "[id]", "integrityVerdict.ts"), "utf8");

describe("страница проверки говорит на языке посетителя", () => {
  it("словари ru и kk непусты и покрывают одни и те же ключи", () => {
    const c = verifyDictCoverage();
    expect(c.ru).toBeGreaterThan(80);
    expect(c.kk).toBe(c.ru);
    expect(Object.keys(VERIFY_DICT.ru!).sort()).toEqual(Object.keys(VERIFY_DICT.kk!).sort());
  });
  it("tv: перевод есть — отдаёт его; нет — английский источник, не пустоту", () => {
    expect(tv("ru", "Certificate Verified")).toBe("Сертификат проверен");
    expect(tv("kk", "Certificate Verified")).toBe("Сертификат тексерілді");
    expect(tv("en", "Certificate Verified")).toBe("Certificate Verified");
    expect(tv("ru", "SHA-256 of nothing")).toBe("SHA-256 of nothing");
    expect(tv(undefined, "Copy")).toBe("Copy");
  });
  it("вердикт и все три его тела переведены (ключи — строки из integrityVerdict.ts)", () => {
    const bodies = [...VERDICT.matchAll(/body: "([^"]+)"/g)].map((m) => m[1]);
    const titles = [...new Set([...VERDICT.matchAll(/title: "([^"]+)"/g)].map((m) => m[1]))];
    expect(bodies.length).toBeGreaterThanOrEqual(3);
    for (const b of bodies) expect(tv("ru", b), `нет ru для тела вердикта: ${b.slice(0, 50)}`).not.toBe(b);
    for (const t of titles) expect(tv("ru", t), `нет ru для заголовка ${t}`).not.toBe(t);
    expect(SRC).toContain("{tv(lang, banner.title)}");
    expect(SRC).toContain("{tv(lang, banner.body)}");
  });
  it("подписи проверок целостности идут через словарь; хеши и алгоритмы остаются значениями", () => {
    const labels = [...new Set([...VERDICT.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]))];
    expect(labels.length).toBeGreaterThanOrEqual(6);
    for (const l of labels) expect(tv("ru", l), `нет ru для проверки «${l}»`).not.toBe(l);
    expect(SRC).toContain(">{tv(lang, check.label)}<");
    for (const k of Object.keys(VERIFY_DICT.ru!)) expect(k, "в словаре хеш/алгоритм как ключ").not.toMatch(/^(SHA-256|HMAC-SHA256|Ed25519|Shamir|OpenTimestamps|CID)$/);
  });
  it("на странице не осталось голых английских подписей разделов и кнопок", () => {
    for (const en of ["How to read this page", "Integrity Checks", "Legal Basis", "Independent of AEVION", "Cryptographic Proof", "🛡️ Protect your own work in a minute", "💳 Ask about pricing", "Go to AEVION", "Verification Failed"]) {
      expect(SRC, `«${en}» без tv()`).not.toMatch(new RegExp(">\\s*" + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*<|^\\s*" + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m"));
      expect(SRC).toContain(`tv(lang, ${JSON.stringify(en)})`);
    }
    expect(SRC).toContain("const lang = useI18nOptional()?.lang;");
  });
  it("кнопки контакта несут topic=bureau; /ru/verify ведёт на /verify", () => {
    expect(SRC).toContain('"/pricing/contact?topic=bureau&app=ip_bureau"');
    expect(SRC).toContain('"/pricing/contact?topic=bureau&app=ip_bureau&tier=lite"');
    expect(SRC).not.toContain('"/pricing/contact?app=ip_bureau"');
    const ru = join(__dirname, "..", "..", "ru", "verify", "[id]", "page.tsx");
    expect(existsSync(ru)).toBe(true);
    const r = readFileSync(ru, "utf8");
    expect(r).toContain("redirect(`/verify/${encodeURIComponent(id)}");
  });
});
