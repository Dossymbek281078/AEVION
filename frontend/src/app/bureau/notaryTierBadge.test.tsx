// Тариф «Notarized» называл себя «▲ live» при ПУСТОМ реестре нотариусов.
//
// Замер на проде 21.08.2026: GET /api/bureau/notaries отвечает {"notaries":[]}.
// Человек читал «в прямом эфире», видел цену «От $89», нажимал «View Notary
// Registry» и попадал в пустоту. Пометка была зашита строкой и потому не могла
// ошибиться заметно: она утверждала одно и то же при любом состоянии реестра.
//
// Три исхода, а не два. Пустой реестр — «by request». Непустой — «live».
// А вот «спросить не удалось» (сеть, 500, чужой ответ) — это НЕ ноль: понижать
// тариф из-за собственной неудачи нельзя, иначе один сбой сети выглядит как
// закрытие услуги. Ровно этот третий случай и проверяется отдельно.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./page";

const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

/** Отвечает на запрос реестра тем, что попросили; остальным ручкам — пусто. */
function stubNotaries(reply: "empty" | "two" | "network-error" | "http-500" | "garbage") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bureau/notaries")) {
        if (reply === "network-error") throw new Error("ECONNRESET");
        if (reply === "http-500") return { ok: false, status: 500, json: async () => ({ error: "boom" }) };
        if (reply === "garbage") return { ok: true, status: 200, json: async () => ({ ok: true }) };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            notaries: reply === "two" ? [{ id: "n1", name: "Нотариус А" }, { id: "n2", name: "Нотариус Б" }] : [],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

/** Пометка тарифа «Notarized» — соседний по разметке элемент его названия. */
async function badgeText(): Promise<string> {
  const name = await screen.findByText("Notarized");
  const row = name.parentElement;
  const badge = row?.lastElementChild;
  return (badge?.textContent || "").trim();
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Бюро: пометка тарифа Notarized идёт от реестра, а не от строки в коде", () => {
  test("контроль: тариф вообще есть на странице и у него есть пометка", async () => {
    stubNotaries("two");
    renderPage();
    const t = await badgeText();
    expect(t.length, "пометка не найдена — тест ничего не проверял бы").toBeGreaterThan(0);
  });

  test("реестр пуст — тариф НЕ называется live", async () => {
    stubNotaries("empty");
    renderPage();
    await waitFor(async () => {
      expect(await badgeText()).toMatch(/by request/i);
    });
    expect(await badgeText()).not.toMatch(/live/i);
  });

  test("в реестре есть нотариусы — тариф называется live", async () => {
    stubNotaries("two");
    renderPage();
    await waitFor(async () => {
      expect(await badgeText()).toMatch(/live/i);
    });
  });

  test.each(["network-error", "http-500", "garbage"] as const)(
    "спросить не удалось (%s) — пометка НЕ понижается: «не знаю» это не «ноль»",
    async (reply) => {
      stubNotaries(reply);
      renderPage();
      // Дать обработчику ответа отработать, чтобы проверка не прошла просто
      // потому, что запрос ещё в полёте.
      await screen.findByText("Notarized");
      await new Promise((r) => setTimeout(r, 30));
      const t = await badgeText();
      expect(t, "собственный сбой выдан за отсутствие услуги").not.toMatch(/by request/i);
      expect(t).toMatch(/live/i);
    },
  );
});
