import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { AutoTranslate } from "../AutoTranslate";

// JSX like `smart call{n === 1 ? "" : "s"}` renders ONE phrase as two sibling
// text nodes. Translating each fragment alone produced hybrids like
// "3 умный вызовs" (seen live on /pricing) — the walker must join sibling
// text nodes and translate the whole phrase.
describe("AutoTranslate — fragmented text nodes", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("aevion_lang_v1", "ru");
    // Pre-seed the persisted translation cache so no network round-trip is
    // needed for the phrase under test.
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "3 smart calls": "3 умных вызова" })
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [] }),
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("translates a phrase split across sibling text nodes as one unit", async () => {
    const n = 3;
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span data-testid="phrase">
              {`${n} smart call`}
              {n === 1 ? "" : "s"}
            </span>
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await waitFor(() => {
      const span = container.querySelector('[data-testid="phrase"]');
      expect(span?.textContent).toBe("3 умных вызова");
    });
  });

  it("still translates single text nodes exactly as before", async () => {
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "Open project": "Открыть проект" })
    );
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span data-testid="single">Open project</span>
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await waitFor(() => {
      expect(container.querySelector('[data-testid="single"]')?.textContent).toBe("Открыть проект");
    });
  });
});

// A module can opt its whole surface out of live DOM translation with
// translate="no" (QVenture, QRight, QSign, /build all do). The opt-out held for
// the server-rendered shell but not for anything rendered afterwards: the
// observer walked freshly added nodes directly, so it never saw the opted-out
// ancestor. Live symptom on /qventure/batch: one verdict column reading "WATCH"
// on the first row and "НАБЛЮДЕНИЕ" on the next two.
describe("AutoTranslate — translate=\"no\" subtrees", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("aevion_lang_v1", "ru");
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "Open project": "Открыть проект", WATCH: "НАБЛЮДЕНИЕ" })
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [] }),
    }) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("leaves an opted-out subtree untranslated on the initial pass", async () => {
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <div translate="no" className="notranslate">
              <span data-testid="opted">Open project</span>
            </div>
          </AutoTranslate>
        </I18nProvider>
      )
    );
    await waitFor(() => {
      expect(container.querySelector('[data-testid="opted"]')?.textContent).toBe("Open project");
    });
  });

  it("leaves nodes added INTO an opted-out subtree untranslated", async () => {
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe>
            <div translate="no" className="notranslate" data-testid="host" />
          </AutoTranslate>
        </I18nProvider>
      )
    );

    // Render a row the way the batch table does: after hydration, inside the
    // opted-out wrapper. This is the path that used to bypass the opt-out.
    await act(async () => {
      const host = container.querySelector('[data-testid="host"]') as HTMLElement;
      const row = document.createElement("span");
      row.setAttribute("data-testid", "late");
      row.textContent = "WATCH";
      host.appendChild(row);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container.querySelector('[data-testid="late"]')?.textContent).toBe("WATCH");
  });

  it("still translates nodes added OUTSIDE an opted-out subtree", async () => {
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe>
            <div data-testid="open-host" />
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await act(async () => {
      const host = container.querySelector('[data-testid="open-host"]') as HTMLElement;
      const row = document.createElement("span");
      row.setAttribute("data-testid", "late-open");
      row.textContent = "Open project";
      host.appendChild(row);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(container.querySelector('[data-testid="late-open"]')?.textContent).toBe("Открыть проект");
    });
  });
});
