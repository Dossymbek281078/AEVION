// Проверка чека на /en: запрос несёт язык страницы (сервер отдаёт signatureNote по полю lang),
// а блок результата не остаётся русским литералом.
// Замер 30.10.2026: POST /api/multichat/receipt/verify уходил без lang — на английской странице
// под «Подпись:» стояла русская оговорка сервера и русские подписи полей.
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: "en", t: (k: string) => k }),
}));

import VerifyReceiptPage from "../verify/page";

afterEach(() => vi.unstubAllGlobals());

describe("проверка чека на /en", () => {
  test("запрос на verify несёт lang=en, блок результата без кириллицы", async () => {
    const адреса: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      адреса.push(String(input));
      return {
        ok: true, status: 200,
        json: async () => ({
          hashMatches: true, computedHash: "ab".repeat(32), signature: "absent",
          signatureNote: "Signing key is not configured on this server.",
          spec: { canonicalization: "RFC8785", digest: "sha256", signature: "ed25519" },
        }),
      } as Response;
    }));
    render(<VerifyReceiptPage />);
    const поле = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(поле, { target: { value: JSON.stringify({ receipt: { askedAt: "x" }, hash: "ab".repeat(32) }) } });
    const кнопка = screen.getByRole("button");
    await waitFor(() => expect((кнопка as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(кнопка);
    await waitFor(() => expect(адреса.length).toBeGreaterThan(0));
    const адрес = адреса.find((a) => a.includes("/receipt/verify"))!;
    expect(адрес, "адрес проверки").toBeDefined();
    expect(адрес, "сервер не знает язык страницы").toMatch(/[?&]lang=en(&|$)/);

    const заголовок = await screen.findByRole("heading", { level: 2 });
    const блок = заголовок.parentElement as HTMLElement;
    expect(блок.textContent, блок.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
    expect(блок.textContent).toContain("Hash matches");
    expect(блок.textContent).toContain("Signature: absent");
  });
});
