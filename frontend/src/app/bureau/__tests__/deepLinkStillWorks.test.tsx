// Переход по ссылке `?objectId=` — единственное, ради чего странице нужен
// параметр запроса, и именно это я перестроил, сужая границу Suspense.
//
// Заявить «работает как раньше» без проверки было бы ровно тем, что я весь
// вечер ловил у других: обещание без замера. Здесь проверяется поведение, а не
// устройство: страница обязана СХОДИТЬ за объектом и честно сказать, если он
// не открылся.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let params = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "../page";

const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

let asked: string[] = [];
function stub(objectOk: boolean) {
  asked = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      asked.push(u);
      if (u.includes("/api/qright/objects/")) {
        return objectOk
          ? { ok: true, status: 200, json: async () => ({ contentHash: "a".repeat(64) }) }
          : { ok: false, status: 404, json: async () => ({ error: "not found" }) };
      }
      return { ok: true, status: 200, json: async () => ({ certificates: [], total: 0 }) };
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => { params = new URLSearchParams(""); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("ссылка с ?objectId= по-прежнему открывает запись", () => {
  test("параметр есть — страница идёт за объектом", async () => {
    params = new URLSearchParams("objectId=obj-42");
    stub(true);
    renderPage();
    await waitFor(() =>
      expect(asked.some((u) => u.includes("/api/qright/objects/obj-42"))).toBe(true),
    );
  });

  test("старое имя параметра тоже работает", async () => {
    // Ссылки с ?qrightObjectId= уже разосланы, ломать их нельзя.
    params = new URLSearchParams("qrightObjectId=obj-77");
    stub(true);
    renderPage();
    await waitFor(() =>
      expect(asked.some((u) => u.includes("/api/qright/objects/obj-77"))).toBe(true),
    );
  });

  test("объект не открылся — говорим об этом, а не молчим", async () => {
    params = new URLSearchParams("objectId=obj-none");
    stub(false);
    renderPage();
    await waitFor(() =>
      expect(screen.queryByText(/Не удалось открыть объект по ссылке/i)).not.toBeNull(),
    );
  });

  test("контроль: без параметра за объектом НЕ ходим", async () => {
    stub(true);
    renderPage();
    await screen.findByText("Notarized");
    await new Promise((r) => setTimeout(r, 40));
    expect(asked.some((u) => u.includes("/api/qright/objects/"))).toBe(false);
  });
});
