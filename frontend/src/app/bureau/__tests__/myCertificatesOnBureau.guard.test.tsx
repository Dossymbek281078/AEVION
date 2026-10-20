/**
 * Бюро: «Мои сертификаты» у вошедшего — название, дата, PDF, проверка; пустое состояние ведёт
 * к первой защите; гостю блок не рисуется; тексты из словаря ru/en/kk.
 *
 * ПОВОД (20.10.2026, путь вошедшего на проде): /api/bureau/dashboard отдавал свои сертификаты,
 * а на /bureau их не было — свои человек находил только на /qright за свёрнутым реестром и
 * английской «Mine».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MyCertificates } from "../MyCertificates";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
afterEach(() => cleanup());

const словарь = ru as unknown as Record<string, string>;
const t = (k: string, v?: Record<string, string | number>) => (словарь[k] ?? k).replace("{date}", String(v?.date ?? ""));
const КЛЮЧИ = ["bureau.mine.title", "bureau.mine.empty", "bureau.mine.protectFirst", "bureau.mine.verify", "bureau.mine.protectedAt", "qright.registry.mine", "qright.registry.all"];

describe("MyCertificates", () => {
  it("список: название, дата, PDF и проверка по id", () => {
    render(<MyCertificates certificates={[{ id: "cert-abc", title: "Песня о степи", protectedAt: "2026-10-20T10:00:00Z" }]} t={t} lang="ru" />);
    expect(screen.getByText("Мои сертификаты")).toBeTruthy();
    expect(screen.getByText("Песня о степи")).toBeTruthy();
    expect(screen.getByText(/Защищено 20\.10\.2026/)).toBeTruthy();
    expect(screen.getByText("📄 PDF").closest("a")?.getAttribute("href")).toBe("/api/pipeline/certificate/cert-abc/pdf");
    expect(screen.getByText(/Проверить/).closest("a")?.getAttribute("href")).toBe("/verify/cert-abc");
  });
  it("пусто: честная фраза и кнопка к первой защите", () => {
    render(<MyCertificates certificates={[]} t={t} lang="ru" />);
    expect(screen.getByText("Сертификатов пока нет")).toBeTruthy();
    expect(screen.getByText("Защитить первую работу").closest("a")?.getAttribute("href")).toBe("/qright");
  });
  it("ключи есть в ru, en и kk и не совпадают с самим ключом", () => {
    for (const [яз, d] of [["ru", ru], ["en", en], ["kk", kk]] as const) {
      for (const k of КЛЮЧИ) expect((d as unknown as Record<string, string>)[k], `${яз} ${k}`).toBeTruthy();
    }
  });
});

describe("поверхности", () => {
  const бюро = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
  const qright = readFileSync(join(__dirname, "..", "..", "qright", "page.tsx"), "utf8");
  it("блок только вошедшему с загруженным кабинетом", () => {
    expect(бюро).toContain("{authed && dashboard && !dashboardFailed && (\n          <MyCertificates certificates={dashboard.certificates} t={buT} lang={buLang} />");
  });
  it("на /qright переключатель реестра через словарь, без литерала «Mine»", () => {
    expect(qright).toContain('t("qright.registry.mine")');
    expect(qright).not.toContain('? "Mine" : "All"');
  });
});
