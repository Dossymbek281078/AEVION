// 30.10.2026: демо-записи реестра шли на одном языке независимо от языка страницы
// (en-страница — русские подписи, ru-страница — английские). Проверяем чистую функцию
// и то, что страница ею пользуется.
import { describe, expect, test, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ToastProvider";
import { ServerLangProvider } from "@/lib/serverLangContext";
import { demoRecordAuthor, demoRecordTitle } from "../demoRecords";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

// eslint-disable-next-line import/first
import BureauPage from "../page";

const СЕРВЕР = [
  "Demo record: proof of a work's creation date",
  "Демонстрация со-подписи автора: пример записи для партнёров",
  "Демонстрация бренда бюро: пример записи для партнёров",
];
const КИРИЛЛИЦА = /[А-Яа-яЁё]/;

describe("демо-записи реестра бюро", () => {
  test("на английской странице в подписях нет кириллицы", () => {
    for (const t of СЕРВЕР) expect(КИРИЛЛИЦА.test(demoRecordTitle(t, "en")), t).toBe(false);
    expect(КИРИЛЛИЦА.test(demoRecordAuthor("AEVION (demonstration for partner)", "en"))).toBe(false);
  });

  test("на русской странице подписи русские, без английского «Demo record»", () => {
    for (const t of СЕРВЕР) {
      const r = demoRecordTitle(t, "ru");
      expect(КИРИЛЛИЦА.test(r), t).toBe(true);
      expect(r).not.toMatch(/Demo record/);
    }
    expect(demoRecordAuthor("AEVION (demonstration for partner)", "ru")).toBe("AEVION (демонстрация для партнёра)");
  });

  test("чужая запись не меняется ни на каком языке", () => {
    for (const l of ["en", "ru", "kk"]) {
      expect(demoRecordTitle("Моя песня", l)).toBe("Моя песня");
      expect(demoRecordTitle("toString", l)).toBe("toString");
      expect(demoRecordAuthor("Ivan", l)).toBe("Ivan");
    }
  });
});

// Ответ прода /api/pipeline/certificates на 30.10.2026 (поля, нужные карточке реестра).
const ЗАПИСИ = [
  ["cert-9913a1d205a1bf95", СЕРВЕР[0], "AEVION (demo)"],
  ["cert-9c0df215c5d330e7", СЕРВЕР[1], "AEVION (demonstration for partner)"],
  ["cert-c6b05b8930357a03", СЕРВЕР[2], "AEVION"],
].map(([id, title, author]) => ({
  id, title, author, kind: "text", location: "Almaty, KZ", contentHash: id + "0".repeat(40), fileHash: null,
  protectedAt: "2026-10-20T09:01:43.324Z", verifiedCount: 1, shieldId: "qs-x", verifyUrl: "https://aevion.app/verify/" + id,
}));

function страница(lang: string) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true, status: 200,
    json: async () => (String(url).includes("/api/pipeline/certificates") ? { certificates: ЗАПИСИ } : {}),
  })) as unknown as typeof fetch);
  return render(
    <ServerLangProvider lang={lang}>
      <ToastProvider>
        <BureauPage />
      </ToastProvider>
    </ServerLangProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

describe("реестр на странице /bureau", () => {
  test("🔴 en-страница: карточки демо-записей без кириллицы", async () => {
    const { container } = страница("en");
    await waitFor(() => expect(container.textContent ?? "").toContain("Bureau brand demo"));
    const реестр = container.querySelector("#registry")?.textContent ?? "";
    expect(реестр).toContain("Author co-signature demo");
    expect(КИРИЛЛИЦА.test(реестр), реестр.match(/[^ ]*[А-Яа-яЁё][^ ]*/)?.[0]).toBe(false);
  });

  test("🔴 ru-страница: карточки демо-записей по-русски, без «Demo record» и «demonstration for partner»", async () => {
    const { container } = страница("ru");
    await waitFor(() => expect(container.textContent ?? "").toContain("Демонстрационная запись"));
    const реестр = container.querySelector("#registry")?.textContent ?? "";
    expect(реестр).not.toContain("Demo record");
    expect(реестр).not.toContain("demonstration for partner");
    expect(реестр).toContain("AEVION (демонстрация для партнёра)");
  });
});
