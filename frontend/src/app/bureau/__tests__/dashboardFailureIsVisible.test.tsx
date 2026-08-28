// Панель бюро при неудачной загрузке НЕ рисовалась вовсе.
//
// Замер 28.08.2026, frontend/src/app/bureau/page.tsx:
//
//   if (r.ok) setDashboard(await r.json());   // не ok -> тишина
//   } catch {}                                // сеть упала -> тишина
//
// а весь блок стоял под условием `dashboard && dashboard.certificates.length > 0`.
// Следствие: вошедший человек с ОПЛАЧЕННЫМИ сертификатами открывал /bureau и
// видел страницу так, будто их у него нет. Три разные причины — истёкший вход,
// сбой сервиса, отсутствие сети — выглядели одинаково, и все три выглядели как
// «у вас ничего нет». На продукте, который продаёт доказательство авторства,
// это из самых тревожных экранов, какие можно показать.
//
// Здесь проверяется не текст, а РАЗЛИЧИМОСТЬ трёх исходов и то, что отказ
// вообще виден. Отдельно — что у НЕвошедшего посетителя ложной тревоги нет.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./../page";

const TOKEN_KEY = "aevion_auth_token_v1";
const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

/** Как ответит именно ручка панели; всем остальным — пустой успех. */
function stubDashboard(reply: "ok" | "401" | "500" | "network-error") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bureau/dashboard")) {
        if (reply === "network-error") throw new Error("ECONNRESET");
        if (reply === "401") return { ok: false, status: 401, json: async () => ({ error: "expired" }) };
        if (reply === "500") return { ok: false, status: 500, json: async () => ({ error: "boom" }) };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            certificates: [],
            verifications: [],
            trustEdges: [],
            pricing: { verifiedTierCents: 1900 },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

/**
 * Сообщение об отказе целиком. queryByText находит внутренний <b>, а
 * остальная фраза лежит в родителе — без подъёма проверка читала бы четверть
 * текста и «не нашла» подсказку, которая на экране есть.
 */
const failureText = (): HTMLElement | null => {
  const bold = screen.queryByText(/Не удалось загрузить ваши сертификаты/i);
  return bold ? (bold.parentElement ?? bold) : null;
};

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("бюро: неудачная загрузка панели видна, а не показана пустотой", () => {
  test("истёк вход (401) — отказ виден и подсказывает войти заново", async () => {
    localStorage.setItem(TOKEN_KEY, "stale-token");
    stubDashboard("401");
    renderPage();
    await waitFor(() => expect(failureText()).not.toBeNull());
    expect(failureText()!.textContent).toMatch(/войдите заново/i);
  });

  test("сбой сервиса (500) — отказ виден и НЕ советует входить заново", async () => {
    localStorage.setItem(TOKEN_KEY, "good-token");
    stubDashboard("500");
    renderPage();
    await waitFor(() => expect(failureText()).not.toBeNull());
    expect(failureText()!.textContent).not.toMatch(/войдите заново/i);
  });

  test("сети не было — отказ тоже виден", async () => {
    localStorage.setItem(TOKEN_KEY, "good-token");
    stubDashboard("network-error");
    renderPage();
    await waitFor(() => expect(failureText()).not.toBeNull());
  });

  test("отказ НЕ утверждает, что сертификатов нет", async () => {
    localStorage.setItem(TOKEN_KEY, "good-token");
    stubDashboard("500");
    renderPage();
    await waitFor(() => expect(failureText()).not.toBeNull());
    const t = failureText()!.textContent || "";
    // Смысл сообщения: это сбой загрузки, а не приговор данным.
    expect(t).toMatch(/сбой загрузки|ничего не потеряно/i);
  });

  test("контроль: панель загрузилась — никакого сообщения об отказе", async () => {
    localStorage.setItem(TOKEN_KEY, "good-token");
    stubDashboard("ok");
    renderPage();
    await screen.findByText("Notarized");
    await new Promise((r) => setTimeout(r, 30));
    expect(failureText()).toBeNull();
  });

  test("контроль: посетитель без входа — ложной тревоги нет", async () => {
    stubDashboard("500");
    renderPage();
    await screen.findByText("Notarized");
    await new Promise((r) => setTimeout(r, 30));
    expect(failureText()).toBeNull();
  });
});
