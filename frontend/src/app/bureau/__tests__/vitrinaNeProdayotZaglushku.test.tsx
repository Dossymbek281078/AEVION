// Витрина /bureau не продаёт того, чего нет.
//
// Замер прода 30.10.2026:
//   GET https://api.aevion.app/api/bureau/health
//   -> {"kyc":"stub","payment":"stub","pricing":{"verifiedTierCents":2900}}
//
// Страница /bureau/upgrade/<cert> в это время честно говорила «This tier cannot
// be completed yet… Nothing will be charged», а блок «Уровни услуг» на той же
// витрине звал: «От $89 за сертификат», «Выбрать сертификат для повышения»,
// «выберите нотариуса и отправьте запрос». Решение Оркестратора: пока kyc или
// payment = stub (или health не ответил) — ни цены, ни призыва; вместо них
// честная строка и форма раннего доступа (тот же компонент, что на /qright).
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./../page";
import { tiersSellable } from "../verifiedCta";
import { BUREAU_TEXT } from "../bureauText";

const ЦЕНА_89 = /\$89/;
const ПРИЗЫВ_VERIFIED = /Pick a cert to upgrade/i;
const ПРИЗЫВ_NOTARIZED = /select a notary and submit a request/i;
const ЧЕСТНО = /still being connected/i;

function stub(health: Record<string, unknown> | "down") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bureau/health")) {
        if (health === "down") return { ok: false, status: 503, json: async () => ({ error: "down" }) };
        return { ok: true, status: 200, json: async () => health };
      }
      if (u.includes("/api/bureau/notaries")) return { ok: true, status: 200, json: async () => ({ notaries: [] }) };
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

/** Поле почты формы раннего доступа — то, что человек видит вместо «купить». */
const emailField = () => document.querySelector('#tiers-waitlist input[type="email"]');

describe("витрина /bureau при заглушке kyc/payment не продаёт платные уровни", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("решение — одна функция: готово только при живых ОБОИХ барьерах", () => {
    expect(tiersSellable("live", "live")).toBe(true);
    expect(tiersSellable("stub", "stub")).toBe(false);
    expect(tiersSellable("live", "stub")).toBe(false);
    expect(tiersSellable("stub", "live")).toBe(false);
    expect(tiersSellable(null, null)).toBe(false);
    expect(tiersSellable("misconfigured", "live")).toBe(false);
    expect(tiersSellable("live", undefined)).toBe(false);
  });

  test("🔴 как на проде 30.10 (kyc и payment = stub): нет $89, нет призыва повысить — есть честная строка и форма", async () => {
    stub({ kyc: "stub", payment: "stub", pricing: { verifiedTierCents: 2900 } });
    renderPage();
    // Ждём, пока ответ health применится: заглушка названа заглушкой в тексте тарифа.
    await waitFor(() => expect(screen.queryByText(/no document is actually verified yet/i)).not.toBeNull());

    expect(screen.queryByText(ЦЕНА_89), "цена нотариальной соподписи при заглушке кассы").toBeNull();
    expect(screen.queryByText(ПРИЗЫВ_VERIFIED), "призыв выбрать сертификат при заглушке KYC").toBeNull();
    expect(screen.queryByText(ПРИЗЫВ_NOTARIZED), "призыв отправить запрос нотариусу при заглушке").toBeNull();
    expect(screen.getAllByText(ЧЕСТНО).length, "честная строка в карточках и над формой").toBeGreaterThanOrEqual(2);
    expect(emailField(), "форма раннего доступа вместо продажи").not.toBeNull();
    // Ссылка из карточки ведёт к форме на этой же странице.
    expect(document.querySelector('a[data-tier-wait="Verified"]')?.getAttribute("href")).toBe("#tiers-waitlist");
    expect(document.querySelector('a[data-tier-wait="Notarized"]')?.getAttribute("href")).toBe("#tiers-waitlist");
  });

  test("health недоступен — тоже «не готово»: ни цены, ни призыва", async () => {
    stub("down");
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/by request/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(ЦЕНА_89)).toBeNull();
    expect(screen.queryByText(ПРИЗЫВ_VERIFIED)).toBeNull();
    expect(screen.queryByText(ПРИЗЫВ_NOTARIZED)).toBeNull();
    expect(emailField()).not.toBeNull();
  });

  test("только один барьер живой (kyc live, payment stub) — всё ещё не продаём", async () => {
    stub({ kyc: "live", payment: "stub" });
    renderPage();
    await waitFor(() => expect(screen.queryByText(/available now/i)).not.toBeNull());
    expect(screen.queryByText(ЦЕНА_89)).toBeNull();
    expect(screen.queryByText(ПРИЗЫВ_VERIFIED)).toBeNull();
    expect(emailField()).not.toBeNull();
  });

  test("оба барьера живые — цена и призыв на месте, формы ожидания нет", async () => {
    stub({ kyc: "live", payment: "live", pricing: { verifiedTierCents: 2900 } });
    renderPage();
    await waitFor(() => expect(screen.queryByText(ПРИЗЫВ_VERIFIED)).not.toBeNull());
    expect(screen.queryByText(ЦЕНА_89)).not.toBeNull();
    expect(screen.queryByText(ПРИЗЫВ_NOTARIZED)).not.toBeNull();
    expect(screen.queryByText(ЧЕСТНО)).toBeNull();
    expect(emailField()).toBeNull();
  });

  test("честные строки переведены на ru и kk и не содержат цены", () => {
    const ключи = Object.keys(BUREAU_TEXT).filter((k) => /still being connected|notary co-signing opens|Nothing is charged today/i.test(k));
    expect(ключи.length).toBe(5);
    for (const k of ключи) {
      expect(BUREAU_TEXT[k].ru, k).toMatch(/[А-Яа-яЁё]/);
      expect(BUREAU_TEXT[k].kk, k).toMatch(/[А-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ]/);
      expect(BUREAU_TEXT[k].ru + BUREAU_TEXT[k].kk + k).not.toContain("$");
    }
  });
});
