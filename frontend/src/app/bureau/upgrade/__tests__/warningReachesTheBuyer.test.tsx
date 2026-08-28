// Предупреждение о демонстрационной заглушке обязано быть НА ЭКРАНЕ до оплаты,
// а не только в чистой функции. Карточку тарифа на /bureau я поправил часом
// раньше — и этого было мало: у каждой записи реестра своя кнопка «Обновить до
// Verified», ведущая сюда напрямую, мимо карточки.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ certId: "cert-upgrade-0001" }),
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau/upgrade/cert-upgrade-0001",
}));

import { ToastProvider } from "@/components/ToastProvider";
import UpgradePage from "../[certId]/page";

const renderPage = () => render(<ToastProvider><UpgradePage /></ToastProvider>);

function stubHealth(reply: "stub" | "live" | "network-error") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/bureau/health")) {
        if (reply === "network-error") throw new Error("ECONNRESET");
        return { ok: true, status: 200, json: async () => ({ kyc: reply }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

const PASSPORT = /passport|national ID/i;

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("страница оплаты $19 не обещает того, чего не делает", () => {
  test("поставщик — заглушка: предупреждение видно ДО оплаты", async () => {
    stubHealth("stub");
    renderPage();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toMatch(/before paying/i);
  });

  test("поставщик — заглушка: обещания про паспорт на экране НЕТ", async () => {
    stubHealth("stub");
    renderPage();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeNull());
    expect(document.body.textContent, "паспорт обещан при неподключённом поставщике").not.toMatch(PASSPORT);
  });

  test("заглушка: не выдумываем вендора, у которого «остаются документы»", async () => {
    stubHealth("stub");
    renderPage();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeNull());
    expect(document.body.textContent).not.toMatch(/KYC vendor|retention policy/i);
  });

  test("поставщик подключён: предупреждения нет, сильная формулировка на месте", async () => {
    stubHealth("live");
    renderPage();
    await waitFor(() => expect(document.body.textContent).toMatch(PASSPORT));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("спросить не удалось: паспорт не обещаем и заглушкой не пугаем", async () => {
    stubHealth("network-error");
    renderPage();
    await screen.findByText(/What you/i);
    await new Promise((r) => setTimeout(r, 40));
    expect(document.body.textContent, "необеспеченное обещание перед оплатой").not.toMatch(PASSPORT);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
