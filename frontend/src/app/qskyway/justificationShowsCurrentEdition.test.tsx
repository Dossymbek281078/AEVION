import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Просмотр документа обоснования показывает то же, что лежит в подписанном
 * файле: какое издание регулятор публикует сейчас.
 *
 * ПОВОД (14.09.2026). Бэкенд начал класть в документ `airspace.currentEdition`
 * (FAA переиздало карту 9/3/2026, снимок 7/9/2026, потолки совпадают). Экран
 * при этом по-прежнему писал «FAA · 7/9/2026» — человек видел одно, а в
 * скачанном файле лежало другое.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const AIRSPACE_BASE = {
  authority: "FAA", source: "UAS Facility Maps", regime: "Part 107", effective: "7/9/2026",
  contentHash: null, compliant: true, exceedingSegments: 0, maxExceedanceM: null, lowestCeilingM: 122,
};

async function openJustification(airspace: Record<string, unknown>): Promise<HTMLElement> {
  const route = {
    path: [{ c: 1, r: 1 }, { c: 6, r: 4 }], alts: [100, 110], distanceKm: 1.2,
    cruiseAltM: 110, etaMinWind: 1, etaMinStill: 1, avgWindMs: 2, windFromDeg: 90, airspace: {},
  };
  const just = {
    document: { from: 0, to: 1, city: "nyc", distanceKm: 1.2, cruiseAltM: 110, airspace },
    attestation: { alg: "Ed25519", contentHash: "abcdef0123456789abcdef0123456789", signature: "sig", publicKey: "pk" },
    scope: "демо", scopeEn: "demo",
  };
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/route/justification/verify")) return jsonOk({ valid: true });
    if (url.includes("/route/justification")) return jsonOk(just);
    if (url.includes("/api/qskyway/route")) return jsonOk(route);
    // «/cities» содержит «/city» — проверять раньше.
    if (url.includes("/api/qskyway/cities")) return jsonOk({ default: "nyc", cities: [{ id: "nyc", name: "New York" }] });
    if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
    return jsonOk({});
  }) as unknown as typeof fetch;

  const r = render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
  await waitFor(() => expect(r.container.querySelectorAll("button").length).toBeGreaterThan(3), { timeout: 10000 });
  const build = Array.from(r.container.querySelectorAll("button"))
    .find((b) => /justification|обоснован/i.test(b.textContent ?? ""));
  expect(build, "кнопки построения обоснования нет").toBeTruthy();
  fireEvent.click(build as HTMLElement);
  // Строка издания снимка — признак, что блок документа отрисован.
  await waitFor(() => expect(r.container.textContent ?? "").toContain("FAA · 7/9/2026"), { timeout: 8000 });
  return r.container;
}

describe("просмотр обоснования называет текущее издание регулятора", () => {
  test("карту переиздали без изменения потолков — на экране новое издание", async () => {
    const c = await openJustification({
      ...AIRSPACE_BASE,
      currentEdition: { publishedEffective: "9/3/2026", ceilingsMatch: true, checkedAt: "2026-09-13T18:56:33.165Z" },
    });
    expect(c.textContent ?? "", "в файле новое издание есть, а на экране нет").toContain("9/3/2026");
  }, 40000);

  test("контроль: потолки разошлись — «переиздали без изменений» НЕ говорим", async () => {
    const c = await openJustification({
      ...AIRSPACE_BASE,
      currentEdition: { publishedEffective: "9/3/2026", ceilingsMatch: false, checkedAt: "2026-09-13T18:56:33.165Z" },
    });
    // Текст «переиздали, значения не изменились» несёт дату нового издания;
    // при расхождении его быть не должно.
    expect(c.textContent ?? "").not.toContain("9/3/2026");
  }, 40000);

  test("документ старого образца (без поля) отрисовывается как раньше", async () => {
    const c = await openJustification({ ...AIRSPACE_BASE });
    expect(c.textContent ?? "").toContain("FAA · 7/9/2026");
    expect(c.textContent ?? "").not.toContain("9/3/2026");
  }, 40000);
});
