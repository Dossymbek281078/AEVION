// Страница проверки чека на /en: заголовок, пояснения, placeholder, кнопки и ошибка разбора — без кириллицы.
// Замер 30.10.2026: русскими оставались «Проверка чека», два абзаца, placeholder, «Проверить», «…или выберите файл».
import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: "en", t: (k: string) => k }),
}));

import VerifyReceiptPage from "../verify/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("страница проверки чека на /en", () => {
  test("форма и ошибка разбора — без кириллицы", async () => {
    render(<VerifyReceiptPage />);
    expect(document.body.textContent, document.body.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
    const поле = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(`${поле.placeholder} ${поле.getAttribute("aria-label")}`).not.toMatch(/[А-Яа-яЁё]/);
    expect(document.body.textContent).toContain("Receipt check");

    fireEvent.change(поле, { target: { value: "this is not json at all" } });
    const кнопка = screen.getByRole("button") as HTMLButtonElement;
    await waitFor(() => expect(кнопка.disabled).toBe(false));
    fireEvent.click(кнопка);
    await screen.findByText(/not JSON/);
    expect(document.body.textContent, document.body.textContent ?? "").not.toMatch(/[А-Яа-яЁё]/);
  });
});
