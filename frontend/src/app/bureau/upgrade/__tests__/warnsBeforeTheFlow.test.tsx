// Отказ должен наступать на ВХОДЕ, а не в конце потока.
//
// Бэкенд с 29.08 не выдаёт платный тариф, пока хоть один барьер
// демонстрационный (см. paidTierNeedsRealProviders.test.ts). Без этой правки
// человек проходил бы проверку личности и оплату и только на последнем шаге
// получал 503 — потраченное впустую время и справедливое недоверие.
//
// Направление умолчания здесь ОБРАТНОЕ тому, что у обещаний на витрине:
// вопрос «останавливать ли человека», и на незнании останавливать нельзя.
// Прод сегодня полей состояния не отдаёт вовсе — блокировка по незнанию
// закрыла бы тариф всем и выглядела бы как поломка.
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau/upgrade/cert-1",
  // Страница лежит в маршруте [certId] и читает его через useParams —
  // без этого мок падает ещё до отрисовки, и все случаи краснеют одинаково.
  useParams: () => ({ certId: "cert-1" }),
}));

import { ToastProvider } from "@/components/ToastProvider";
import UpgradePage from "../[certId]/page";

const WARNING = /This tier cannot be completed yet/i;

function stubHealth(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bureau/health"))
        return { ok: true, status: 200, json: async () => body };
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

describe("страница оплаты предупреждает до начала, а не после", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test.each([
    ["личность — заглушка", { kyc: "stub", payment: "live" }],
    ["деньги — заглушка", { kyc: "live", payment: "stub" }],
    ["оба демонстрационные", { kyc: "stub", payment: "stub" }],
    ["деньги настроены неверно", { kyc: "live", payment: "misconfigured" }],
  ] as Array<[string, Record<string, unknown>]>)(
    "%s — предупреждение показано",
    async (_n, body) => {
      stubHealth({ status: "ok", ...body });
      render(<ToastProvider><UpgradePage /></ToastProvider>);
      await waitFor(() =>
        expect(
          screen.queryByText(WARNING),
          "человека пустили в поток, который заведомо не завершится",
        ).not.toBeNull(),
      );
    },
  );

  test("оба барьера настоящие — предупреждения нет", async () => {
    stubHealth({ status: "ok", kyc: "live", payment: "live" });
    render(<ToastProvider><UpgradePage /></ToastProvider>);
    await waitFor(() => expect(screen.queryByText(/What you/i)).not.toBeNull());
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  test("запрос состояния УПАЛ — тоже не останавливаем", async () => {
    // Именно этот случай проверяет НАЧАЛЬНОЕ значение: когда ответа нет вовсе,
    // эффект его не перезапишет, и умолчание становится единственным решением.
    // Без этой проверки мутация `useState(false)` -> `useState(true)` проходит
    // незамеченной: во всех остальных случаях ответ приходит и всё исправляет.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    render(<ToastProvider><UpgradePage /></ToastProvider>);
    await waitFor(() => expect(screen.queryByText(/What you/i)).not.toBeNull());
    expect(
      screen.queryByText(WARNING),
      "своя неудача связи выдана за неработающий барьер",
    ).toBeNull();
  });

  test("состояние НЕИЗВЕСТНО (ответ прода сегодня) — НЕ останавливаем", async () => {
    // Это и есть проверка направления умолчания. Поля состояния прод не
    // отдаёт; останавливать по незнанию значило бы закрыть тариф всем.
    stubHealth({ status: "ok", service: "bureau" });
    render(<ToastProvider><UpgradePage /></ToastProvider>);
    await waitFor(() => expect(screen.queryByText(/What you/i)).not.toBeNull());
    expect(
      screen.queryByText(WARNING),
      "остановили человека на основании собственного незнания",
    ).toBeNull();
  });
});
