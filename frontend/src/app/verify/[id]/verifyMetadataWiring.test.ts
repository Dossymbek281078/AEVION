// Два решения этого макета важнее его текста, и оба легко потерять при правке:
//
//   1. данные берутся из ОФЛАЙН-ПАКЕТА, а не из ручки проверки — та наращивает
//      публичный счётчик «verified N×», и каждый показ карточки ссылки в
//      мессенджере накручивал бы число;
//   2. запрет индексации сохранён — страница содержит имя автора, решение
//      принято до меня, и предпросмотр чинится независимо от индексации.

import { describe, test, expect, afterEach, vi } from "vitest";
import { generateMetadata } from "./layout";

const CERT_BUNDLE = {
  certificate: {
    title: "Степной рассвет",
    kind: "photo",
    author: "Досымбек",
    protectedAt: "2026-08-01T10:00:00.000Z",
  },
  proofs: { openTimestamps: { status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 } },
};

let calls: string[] = [];

function stub(ok: boolean, body: unknown = CERT_BUNDLE) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      if (!ok) throw new Error("ECONNRESET");
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch,
  );
}

const params = Promise.resolve({ id: "cert-preview-0001" });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("карточка ссылки на сертификат", () => {
  test("берёт данные из ПАКЕТА, а не из ручки проверки", async () => {
    stub(true);
    await generateMetadata({ params: Promise.resolve({ id: "cert-preview-0001" }) });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((u) => u.includes("/bundle.json")), "ходит не в пакет").toBe(true);
    expect(
      calls.some((u) => /\/api\/pipeline\/verify\//.test(u)),
      "ходит в ручку проверки — она наращивает публичный счётчик",
    ).toBe(false);
  });

  test("название работы попадает в заголовок и в openGraph", async () => {
    stub(true);
    const m = await generateMetadata({ params });
    expect(String(m.title)).toContain("Степной рассвет");
    expect(String(m.openGraph?.title)).toContain("Степной рассвет");
    expect(String(m.description)).toContain("912345");
  });

  test("запрет индексации сохранён", async () => {
    stub(true);
    const m = await generateMetadata({ params });
    expect(
      (m.robots as { index?: boolean } | undefined)?.index,
      "страница сертификата открыта для индексации — это меняет чужое решение",
    ).toBe(false);
  });

  test("спросить не удалось — общая карточка, и запрет всё равно на месте", async () => {
    stub(false);
    const m = await generateMetadata({ params });
    expect(String(m.title)).toBe("AEVION · Verify certificate");
    expect((m.robots as { index?: boolean } | undefined)?.index).toBe(false);
  });

  test("ответ без сертификата — тоже общая карточка, без выдумок", async () => {
    stub(true, { proofs: {} });
    const m = await generateMetadata({ params });
    expect(String(m.title)).toBe("AEVION · Verify certificate");
  });
});
