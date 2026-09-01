// Карточка нотариального тарифа обещала подпись Ed25519, а её значок «live»
// зависел ТОЛЬКО от непустого реестра нотариусов. Про саму подпись он не
// спрашивал вовсе.
//
// Чем это опасно. Без переменной BUREAU_NOTARY_SIGNING_KEY бюро подписывает
// нотаризацию так (aevion-globus-backend/src/routes/bureau.ts):
//
//   crypto.createHmac("sha256", notaryPublicKey || "demo-key")
//   -> { algorithm: "demo-hmac-sha256" }
//
// то есть HMAC на ПУБЛИЧНОМ ключе нотариуса — такую подпись может пересчитать
// кто угодно, у кого есть тот же публичный ключ. Называть это криптографической
// нотаризацией нельзя.
//
// Сегодня дефект СПИТ: реестр пуст, значок и так говорит «by request». Он
// проснётся ровно в день, когда добавят первого нотариуса, — то есть на
// запуске. Такие находки («страшный класс, закрытый другим дефектом») стоит
// закрывать до того, как второе условие изменится.
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./../page";

const ED25519_PROMISE = /co-signs the certificate with Ed25519/i;

function stub(health: Record<string, unknown>, notaries: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bureau/health"))
        return { ok: true, status: 200, json: async () => health };
      if (u.includes("/api/bureau/notaries"))
        return { ok: true, status: 200, json: async () => ({ notaries }) };
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

const ONE_NOTARY = [{ id: "n1", name: "Notary One" }];

describe("обещание Ed25519 требует настоящей подписи, а не только нотариуса", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("нотариус ЕСТЬ, но подпись демонстрационная — Ed25519 не обещаем", async () => {
    stub({ status: "ok", notarySignature: "demo" }, ONE_NOTARY);
    render(<ToastProvider><BureauPage /></ToastProvider>);
    await waitFor(() =>
      expect(screen.getAllByText(/request/i).length).toBeGreaterThan(0),
    );
    expect(
      screen.queryByText(ED25519_PROMISE),
      "подпись HMAC на публичном ключе выдана за криптографическую нотаризацию",
    ).toBeNull();
    // Значок проверяется ОТДЕЛЬНО и именно в этом случае. Без этой строки
    // сторож пережил мутацию «значок снова только по реестру»: остальные
    // случаи её не задевают, потому что в них реестр пуст.
    expect(
      screen.queryByText(/▲ live/),
      "значок обещает доступность тарифа при демонстрационной подписи",
    ).toBeNull();
  });

  test("нотариус есть И подпись настоящая — обещание уместно", async () => {
    stub({ status: "ok", notarySignature: "ed25519" }, ONE_NOTARY);
    render(<ToastProvider><BureauPage /></ToastProvider>);
    await waitFor(() =>
      expect(screen.queryByText(ED25519_PROMISE)).not.toBeNull(),
    );
  });

  test("состояние неизвестно (ответ прода сегодня) — обещания нет", async () => {
    stub({ status: "ok", service: "bureau" }, ONE_NOTARY);
    render(<ToastProvider><BureauPage /></ToastProvider>);
    await waitFor(() =>
      expect(screen.getAllByText(/request/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(ED25519_PROMISE)).toBeNull();
  });

  test("подпись настоящая, но подписать НЕКОМУ — значок не говорит live", async () => {
    // Оба условия обязательны, и это не педантизм: пустой реестр означает, что
    // тариф физически неисполним, сколько бы ключей ни было настроено.
    stub({ status: "ok", notarySignature: "ed25519" }, []);
    render(<ToastProvider><BureauPage /></ToastProvider>);
    await waitFor(() =>
      expect(screen.getAllByText(/request/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/▲ live/)).toBeNull();
  });
});
