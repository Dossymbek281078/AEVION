import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AccountPage from "../page";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";

/**
 * Вернувшийся из кассы должен увидеть подтверждение, а не общую страницу.
 *
 * Замер 29.08.2026: после оплаты человек не возвращался НИКУДА — в ссылках
 * кассы нет адреса возврата, страниц «спасибо» нет (/thanks, /thank-you,
 * /success дают 404). Настройка возврата делается в кабинете поставщика, но
 * без этой правки она была бы бесполезна: `/account` не читала параметры
 * адреса ВООБЩЕ и встретила бы покупателя так же, как любого другого.
 *
 * Договор: касса возвращает на `/account?purchased=<id модуля>`.
 */

function stubFetch() {
  return vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ apps: [], user: null }),
  } as unknown as Response);
}

function withSearch(search: string) {
  const url = "https://aevion.app/account" + search;
  Object.defineProperty(window, "location", {
    value: new URL(url) as unknown as Location,
    writable: true,
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("возврат из кассы подтверждается", () => {
  it("контроль прибора: без метки страница ведёт себя как раньше", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("");
    render(<I18nProvider><ToastProvider><AccountPage /></ToastProvider></I18nProvider>);
    await waitFor(() => expect(document.body.textContent ?? "").toContain("Account"));
    expect(document.body.textContent ?? "", "подтверждение показано без покупки")
      .not.toContain("Спасибо за покупку");
  });

  it("с меткой возврата показывает подтверждение", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("?purchased=cyberchess");
    render(<I18nProvider><ToastProvider><AccountPage /></ToastProvider></I18nProvider>);
    await waitFor(() => {
      expect(document.body.textContent ?? "", "покупателя встретили как обычного посетителя")
        .toContain("Спасибо за покупку");
    });
  });
});
