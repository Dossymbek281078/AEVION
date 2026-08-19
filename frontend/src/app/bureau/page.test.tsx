// Глубокая ссылка на объект: /bureau?objectId=… и ?qrightObjectId=…
//
// Такие ссылки шлют два места: маркер на 3D-глобусе
// (`components/Globus3D.tsx` — «открыть в бюро») и страница объекта QRight
// («посмотреть сертификат»). Обе передают id объекта QRight.
//
// Страница бюро эти параметры не читала вовсе: человек нажимал на конкретный
// объект и попадал на общий реестр, где его объект нужно искать руками. Со
// стороны отправителя дефект невидим — ссылка формируется правильно, переход
// происходит, ошибки нет.
//
// Просто подставить id в поиск нельзя: в сертификате его нет. Поиск идёт по
// заголовку, автору и хешам, поэтому id объекта не нашёл бы ничего — то есть
// «нашлось 0» вместо «не реализовано», что хуже. Правильный путь: спросить у
// QRight хеш содержимого этого объекта и искать по нему.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

let params = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/bureau",
}));

import { ToastProvider } from "@/components/ToastProvider";
import BureauPage from "./page";

/** Страница живёт внутри общего провайдера тостов — как и в приложении. */
const renderPage = () => render(<ToastProvider><BureauPage /></ToastProvider>);

const HASH = "a".repeat(64);

const CERT = {
  id: "cert_1",
  title: "Степной рассвет",
  kind: "photo",
  author: "А. Досымбек",
  location: "Алматы",
  contentHash: HASH,
  fileHash: null,
  algorithm: "sha256",
  protectedAt: "2026-08-01T00:00:00.000Z",
  verifiedCount: 2,
  verifyUrl: "/bureau/cert/cert_1",
};

function stubApi(objectFound: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/qright/objects/")) {
        return objectFound
          ? { ok: true, status: 200, json: async () => ({ id: "obj_1", title: "Степной рассвет", contentHash: HASH }) }
          : { ok: false, status: 404, json: async () => ({ error: "not found" }) };
      }
      if (u.includes("/api/pipeline/certificates")) {
        return { ok: true, status: 200, json: async () => ({ certificates: [CERT] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  params = new URLSearchParams("");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Бюро: переход с глобуса на конкретный объект", () => {
  test("?objectId= приводит к сертификату этого объекта, а не к общему списку", async () => {
    params = new URLSearchParams("objectId=obj_1");
    stubApi(true);

    renderPage();

    // Поиск заполнен хешем содержимого — тем, что реально есть в сертификате.
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/поиск|search/i) as HTMLInputElement;
      expect(input.value).toBe(HASH);
    });
  });

  test("вторая форма ссылки (?qrightObjectId=) работает так же", async () => {
    params = new URLSearchParams("qrightObjectId=obj_1");
    stubApi(true);

    renderPage();

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/поиск|search/i) as HTMLInputElement;
      expect(input.value).toBe(HASH);
    });
  });

  test("объект не найден — сказано прямо, а не пустой список без объяснения", async () => {
    params = new URLSearchParams("objectId=obj_missing");
    stubApi(false);

    renderPage();

    // Молчаливые «0 результатов» человек читает как «моего объекта тут нет»,
    // хотя на самом деле не разрешилась ссылка.
    expect(await screen.findByText(/не удалось открыть объект/i)).toBeTruthy();
  });
});
