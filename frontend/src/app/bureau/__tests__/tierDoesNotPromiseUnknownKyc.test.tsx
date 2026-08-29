// Карточка платного тарифа обещала проверку личности, когда состояние барьера
// НЕИЗВЕСТНО.
//
// Замер 29.08.2026 на проде:
//
//   GET https://api.aevion.app/api/bureau/health
//   -> {"status":"ok","service":"bureau","timestamp":"..."}
//
// Полей `kyc` / `payment` там нет вовсе (сборка старше правки, которая их
// добавила). Значит на проде kycMode всегда null — а текст карточки был
// написан в ДВЕ ветки: «заглушка» и «всё остальное». Неизвестность попадала во
// вторую и утверждала: "Identity check performed by our KYC provider".
//
// Значок при этом честно говорил «by request». Два наших собственных ответа об
// одном и том же спорили на одном экране, и верили бы тому, что уверенней.
//
// Направление умолчания у значка и у текста ПРОТИВОПОЛОЖНОЕ: значок при
// незнании ничего не ломает, а текст при незнании обязан не обещать.
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./../page";

/** Обещание, которого нельзя давать, не зная состояния барьера. */
const PROMISE = /Identity check performed by our KYC provider/i;

function stubHealth(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bureau/health")) {
        return { ok: true, status: 200, json: async () => body };
      }
      if (u.includes("/api/bureau/notaries")) {
        return { ok: true, status: 200, json: async () => ({ notaries: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

describe("тариф с проверкой личности не обещает больше, чем известно", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("ответ КАК НА ПРОДЕ (без поля kyc) — обещания нет", async () => {
    stubHealth({ status: "ok", service: "bureau", timestamp: "2026-08-29T00:00:00.000Z" });
    render(<ToastProvider><BureauPage /></ToastProvider>);
    // Ждём, пока страница отрисуется и запрос состояния завершится.
    await waitFor(() => expect(screen.getAllByText(/request/i).length).toBeGreaterThan(0));
    expect(
      screen.queryByText(PROMISE),
      "неизвестное состояние барьера выдано за настроенную проверку паспорта",
    ).toBeNull();
  });

  test('состояние "live" — обещание уместно и присутствует', async () => {
    stubHealth({ status: "ok", service: "bureau", kyc: "live", payment: "live" });
    render(<ToastProvider><BureauPage /></ToastProvider>);
    await waitFor(() =>
      expect(
        screen.queryByText(PROMISE),
        "при настроенном поставщике обещание должно быть на месте",
      ).not.toBeNull(),
    );
  });

  test('состояние "stub" — заглушка названа заглушкой', async () => {
    stubHealth({ status: "ok", service: "bureau", kyc: "stub", payment: "stub" });
    render(<ToastProvider><BureauPage /></ToastProvider>);
    // Матчер именно по ТЕКСТУ карточки: слова «demo mode» есть ещё и в значке,
    // и широкий шаблон падал на «найдено несколько» — это была моя ошибка
    // измерения, а не продукта.
    await waitFor(() =>
      expect(
        screen.queryByText(/no document is actually verified yet/i),
        "заглушка обязана называть себя заглушкой в тексте тарифа",
      ).not.toBeNull(),
    );
    expect(screen.queryByText(PROMISE)).toBeNull();
  });

  test('новое состояние "misconfigured" не читается как настроенное', async () => {
    // Бэкенд с 29.08 умеет третий исход: имя поставщика задано, но фабрика на
    // нём падает. Для витрины это такое же «не знаю», как отсутствие поля.
    stubHealth({ status: "ok", service: "bureau", kyc: "misconfigured" });
    render(<ToastProvider><BureauPage /></ToastProvider>);
    await waitFor(() => expect(screen.getAllByText(/request/i).length).toBeGreaterThan(0));
    expect(screen.queryByText(PROMISE)).toBeNull();
  });
});
