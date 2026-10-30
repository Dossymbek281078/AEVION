// 30.10.2026, прод /bureau/upgrade/<certId> на ru: страница повышения ЦЕЛИКОМ
// по-английски — «UPGRADE TO VERIFIED», «Certify your real-name authorship»,
// «This tier cannot be completed yet», «Start identity check →», тосты.
// Соседняя /bureau переведена через tb("…") и bureauText.ts; страница
// повышения — это шаг, где человек ПЛАТИТ, и читать его он должен на своём языке.
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUREAU_TEXT } from "../../bureauText";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau/upgrade/cert-1",
  useParams: () => ({ certId: "cert-1" }),
}));

// Посетитель с языком ru. Остальное из i18n — как есть.
vi.mock("@/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n")>()),
  useI18nOptional: () => ({
    lang: "ru",
    setLang: vi.fn(),
    t: (k: string) => k,
    langReady: true,
  }),
}));

import { ToastProvider } from "@/components/ToastProvider";
import UpgradePage from "../[certId]/page";

function stubHealth(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/bureau/health"))
        return { ok: true, status: 200, json: async () => body };
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

// Английские заголовки, которые прод 30.10 показывал русскому посетителю.
const АНГЛИЙСКИЕ = [
  /UPGRADE TO VERIFIED/,
  /Certify your real-name authorship/i,
  /This tier cannot be completed yet/i,
  /Start identity check/i,
  /What you'll do/i,
  /Identity-verified certificates carry stronger evidentiary weight/i,
];

describe("страница повышения говорит по-русски с посетителем ru", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("на ru нет английских заголовков, есть русский заголовок", async () => {
    // kyc: stub — чтобы на экране был и жёлтый блок «тариф пока не завершить».
    stubHealth({ status: "ok", kyc: "stub", payment: "stub" });
    render(<ToastProvider><UpgradePage /></ToastProvider>);
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeNull(),
    );
    const html = document.body.textContent ?? "";
    for (const re of АНГЛИЙСКИЕ) {
      expect(html, `английская строка на ru: ${re}`).not.toMatch(re);
    }
    expect(html).toMatch(/Повышение до Verified/i);
    expect(html).toMatch(/Что вы сделаете/i);
    expect(screen.getByRole("button", { name: /проверк/i })).toBeTruthy();
  });

  test("у каждого tb(\"…\") страницы повышения есть перевод ru и kk", () => {
    const src = readFileSync(join(__dirname, "..", "[certId]", "page.tsx"), "utf8");
    const код = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const ключи = [...код.matchAll(/tb\("((?:[^"\\]|\\.)*)"\)/g)].map((m) => m[1].replace(/\\"/g, '"'));
    expect(ключи.length, "знаменатель: строк через tb на странице повышения").toBeGreaterThan(40);
    const без = ключи.filter((k) => !BUREAU_TEXT[k]?.ru || !BUREAU_TEXT[k]?.kk);
    expect(без).toEqual([]);
  });

  test("в разметке страницы повышения нет английских надписей-литералов", () => {
    const src = readFileSync(join(__dirname, "..", "[certId]", "page.tsx"), "utf8");
    const код = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const ОСТАВИТЬ = new Set(["Verified", "Notarized"]);
    const текст = [...код.matchAll(/>\s*([^<>{}]*[A-Za-z]{3,}[^<>{}]*?)\s*</g)]
      .map((m) => m[1].trim())
      .filter((x) => x && !ОСТАВИТЬ.has(x) && !/[;=()]/.test(x) && !/[А-Яа-яЁё]/.test(x));
    expect(текст).toEqual([]);
  });
});
